/**
 * Si el token de acceso ya caducó, o caduca antes de que la petición vuelva.
 *
 * ## Por qué existe (2026-10-17)
 *
 * El token de acceso dura una hora (`JWT_ACCESS_TOKEN_EXPIRES_IN` del backend). Quien abre la app al día siguiente
 * mandaba la portada con un token muerto: cada petición volvía con 401, se refrescaba y se repetía. Con el servidor
 * a 210 ms de ida y vuelta desde Santa Cruz, eso eran dos viajes de más en casi cada apertura en frío, antes de
 * pintar nada. Mirando el `exp` del propio token se refresca ANTES, una vez, y la portada sale a la primera.
 *
 * Sólo se LEE el `exp`; la firma no se comprueba aquí ni hace falta: el que decide si el token vale es el servidor.
 * Si el token no se puede leer (no es un JWT, otro formato), devuelve `false` y todo sigue como antes: el 401.
 */

/** Margen: un token que caduca en menos de esto se trata como caducado (la petición puede tardar en llegar). */
export const MARGEN_MS = 30_000;

function base64UrlATexto(segmento: string): string | null {
  if (typeof globalThis.atob !== 'function') return null;
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  try {
    return globalThis.atob(base64 + relleno);
  } catch {
    return null;
  }
}

/** El `exp` del token en milisegundos, o `null` si no se puede leer. */
export function caducidadDe(accessToken: string): number | null {
  const partes = accessToken.split('.');
  if (partes.length !== 3) return null;
  const json = base64UrlATexto(partes[1] ?? '');
  if (!json) return null;
  try {
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function caducaPronto(accessToken: string, ahoraMs: number = Date.now()): boolean {
  const exp = caducidadDe(accessToken);
  return exp !== null && exp - ahoraMs < MARGEN_MS;
}
