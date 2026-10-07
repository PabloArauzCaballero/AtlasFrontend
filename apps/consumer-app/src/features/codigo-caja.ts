/**
 * El código a mano de una caja: 8 caracteres de un alfabeto sin confusiones.
 *
 * Es el MISMO alfabeto que `AtlasBackend/src/modules/partner-onboarding/application/pos-manual-code.ts`: sin 0/O,
 * 1/I/L ni U/V, para que se pueda dictar o leer de un cartel gastado. El campo sólo deja escribir esos símbolos
 * (Pablo, 2026-10-07: «al leer el código escrito debe haber espacio sólo para las letras permitidas»), igual que el
 * PIN sólo deja dígitos. El servidor normaliza de todas formas; esto evita que alguien teclee algo que nunca valdría.
 */
export const ALFABETO_CODIGO_CAJA = '23456789ABCDEFGHJKMNPQRSTWXYZ';
export const LARGO_CODIGO_CAJA = 8;

/** Lo que se teclee o se pegue, llevado a mayúsculas y reducido a los símbolos permitidos (hasta 8). */
export function limpiarCodigoCaja(crudo: string): string {
  let limpio = '';
  for (const caracter of crudo.toUpperCase()) {
    if (ALFABETO_CODIGO_CAJA.includes(caracter)) limpio += caracter;
    if (limpio.length === LARGO_CODIGO_CAJA) break;
  }
  return limpio;
}
