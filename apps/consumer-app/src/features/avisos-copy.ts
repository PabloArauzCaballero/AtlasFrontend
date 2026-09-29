/**
 * Que avisos le llegan de verdad a la persona, y como se dice.
 *
 * ## Por que existe
 *
 * La app prometia en seis sitios «te avisamos cuando vence una cuota y cuando se aprueba una compra»
 * y mostraba esos avisos como «Siempre activo». Core NO publica `installment.due_soon`,
 * `installment.due_today`, `installment.overdue`, `installment.paid`, `credit_line.approved` ni
 * `purchase.*` para el cliente: los catalogos de plantillas existen, pero nadie emite el evento. Lo
 * unico que hoy sale hacia el cliente es lo de abajo. Un aviso que nunca se envia no puede
 * presentarse como obligatorio ni prometerse: quien confia en el recordatorio deja de mirar sus
 * cuotas y se atrasa.
 *
 * Cuando Core empiece a emitir alguno, se saca de `EVENTOS_SIN_EMISOR` y se anade a
 * `AVISOS_QUE_LLEGAN`, en este archivo y no en cada pantalla.
 */

/** Lo que si se envia hoy, dicho como lo diria la persona. */
export const AVISOS_QUE_LLEGAN = [
  'Cuando reportas un pago y cuando lo confirmamos o lo rechazamos.',
  'Cuando tu identidad queda verificada o no.',
  'Cuando tu cuenta queda activa.',
] as const;

/** Una frase para las pantallas donde cabe una sola linea. */
export const AVISOS_QUE_LLEGAN_RESUMEN =
  'Hoy te avisamos de tus pagos (reportado, confirmado o rechazado), de la verificación de tu identidad y de cuando tu cuenta queda activa.';

/** Lo que NO se envia, dicho igual de claro: las fechas de tus cuotas las ves en Pagos. */
export const AVISO_SIN_RECORDATORIOS =
  'Todavía no te avisamos cuando se acerca o vence una cuota. Revisa tus fechas en la pestaña Pagos.';

/**
 * Eventos del catalogo que Core no emite hacia el cliente. Se reconocen por el codigo que manda el
 * servidor, en cualquiera de sus dos grafias (`installment.due_soon` del bus de eventos y
 * `cuota_por_vencer` del catalogo sembrado).
 */
const EVENTOS_SIN_EMISOR =
  /installment|cuota|due_soon|due_today|overdue|credit_line\.approved|linea_aprobada|purchase\.|compra_aprobada/i;

export function avisoSinEmisor(eventCode: string): boolean {
  return EVENTOS_SIN_EMISOR.test(eventCode);
}
