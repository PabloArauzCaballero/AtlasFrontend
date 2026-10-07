/**
 * Cliente HTTP de ATLAS.
 *
 * Responsabilidades, todas obligatorias segun el documento maestro:
 *  - envolver/desenvolver el sobre `{ requestId, data }` / `{ requestId, error }` del backend;
 *  - propagar `x-tenant-id`;
 *  - generar `x-idempotency-key` en TODA operacion critica reintentable (R75);
 *  - timeout y cancelacion (nunca una request sin limite);
 *  - refrescar el access token una sola vez ante 401 y reintentar (sin bucles);
 *  - repetir, con presupuesto acotado, lo que falla porque el API no estaba (ver `reintentos.ts`);
 *  - NO reintentar de forma infinita ni silenciar errores.
 *
 * El almacenamiento del token entra por PUERTO (`TokenStore`), no por dependencia directa: en el
 * dispositivo lo implementa SecureStore; en tests, memoria. El cliente no sabe donde vive el token.
 */
import { apiConfig } from './config';
import { getCurrentScreen } from './current-screen';
import { AtlasApiError, kindFromStatus } from './errors';
import { conReintentos, repeticionDe } from './reintentos';

export type TokenPair = { accessToken: string; refreshToken: string };

export type TokenStore = {
  read(): Promise<TokenPair | null>;
  write(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Marca la operacion como critica: agrega `x-idempotency-key` (R75). */
  idempotent?: boolean;
  /** Salta la cabecera de autorizacion (login, refresh, catalogos publicos). */
  anonymous?: boolean;
  /**
   * La llamada no sale de una pantalla: tarea de ubicacion, telemetria, sincronizacion de fondo. Sin
   * esto se atribuiria a la pantalla que este arriba, y un seguimiento periodico marcaria como usada
   * cualquier pantalla abierta y llenaria su lista de llamadas con señales del dispositivo.
   */
  sinPantalla?: boolean;
  signal?: AbortSignal;
  /**
   * Tiempo maximo que se sigue reintentando ante un fallo de infraestructura. Por defecto el de
   * `reintentos.ts` (45 s, el hueco de un despliegue); lo acorta quien no puede esperar tanto, como el
   * cierre de sesion, que tiene a la persona delante esperando a salir.
   */
  presupuestoReintentosMs?: number;
};

type Envelope<T> = { requestId?: string; data?: T; error?: { code?: string; message?: string; issues?: { path?: string; message?: string }[] } };

let tokenStore: TokenStore | null = null;
let onSessionExpired: (() => void) | null = null;

export function configureClient(input: { tokenStore: TokenStore; onSessionExpired?: () => void }): void {
  tokenStore = input.tokenStore;
  onSessionExpired = input.onSessionExpired ?? null;
}

/**
 * Clave de idempotencia por intento de operacion.
 *
 * Se genera en el cliente porque es el cliente quien reintenta: si la genera el servidor, dos
 * toques del mismo boton son dos operaciones distintas. `crypto.randomUUID` no existe en todos los
 * runtimes de RN, de ahi el respaldo.
 */
export function newIdempotencyKey(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `atlas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Un identificador por operacion, para que el backend pueda atar lo que hizo la app.
 *
 * AtlasBackend lo guarda en `system_action_logs` y solo acepta el valor entrante si cumple
 * `/^[A-Za-z0-9_-]{1,64}$/`; lo que no encaje se descarta y se genera otro del lado del servidor, con
 * lo que la correlacion se pierde sin avisar. Los dos formatos de aqui caben.
 *
 * Se reutiliza la misma forma que `newIdempotencyKey` —y su respaldo— porque `crypto.randomUUID` no
 * existe en todos los runtimes de RN, no porque sean lo mismo: la llave de idempotencia dice «esto
 * ya se hizo, no lo repitas» y esto dice «esto es lo mismo que aquello». Mezclarlas haria que un
 * reintento deduplicado y una operacion nueva compartieran identidad.
 */
export function newCorrelationId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Identifica a la app ante el backend, que lo normaliza a `CONSUMER_APP`: el codigo del catalogo de pantallas. */
export const ATLAS_PRODUCT = 'consumer-app';

/**
 * Cabeceras de origen: que cliente llama y desde que pantalla. Ver `current-screen.ts`.
 *
 * `x-atlas-product` no cambia el rotulo de los correos de codigo: el backend lo resuelve contra una
 * lista cerrada donde la app no esta, y cae al mismo rotulo generico que sin cabecera.
 */
export function originHeaders(pantalla: string | null = getCurrentScreen()): Record<string, string> {
  return { 'x-atlas-product': ATLAS_PRODUCT, ...(pantalla ? { 'x-atlas-flow': pantalla } : {}) };
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
  correlationId: string,
  pantalla: string | null,
  idempotencyKey: string | null,
): Promise<{ data: T; requestId: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiConfig.requestTimeoutMs);
  if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${apiConfig.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'x-tenant-id': apiConfig.tenantId,
        // Un id por OPERACION, no por intento: si el 401 dispara un refresco y se reintenta, las dos
        // peticiones comparten id y en el backend se ven como lo que son, un solo gesto del usuario.
        // Con uno por intento, el reintento parecia una operacion distinta y la traza se partia justo
        // en el caso que mas interesa mirar.
        'x-correlation-id': correlationId,
        ...originHeaders(pantalla),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        // La clave llega de fuera: es una por OPERACION y se repite en cada intento. Generada aqui,
        // cada reintento parecia una operacion nueva y el backend no podia deduplicar el cobro que
        // el primer intento quiza ya habia hecho.
        ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
        ...(accessToken && !options.anonymous ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const aborted = (error as Error).name === 'AbortError';
    throw new AtlasApiError({
      kind: aborted ? 'timeout' : 'network',
      code: aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_UNREACHABLE',
      message: (error as Error).message,
    });
  }
  clearTimeout(timeout);

  const text = await response.text();
  let envelope: Envelope<T> = {};
  // Ver `AtlasApiError.fromGateway`: si el cuerpo no es un objeto JSON, no lo escribio el API.
  let fromGateway = true;
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed !== null && typeof parsed === 'object') {
        envelope = parsed as Envelope<T>;
        fromGateway = false;
      }
    } catch {
      envelope = {};
    }
  }
  const requestId = envelope.requestId ?? null;

  if (!response.ok) {
    // El backend usa dos formas de error segun la capa que lo emite; se aceptan ambas en vez de
    // asumir una y perder el codigo de negocio.
    const flat = envelope as unknown as { code?: string; message?: string };
    const code = envelope.error?.code ?? flat.code ?? 'UNKNOWN_ERROR';
    // Sin sobre —lo contesto la pasarela— no hay mensaje de negocio, y `statusText` puede faltar: por
    // HTTP/2, que es como llega el tunel, el motivo va vacio. Sin respaldo, el `split` de abajo
    // reventaba y un fallo transitorio salia como un TypeError que ninguna pantalla sabe pintar.
    const generico = envelope.error?.message ?? flat.message ?? (response.statusText || `HTTP ${response.status}`);
    /*
      En un 400 de validación el backend manda `error.issues[{path, message}]` y un mensaje genérico
      («Entrada inválida en body.»). La app sólo mostraba el genérico, así que nadie sabía QUÉ campo
      falló: el 400 del asistente (`clientMessageId` no era UUID) se vio semanas como «Entrada
      inválida» sin pista. Con el primer `issue` el mensaje dice el campo y el motivo.
    */
    const primero = response.status === 400 ? envelope.error?.issues?.find((issue) => issue?.message) : undefined;
    const rawMessage = primero ? `${generico.replace(/\.$/, '')}: ${primero.path ? `${primero.path} — ` : ''}${primero.message}` : generico;
    // `CODIGO_DE_NEGOCIO: detalle` -> se conserva el codigo de negocio, que es lo accionable.
    const businessCode = /^[A-Z0-9_]+$/.test(rawMessage.split(':')[0]?.trim() ?? '') ? (rawMessage.split(':')[0] as string).trim() : code;
    throw new AtlasApiError({
      kind: kindFromStatus(response.status),
      code: businessCode,
      message: rawMessage,
      status: response.status,
      requestId,
      details: envelope,
      fromGateway,
    });
  }

  /*
   * `'data' in envelope` y no `envelope.data ?? envelope`.
   *
   * Con `??`, una respuesta legitima de `data: null` —«este cliente todavia no subio ningun
   * extracto»— devolvia el SOBRE ENTERO en lugar de `null`. La pantalla recibia
   * `{requestId, data: null, timestamp}`, que es un objeto y por tanto verdadero, y pintaba una
   * tarjeta de estado vacia sobre un extracto que no existe.
   *
   * Los endpoints que responden sin sobre siguen funcionando: si no hay clave `data`, se devuelve
   * el cuerpo tal cual.
   */
  const body = envelope !== null && typeof envelope === 'object' && 'data' in envelope ? envelope.data : (envelope as unknown as T);
  return { data: body as T, requestId };
}

/**
 * 401 que son la RESPUESTA del negocio, no una sesion vencida.
 *
 * Un codigo de verificacion mal escrito o vencido responde 401. Tratarlo como token vencido
 * refrescaba y REENVIABA el mismo codigo: cada error de tipeo gastaba dos de los intentos que
 * permite el codigo, y la persona se quedaba sin intentos con la mitad de las equivocaciones.
 */
const BUSINESS_AUTH_CODES = new Set(['INVALID_VERIFICATION_CODE', 'VERIFICATION_CODE_EXPIRED']);

/** Si un error de la API justifica refrescar el token y reintentar. */
export function shouldRefreshOn(error: unknown): boolean {
  return error instanceof AtlasApiError && error.kind === 'auth' && !BUSINESS_AUTH_CODES.has(error.code);
}

/**
 * Punto unico de salida a red.
 *
 * Dos mecanismos distintos, que no se mezclan:
 *  - ante 401 refresca el token UNA vez y repite (sin bucles);
 *  - ante un fallo de infraestructura —el API no estaba— repite con presupuesto acotado, segun las
 *    reglas de `reintentos.ts`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const tokens = options.anonymous ? null : ((await tokenStore?.read()) ?? null);
  const correlationId = newCorrelationId();
  // La pantalla se fija al EMPEZAR la operacion, igual que el id: si el usuario navega mientras se
  // refresca el token, el reintento sigue siendo de la pantalla que lo pidio, no de la nueva.
  const pantalla = options.sinPantalla ? null : getCurrentScreen();
  // Una clave por operacion, compartida por todos sus intentos. Ver `rawRequest`.
  const idempotencyKey = options.idempotent ? newIdempotencyKey() : null;
  const repeticion = repeticionDe(options.method, options.idempotent);

  const intentar = (accessToken: string | null) =>
    conReintentos(() => rawRequest<T>(path, options, accessToken, correlationId, pantalla, idempotencyKey), {
      repeticion,
      signal: options.signal,
      presupuestoMs: options.presupuestoReintentosMs,
    });

  try {
    const result = await intentar(tokens?.accessToken ?? null);
    return result.data;
  } catch (error) {
    if (!shouldRefreshOn(error) || options.anonymous || !tokens?.refreshToken || !tokenStore) throw error;

    let refreshed: TokenPair;
    try {
      const result = await conReintentos(
        () =>
          rawRequest<{ accessToken: string; refreshToken: string }>(
            '/auth/refresh',
            { method: 'POST', body: { refreshToken: tokens.refreshToken }, anonymous: true },
            null,
            // El refresco lleva la correlacion de la operacion que lo provoco: sin eso, en el log
            // aparece un `/auth/refresh` suelto que no se sabe de donde salio.
            correlationId,
            pantalla,
            null,
          ),
        // Un refresco que SI llego no se repite: el backend rota el token y el viejo ya no vale.
        { repeticion: 'solo-si-no-llego', signal: options.signal },
      );
      refreshed = { accessToken: result.data.accessToken, refreshToken: result.data.refreshToken };
    } catch (refreshError) {
      /*
        La sesion se cierra SOLO si el backend rechazo el refresco.

        Antes se cerraba ante cualquier fallo, y un refresco que coincidia con un despliegue —el API
        sin servir, la pasarela contestando— echaba a la persona de la app con un token de refresco
        perfectamente valido. Si el API no contesto, el token sigue siendo bueno: se conserva y se
        informa del fallo, que la siguiente operacion resolvera sola.
      */
      if (sesionRechazada(refreshError)) {
        await tokenStore.clear();
        onSessionExpired?.();
        throw error;
      }
      throw refreshError;
    }

    await tokenStore.write(refreshed);
    const retried = await intentar(refreshed.accessToken);
    return retried.data;
  }
}

/** El backend —no la red ni la pasarela— dijo que ese token de refresco no sirve. */
function sesionRechazada(error: unknown): boolean {
  if (!(error instanceof AtlasApiError) || error.fromGateway) return false;
  return error.kind === 'auth' || error.kind === 'permission' || error.kind === 'validation';
}

/**
 * El token de acceso vigente, para las descargas que no pasan por `request`.
 *
 * Se expone en vez de duplicar el almacen de credenciales en otro modulo: dos sitios leyendo y
 * escribiendo las mismas claves es como se acaba con una sesion renovada en uno y caducada en el
 * otro. Quien lo use solo LEE; renovar sigue siendo cosa de `request`.
 */
export async function readAccessToken(): Promise<string | null> {
  const tokens = (await tokenStore?.read()) ?? null;
  return tokens?.accessToken ?? null;
}
