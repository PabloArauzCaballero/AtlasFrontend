/**
 * La MARCA que ocupa el lugar del token de refresco en la web (APP-02).
 *
 * En modo cookie el token de refresco de verdad esta en una cookie `HttpOnly` que JavaScript no ve; en
 * el par del almacen queda esta marca, que no es un secreto. Cambia en cada refresco para que el
 * refresco compartido (`tokenRenovado` en `client.ts`) siga distinguiendo un par viejo de uno nuevo,
 * igual que con los tokens reales.
 *
 * Modulo aparte y sin dependencias: lo usan el cliente HTTP, el almacen web y la sesion, y las pruebas
 * que sustituyen el cliente por un doble no tienen que reimplementarlo.
 */
const PREFIJO_MARCA = 'cookie:';
let generacionDeMarca = 0;

export function marcaDeCookie(generacion = ++generacionDeMarca): string {
  return `${PREFIJO_MARCA}${generacion}`;
}

export function esMarcaDeCookie(refreshToken: string | null | undefined): boolean {
  return typeof refreshToken === 'string' && refreshToken.startsWith(PREFIJO_MARCA);
}
