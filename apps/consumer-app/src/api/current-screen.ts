/**
 * La pantalla que esta abierta ahora mismo, para que cada llamada al backend diga de donde viene.
 *
 * ## Para que sirve
 *
 * AtlasBackend guarda `x-atlas-flow` en `system_action_logs.origin_screen` y `x-atlas-product` en
 * `origin_client`. Con los dos, una pantalla del catalogo pasa de «existe en el codigo» a «alguien la
 * uso de verdad». Sin esto las pantallas de la app no tenian forma de verificarse: la app era un
 * cliente mudo, y «0 verificadas» se leia como «nadie la usa».
 *
 * ## Por que se manda la ruta CONCRETA
 *
 * `/comercio/123`, no `/comercio/:partnerId`. Quien sabe que segmento es dinamico sin adivinar es el
 * backend, que tiene el catalogo con las plantillas; adivinarlo aqui identificaria mal una pantalla
 * en cuanto un identificador coincida con un segmento fijo. Es la misma regla que el portal interno.
 *
 * ## Que pasa cuando no esta puesta
 *
 * No viaja la cabecera y el backend guarda un nulo, que significa «nadie dijo de donde venia». Nunca
 * se inventa un origen: una tarea de segundo plano no tiene pantalla.
 */
let pantallaActual: string | null = null;

/** Formato aceptado por el backend; lo que no encaje se descarta alli, asi que no se manda. */
const RUTA = /^\/[A-Za-z0-9/_:.-]{0,199}$/;

export function setCurrentScreen(ruta: string | null): void {
  pantallaActual = ruta && RUTA.test(ruta) ? ruta : null;
}

export function getCurrentScreen(): string | null {
  return pantallaActual;
}
