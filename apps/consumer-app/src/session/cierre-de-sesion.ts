/**
 * Cerrar la sesion en el servidor, con plazo.
 *
 * ## Por que con plazo
 *
 * `signOut` espera a este cierre antes de revocar el token (despues ya no habria con que
 * autenticarlo). Pero la persona esta delante esperando a salir: si la red cuelga, no puede quedarse
 * mirando un boton. Por eso:
 *
 *  - como mucho DOS intentos: el presupuesto de reintentos se acorta a `PRESUPUESTO_REINTENTO_MS`, en
 *    vez de los 45 s con que el cliente cubre un despliegue;
 *  - y un tope TOTAL de `PLAZO_CIERRE_MS`: al cumplirse se aborta la llamada (con sus reintentos) y se
 *    sigue.
 *
 * ## Por que no pasa nada si falla
 *
 * El cierre local sigue adelante siempre: dejar a alguien dentro porque el servidor no contesto seria
 * el peor de los dos resultados. La sesion que quede abierta en el servidor la cierra
 * `expire_stale_sessions` por inactividad (`COALESCE(last_activity_at, started_at)`), y como ya nadie
 * la hace latir, caduca en la ventana normal. El fallo solo se anota.
 */
import * as customerApi from '../api/endpoints/customer';
import { AtlasApiError } from '../api/errors';

/** Tope total del cierre en el servidor. */
export const PLAZO_CIERRE_MS = 5_000;

/**
 * Presupuesto de reintentos del cliente: deja un segundo intento (la primera espera es de ~1 s) y no
 * un tercero (la segunda es de ~2 s).
 */
export const PRESUPUESTO_REINTENTO_MS = 2_000;

/** Devuelve si el servidor confirmo el cierre. Nunca lanza. */
export async function cerrarSesionEnServidor(customerId: string, sessionId: string): Promise<boolean> {
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<false>((resolve) => {
    temporizador = setTimeout(() => {
      control.abort();
      resolve(false);
    }, PLAZO_CIERRE_MS);
  });

  const cierre = customerApi
    .endSession(customerId, sessionId, 'customer_logout', {
      signal: control.signal,
      presupuestoReintentosMs: PRESUPUESTO_REINTENTO_MS,
    })
    .then(() => true as const)
    .catch((error: unknown) => {
      const codigo = error instanceof AtlasApiError ? `${error.status ?? '-'} ${error.code}` : String(error);
      console.warn(`[sesion] cierre de la sesion ${sessionId} en el servidor no confirmado: ${codigo}`);
      return false as const;
    });

  try {
    // La carrera, y no solo el `signal`: si algo antes de la red (leer el token) se quedara colgado,
    // el abort no lo alcanzaria y `signOut` esperaria igual.
    return await Promise.race([cierre, plazo]);
  } finally {
    clearTimeout(temporizador);
  }
}
