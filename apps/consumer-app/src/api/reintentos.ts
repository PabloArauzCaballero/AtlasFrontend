/**
 * Cuándo se repite una petición que falló, y cuánto se espera.
 *
 * ## Por qué existe
 *
 * Cada despliegue de AtlasBackend deja el API sin servir unos segundos: Coolify para los contenedores
 * viejos antes de levantar los nuevos, y entre medias no hay nadie detrás del nombre `atlas-backend`.
 * Medido el 2026-09-13: 77 s antes de ajustar el despliegue, ~35 s después. Durante ese hueco la
 * petición no llega al API — la contesta lo que hay delante: el proxy de Next con un 500 en texto
 * plano, o Traefik con un `404 page not found` si el que se está desplegando es el portal.
 *
 * Sin reintento, quien estaba a mitad del alta veía un error y tenía que adivinar si volver a tocar el
 * botón. Y había algo peor: si el token de acceso caducaba justo entonces, el refresco también fallaba
 * y la app CERRABA LA SESIÓN. Un despliegue echaba a la gente.
 *
 * ## La regla que lo hace seguro
 *
 * Repetir una petición es inofensivo sólo si repetirla no puede hacer dos veces lo mismo:
 *
 *  - GET, o una operación con `x-idempotency-key`: se repite ante cualquier fallo transitorio. La
 *    clave es la MISMA en todos los intentos, así que el backend deduplica aunque el primero sí
 *    hubiera llegado.
 *  - Cualquier otra: sólo si contestó la PASARELA con un 404/500/502/503. Esa respuesta no la produjo
 *    el API. No se repite ante un timeout, un corte de red o un 504, porque ahí la petición pudo
 *    llegar y ejecutarse sin que la respuesta volviera.
 *
 * Un 500 del proxy puede venir, en teoría, de una conexión cortada con la petición ya dentro. Para eso
 * el API drena lo que tiene en curso antes de apagarse; y aun en ese caso raro, el reintento hace lo
 * mismo que haría la persona tocando otra vez el botón — sólo que sin que tenga que decidirlo ella.
 */
import { AtlasApiError } from './errors';

/** Tiempo máximo que una operación sigue reintentando. Cubre el hueco medido de un despliegue. */
export const PRESUPUESTO_REINTENTOS_MS = 45_000;

/** Esperas entre intentos; a partir del último se repite el tope. */
const ESPERAS_MS = [1_000, 2_000, 3_000, 5_000, 8_000];

/** Cuánto se puede separar cada espera de su valor nominal, en fracción. */
const DISPERSION = 0.25;

export type Repeticion =
  /** GET u operación con clave de idempotencia: repetir no duplica nada. */
  | 'segura'
  /** Todo lo demás: sólo si la pasarela confirma que el API no la vio. */
  | 'solo-si-no-llego';

/** Estados que, sin el sobre del backend, sólo pueden venir de lo que está delante del API. */
const DE_PASARELA = new Set([404, 500, 502, 503, 504]);

/** Los de arriba menos el 504: un plazo agotado en la pasarela no dice si el API la recibió. */
const NO_LLEGO = new Set([404, 500, 502, 503]);

export function repeticionDe(method: string | undefined, idempotente: boolean | undefined): Repeticion {
  return (method ?? 'GET') === 'GET' || idempotente === true ? 'segura' : 'solo-si-no-llego';
}

/** El error lo produjo algo entre la app y el API, no el API. */
export function esFalloDeInfraestructura(error: unknown): boolean {
  if (!(error instanceof AtlasApiError)) return false;
  if (error.kind === 'network' || error.kind === 'timeout') return true;
  return error.fromGateway && error.status !== null && DE_PASARELA.has(error.status);
}

export function merecePrueba(error: unknown, repeticion: Repeticion): boolean {
  if (!esFalloDeInfraestructura(error)) return false;
  if (repeticion === 'segura') return true;
  const e = error as AtlasApiError;
  return e.fromGateway && e.status !== null && NO_LLEGO.has(e.status);
}

/**
 * Espera antes del intento `n` (el primero que se repite es el 1), con dispersión.
 *
 * La dispersión no es cosmética: al acabar un despliegue, todos los teléfonos que estaban esperando
 * vuelven a la vez. Sin ella llegarían sincronizados al API recién arrancado, justo cuando menos
 * margen tiene.
 */
