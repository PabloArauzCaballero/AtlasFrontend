/**
 * Cuándo se repite una petición que falló porque el backend no estaba, y cuánto se espera.
 *
 * ## Por qué existe
 *
 * Cada despliegue del backend del ERP deja el API sin servir mientras Coolify cambia los contenedores:
 * para los viejos antes de levantar los nuevos, y entre medias nadie responde a `erp`. En ese hueco la
 * petición del navegador la contesta lo que hay delante: la reescritura de `next.config.ts` con un
 * `Internal Server Error` en texto plano, o Traefik con `404 page not found` si el que se despliega es
 * este portal. Medido en AtlasBackend el 2026-09-13 con el mismo mecanismo: 77 s antes de ajustar el
 * compose, 12-36 s después.
 *
 * Sin esto, las pantallas pintaban «Error HTTP 500» o «Endpoint no encontrado» —que manda a revisar
 * prefijos que están bien—. Y si el token caducaba en ese momento, el refresco fallaba y `apiRequest`
 * borraba la sesión: un despliegue sacaba al operador y al comercio del portal.
 *
 * ## Cómo se sabe que contestó la pasarela
 *
 * Por el tipo del cuerpo. El backend responde SIEMPRE los errores en JSON (`HttpExceptionFilter`,
 * global): hasta una ruta inexistente vuelve con `{ success: false, error }`. Un 404/5xx que no es JSON
 * no lo escribió el backend.
 *
 * ## Qué se repite
 *
 *  - GET y HEAD: ante cualquier fallo transitorio, incluido el corte de red y el plazo agotado.
 *  - Una mutación (POST, PUT, PATCH, DELETE) CON llave de idempotencia (`x-idempotency-key`): igual
 *    que un GET, y siempre con la MISMA llave, porque el backend reconoce la repetición y devuelve la
 *    respuesta guardada en vez de ejecutarla dos veces.
 *  - Una mutación SIN llave: nunca. Ni siquiera ante un 404/500/502/503 que no es JSON: el proxy de
 *    Next también contesta `Internal Server Error` en texto cuando el backend cortó la conexión DESPUÉS
 *    de recibir la petición (medido en `next-proxy-reset.cjs`, plan de producción 2026-09-24). Antes se
 *    daba por «no llegó» y un asiento contable podía mandarse hasta 22 veces. Ahora se manda una vez y,
 *    si la respuesta no la escribió el backend, `apiClient` avisa de que el resultado es desconocido.
 */

export const PRESUPUESTO_REINTENTOS_MS = 45_000;

const ESPERAS_MS = [1_000, 2_000, 3_000, 5_000, 8_000];

/** Dispersión de cada espera: al acabar un despliegue no vuelven todas las pestañas a la vez. */
const DISPERSION = 0.25;

const DE_PASARELA = new Set([404, 500, 502, 503, 504]);

/** Nombres (en minúsculas) con los que viaja la llave de idempotencia. El backend lee `x-idempotency-key`. */
const CABECERAS_DE_LLAVE = new Set(['x-idempotency-key', 'idempotency-key']);

/**
 * - `segura`: repetir no cambia nada (lectura, o una subida a la misma URL firmada).
 * - `con-llave`: mutación con llave de idempotencia; el backend descarta la repetición.
 * - `unica`: mutación sin llave; se manda una sola vez.
 */
export type Repeticion = 'segura' | 'con-llave' | 'unica';

export function esMutacion(method: string | undefined): boolean {
  const metodo = (method ?? 'GET').toUpperCase();
  return metodo !== 'GET' && metodo !== 'HEAD';
}

/** La llave de idempotencia de la petición, venga con el nombre que venga; `null` si no hay. */
export function llaveDeIdempotencia(headers: Record<string, string> | undefined): string | null {
  for (const [nombre, valor] of Object.entries(headers ?? {})) {
    if (CABECERAS_DE_LLAVE.has(nombre.toLowerCase()) && valor.trim()) return valor;
  }
  return null;
}

export function repeticionDe(method: string | undefined, headers?: Record<string, string>): Repeticion {
  if (!esMutacion(method)) return 'segura';
  return llaveDeIdempotencia(headers) ? 'con-llave' : 'unica';
}

/** La respuesta la produjo lo que está delante del backend, no el backend. */
export function esRespuestaDePasarela(response: Response): boolean {
  if (!DE_PASARELA.has(response.status)) return false;
  return !(response.headers.get('content-type') ?? '').includes('json');
}

/** Lo que devuelve un intento: la respuesta, o el fallo de transporte (sin respuesta: `status` 0). */
export type Resultado = { response: Response } | { error: unknown; sinRespuesta: boolean };

export function merecePrueba(resultado: Resultado, repeticion: Repeticion): boolean {
  if (repeticion === 'unica') return false;
  if ('response' in resultado) return esRespuestaDePasarela(resultado.response);
  return resultado.sinRespuesta;
}

export function esperaAntesDelIntento(n: number, azar: () => number = Math.random): number {
  const base = ESPERAS_MS[Math.min(n - 1, ESPERAS_MS.length - 1)] as number;
  return Math.round(base * (1 - DISPERSION + azar() * DISPERSION * 2));
}

/**
 * Ejecuta `intento` y lo repite mientras el resultado lo merezca y quede presupuesto.
 *
 * Al agotarse devuelve la ÚLTIMA respuesta —o relanza el último error— para que el flujo de siempre la
 * convierta en el mensaje que la pantalla ya sabe pintar.
 */
export async function conReintentos(
  intento: () => Promise<Response>,
  opciones: {
    repeticion: Repeticion;
    esSinRespuesta: (error: unknown) => boolean;
    presupuestoMs?: number;
    ahora?: () => number;
    dormir?: (ms: number) => Promise<void>;
  },
): Promise<Response> {
  const ahora = opciones.ahora ?? Date.now;
  const dormir = opciones.dormir ?? ((ms: number) => new Promise<void>((listo) => setTimeout(listo, ms)));
  const limite = ahora() + (opciones.presupuestoMs ?? PRESUPUESTO_REINTENTOS_MS);

  for (let n = 1; ; n++) {
    let resultado: Resultado;
    try {
      resultado = { response: await intento() };
    } catch (error) {
      resultado = { error, sinRespuesta: opciones.esSinRespuesta(error) };
    }

    const espera = esperaAntesDelIntento(n);
    if (!merecePrueba(resultado, opciones.repeticion) || ahora() + espera > limite) {
      if ('response' in resultado) return resultado.response;
      throw resultado.error;
    }
    await dormir(espera);
  }
}
