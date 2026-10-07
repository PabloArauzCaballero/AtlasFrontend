/**
 * El pago inicial (el 60 % que se paga directo al comercio), visto desde la app.
 *
 * El estado REAL vive en el backend: el cliente avisa con su comprobante y sólo el comercio lo confirma desde su ERP.
 * Antes el aviso se quedaba en el teléfono (motor local) y el comercio nunca lo veía. Aquí se traduce lo que dice el
 * backend a lo que la pantalla tiene que hacer, sin inventar nada en el teléfono.
 */
import type { CreditApplicationSummary } from '../api/endpoints/credit';

export type EstadoPagoInicial =
  | { tipo: 'sin_avisar' }
  | { tipo: 'esperando_al_comercio' }
  | { tipo: 'confirmado' }
  | { tipo: 'rechazado'; motivo: string };

/** Cada cuántos segundos se vuelve a preguntar mientras se espera al comercio. */
export const ESPERA_ENTRE_CONSULTAS_MS = 5_000;

export function estadoDelPagoInicial(solicitud: Pick<CreditApplicationSummary, 'downPaymentStatus' | 'downPaymentRejectionReason'> | null | undefined): EstadoPagoInicial {
  switch (solicitud?.downPaymentStatus) {
    case 'submitted':
      return { tipo: 'esperando_al_comercio' };
    case 'confirmed':
      return { tipo: 'confirmado' };
    case 'rejected':
      return { tipo: 'rechazado', motivo: solicitud.downPaymentRejectionReason ?? 'El comercio no pudo confirmar tu pago.' };
    default:
      return { tipo: 'sin_avisar' };
  }
}
