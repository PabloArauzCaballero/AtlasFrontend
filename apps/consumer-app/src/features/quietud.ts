/**
 * ¿La persona se quedó quieta delante de la cámara?
 *
 * La prueba de vida dispara sola (Pablo, 2026-10-06: «automático, y sólo cuando te quedes quieto»). La app no tiene
 * detector de caras ni sensor de movimiento —añadirlos es un módulo nativo y una versión nueva en las tiendas—, así
 * que la quietud se mide con lo que ya hay: fotogramas pequeños de la propia cámara, uno cada medio segundo.
 *
 * ## Por qué el TAMAÑO del JPEG
 *
 * Un JPEG de la misma escena con la misma calidad pesa casi lo mismo de un fotograma a otro (±1-2 %). Si la cabeza o
 * el teléfono se mueven, cambian los bordes y el desenfoque, y el tamaño salta un 5-15 %. No dice DÓNDE está la cara,
 * pero sí si la imagen está quieta, que es lo que hace falta para que la foto salga nítida y en la pose pedida.
 *
 * Puro y aparte para poder probarlo sin cámara.
 */

/** Diferencia relativa máxima entre fotogramas para considerarlos «la misma imagen». */
export const UMBRAL_QUIETUD = 0.035;
/** Cuántos fotogramas seguidos tienen que parecerse: con 3 a ~500 ms, más o menos un segundo quieto. */
export const FOTOGRAMAS_QUIETOS = 3;

/** Verdadero si los últimos `ventana` tamaños están todos a menos de `umbral` (relativo) de su media. */
export function estaQuieto(tamanos: readonly number[], umbral = UMBRAL_QUIETUD, ventana = FOTOGRAMAS_QUIETOS): boolean {
  if (tamanos.length < ventana) return false;
  const ultimos = tamanos.slice(-ventana);
  if (ultimos.some((t) => !Number.isFinite(t) || t <= 0)) return false;
  const media = ultimos.reduce((suma, t) => suma + t, 0) / ultimos.length;
  return ultimos.every((t) => Math.abs(t - media) / media <= umbral);
}

/** Cuánto de quieto va, de 0 a 1, para llenar el contorno mientras la persona se queda quieta. */
export function avanceDeQuietud(tamanos: readonly number[], umbral = UMBRAL_QUIETUD, ventana = FOTOGRAMAS_QUIETOS): number {
  for (let n = Math.min(ventana, tamanos.length); n >= 2; n -= 1) {
    if (estaQuieto(tamanos, umbral, n)) return n / ventana;
  }
  return 0;
}