export function esperaAntesDelIntento(n: number, azar: () => number = Math.random): number {
  const base = ESPERAS_MS[Math.min(n - 1, ESPERAS_MS.length - 1)] as number;
  const factor = 1 - DISPERSION + azar() * DISPERSION * 2;
  return Math.round(base * factor);
}

/** Pausa que se interrumpe si la pantalla cancela la operación. */
export function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortada());
      return;
    }
    const temporizador = setTimeout(() => {
      signal?.removeEventListener('abort', alAbortar);
      resolve();
    }, ms);
    function alAbortar() {
      clearTimeout(temporizador);
      reject(abortada());
    }
    signal?.addEventListener('abort', alAbortar, { once: true });
  });
}

function abortada(): AtlasApiError {
  return new AtlasApiError({ kind: 'timeout', code: 'REQUEST_ABORTED', message: 'La operación se canceló.' });
}

/**
 * Ejecuta `intento` y lo repite mientras el fallo lo merezca y quede presupuesto.
 *
 * Si se agota, se lanza el ÚLTIMO error: es el que describe mejor el estado en el que quedó el
 * sistema, y la pantalla ya sabe pintarlo.
 */
export async function conReintentos<T>(
  intento: () => Promise<T>,
  opciones: { repeticion: Repeticion; signal?: AbortSignal; presupuestoMs?: number; ahora?: () => number },
): Promise<T> {
  const ahora = opciones.ahora ?? Date.now;
  const limite = ahora() + (opciones.presupuestoMs ?? PRESUPUESTO_REINTENTOS_MS);

  for (let n = 1; ; n++) {
    try {
      return await intento();
    } catch (error) {
      if (!merecePrueba(error, opciones.repeticion) || opciones.signal?.aborted) throw error;
      const espera = esperaAntesDelIntento(n);
      if (ahora() + espera > limite) throw error;
      await esperar(espera, opciones.signal);
    }
  }
}

/**
 * `fetch` para peticiones que se pueden repetir por naturaleza y no pasan por `request`: la subida a
 * una URL firmada (un PUT a la misma clave deja el mismo objeto) y la descarga de un adjunto.
 *
 * Existe porque el almacén se despliega JUNTO al backend: MinIO es un servicio del mismo compose y se
 * recrea en cada despliegue. Subir la foto del carnet durante ese hueco fallaba igual que una
 * petición al API, y es de las cosas que más cuesta repetir a mano.
 *
 * Aquí no hay sobre del backend con el que distinguir quién contestó, así que se mira el tipo:
 *  - 502/503/504: siempre transitorio, venga de la pasarela o del propio MinIO saturado;
 *  - 404/500: sólo si NO es JSON ni XML. El backend contesta JSON y MinIO XML; lo que queda es
 *    Traefik sin contenedor detrás (`404 page not found`) o el proxy de Next sin API.
 * Un 403 —la firma venció— nunca se repite: repetir no lo arregla y la pantalla tiene que pedir otra.
 */
export async function fetchRepetible(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  return conReintentos(
    async () => {
      let response: Response;
      try {
        response = await fetch(url, { ...init, signal });
      } catch (error) {
        const aborted = (error as Error).name === 'AbortError';
        throw new AtlasApiError({
          kind: aborted ? 'timeout' : 'network',
          code: aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_UNREACHABLE',
          message: (error as Error).message,
        });
      }
      if (esRespuestaTransitoria(response)) {
        throw new AtlasApiError({
          kind: response.status === 503 ? 'unavailable' : 'server',
          code: 'UPSTREAM_UNAVAILABLE',
          message: `El servicio respondió HTTP ${response.status} mientras no estaba disponible.`,
          status: response.status,
          fromGateway: true,
        });
      }
      return response;
    },
    { repeticion: 'segura', signal },
  );
}

function esRespuestaTransitoria(response: Response): boolean {
  if (response.status === 502 || response.status === 503 || response.status === 504) return true;
  if (response.status !== 404 && response.status !== 500) return false;
  const tipo = response.headers?.get?.('content-type') ?? '';
  return !/json|xml/i.test(tipo);
}
