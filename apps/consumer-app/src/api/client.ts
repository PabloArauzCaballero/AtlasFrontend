/**
 * Cliente HTTP de ATLAS.
 *
 * Responsabilidades, todas obligatorias segun el documento maestro:
 *  - envolver/desenvolver el sobre `{ requestId, data }` / `{ requestId, error }` del backend;
 *  - propagar `x-tenant-id`;
 *  - generar `x-idempotency-key` en TODA operacion critica reintentable (R75);
 *  - timeout y cancelacion (nunca una request sin limite);
 *  - refrescar el access token una sola vez ante 401 y reintentar (sin bucles);
 *  - NO reintentar de forma infinita ni silenciar errores.
 *
 * El almacenamiento del token entra por PUERTO (`TokenStore`), no por dependencia directa: en el
 * dispositivo lo implementa SecureStore; en tests, memoria. El cliente no sabe donde vive el token.
 */
import { apiConfig } from './config';
import { AtlasApiError, kindFromStatus } from './errors';

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
  signal?: AbortSignal;
};

type Envelope<T> = { requestId?: string; data?: T; error?: { code?: string; message?: string } };

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

async function rawRequest<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
  correlationId: string,
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
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(options.idempotent ? { 'x-idempotency-key': newIdempotencyKey() } : {}),
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
  if (text) {
    try {
      envelope = JSON.parse(text) as Envelope<T>;
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
    const rawMessage = envelope.error?.message ?? flat.message ?? response.statusText;
    // `CODIGO_DE_NEGOCIO: detalle` -> se conserva el codigo de negocio, que es lo accionable.
    const businessCode = /^[A-Z0-9_]+$/.test(rawMessage.split(':')[0]?.trim() ?? '') ? (rawMessage.split(':')[0] as string).trim() : code;
    throw new AtlasApiError({
      kind: kindFromStatus(response.status),
      code: businessCode,
      message: rawMessage,
      status: response.status,
      requestId,
      details: envelope,
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

/** Punto unico de salida a red. Refresca el token una sola vez ante 401 y no reintenta mas. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const tokens = options.anonymous ? null : ((await tokenStore?.read()) ?? null);
  const correlationId = newCorrelationId();

  try {
    const result = await rawRequest<T>(path, options, tokens?.accessToken ?? null, correlationId);
    return result.data;
  } catch (error) {
    const isAuthError = error instanceof AtlasApiError && error.kind === 'auth';
    if (!isAuthError || options.anonymous || !tokens?.refreshToken || !tokenStore) throw error;

    let refreshed: TokenPair;
    try {
      const result = await rawRequest<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: tokens.refreshToken }, anonymous: true },
        null,
        // El refresco lleva la correlacion de la operacion que lo provoco: sin eso, en el log
        // aparece un `/auth/refresh` suelto que no se sabe de donde salio.
        correlationId,
      );
      refreshed = { accessToken: result.data.accessToken, refreshToken: result.data.refreshToken };
    } catch {
      await tokenStore.clear();
      onSessionExpired?.();
      throw error;
    }

    await tokenStore.write(refreshed);
    const retried = await rawRequest<T>(path, options, refreshed.accessToken, correlationId);
    return retried.data;
  }
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
