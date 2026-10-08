/**
 * Las compras guardadas en el teléfono, contrastadas con las solicitudes que el servidor conoce.
 *
 * Una compra con solicitud real (`backendApplicationId`) sólo existe mientras exista su solicitud.
 * El teléfono guarda las compras en AsyncStorage y nadie las borraba: si la solicitud desaparecía
 * del servidor (una base de TEST rehecha, otra cuenta en el mismo teléfono) o se cancelaba, la compra
 * seguía en Pagos pidiendo el inicial, y al avisarlo el servidor contestaba
 * `CREDIT_APPLICATION_NOT_FOUND` (Pablo, 2026-10-07: «el crédito fantasma»). Además retenía cupo de
 * la línea local y no dejaba empezar otra compra.
 *
 * Aquí se descartan esas compras junto con todo lo que cuelga de ellas. Las de demostración (sin
 * solicitud) no se tocan: el servidor no sabe nada de ellas por diseño.
 */
import type { SandboxState } from './types';

/** Estados de una solicitud que ya no llevan a ninguna compra. */
const SOLICITUD_TERMINADA = new Set(['cancelled', 'expired']);

export type SolicitudDelServidor = { applicationId: string; status: string };

export function descartarComprasSinSolicitud(
  state: SandboxState,
  solicitudes: readonly SolicitudDelServidor[],
  /**
   * Cuándo salió la consulta. Una compra creada DESPUÉS pudo abrir su solicitud cuando la lista ya
   * venía en camino: no aparecer en esa lista no prueba nada, y se conserva.
   */
  consultadoEn: number,
): SandboxState {
  const vivas = new Set(
    solicitudes.filter((solicitud) => !SOLICITUD_TERMINADA.has(solicitud.status)).map((solicitud) => String(solicitud.applicationId)),
  );
  const fantasmas = new Set(
    state.orders
      .filter(
        (order) =>
          order.backendApplicationId !== null &&
          !vivas.has(String(order.backendApplicationId)) &&
          Date.parse(order.createdAt) < consultadoEn,
      )
      .map((order) => order.id),
  );
  if (fantasmas.size === 0) return state;

  const cuotas = new Set(
    state.schedules.filter((schedule) => fantasmas.has(schedule.purchaseOrderId)).flatMap((schedule) => schedule.items.map((item) => item.id)),
  );
  const instrucciones = new Set(state.instructions.filter((entry) => cuotas.has(entry.scheduleItemId)).map((entry) => entry.id));
  const referencias = new Set([...fantasmas, ...cuotas, ...instrucciones]);

  return {
    ...state,
    creditLine: {
      ...state.creditLine,
      ledger: state.creditLine.ledger.filter((entry) => !referencias.has(entry.referenceId)),
      reservations: state.creditLine.reservations.filter((reservation) => !fantasmas.has(reservation.orderId)),
    },
    orders: state.orders.filter((order) => !fantasmas.has(order.id)),
    schedules: state.schedules.filter((schedule) => !fantasmas.has(schedule.purchaseOrderId)),
    instructions: state.instructions.filter((entry) => !instrucciones.has(entry.id)),
    claims: state.claims.filter((entry) => !instrucciones.has(entry.instructionId)),
    resolutions: state.resolutions.filter((entry) => !cuotas.has(entry.scheduleItemId)),
    disputes: state.disputes.filter((entry) => !cuotas.has(entry.scheduleItemId)),
  };
}
