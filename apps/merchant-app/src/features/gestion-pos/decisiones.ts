/**
 * Lo que se MANDA al decidir en cada cola y lo que se le DICE al comercio después, copiado de la web.
 *
 * Fuera de las pantallas para poder probarlo sin montar nada: el cuerpo de la petición es el
 * contrato con el backend (un `reasonCode` donde va `reason` es un 400 en el mostrador) y la frase
 * es lo único que confirma al cajero que su toque sirvió.
 *
 * La regla común a las tres colas: aceptar no lleva motivo; rechazar lo EXIGE. Sin motivo no se
 * manda nada (`null`), igual que el `if (!aceptada && !motivo) return;` de la web.
 */
import type { ComprobanteDePago, PagoInicial, SolicitudDeCompra } from '@/api/servicios/merchantCreditService';
import { formatBob } from './formato';

export type TonoDeDecision = 'success' | 'danger';
export interface AvisoDeDecision {
  tono: TonoDeDecision;
  texto: string;
}

/** Solicitud de compra: `{ accepted, reasonCode? }`. */
export function cuerpoDecisionSolicitud(aceptada: boolean, motivo: string): { accepted: boolean; reasonCode?: string } | null {
  if (!aceptada && !motivo) return null;
  return { accepted: aceptada, ...(aceptada ? {} : { reasonCode: motivo }) };
}

/** Comprobante de cuota y pago inicial: `{ verified, reason? }`. */
export function cuerpoVerificacion(verificado: boolean, motivo: string): { verified: boolean; reason?: string } | null {
  if (!verificado && !motivo) return null;
  return { verified: verificado, ...(verificado ? {} : { reason: motivo }) };
}

export function avisoDecisionSolicitud(solicitud: Pick<SolicitudDeCompra, 'applicationCode'>, aceptada: boolean): AvisoDeDecision {
  return {
    tono: aceptada ? 'success' : 'danger',
    texto: aceptada
      ? `Aceptaste la compra ${solicitud.applicationCode}. El cliente ya puede llevarse el producto.`
      : `Rechazaste la compra ${solicitud.applicationCode}.`,
  };
}

export function avisoDecisionComprobante(comprobante: Pick<ComprobanteDePago, 'claimedAmount' | 'claimCode'>, verificado: boolean): AvisoDeDecision {
  return {
    tono: verificado ? 'success' : 'danger',
    texto: verificado
      ? `Confirmaste el pago de ${formatBob(Number(comprobante.claimedAmount))}. La cuota queda saldada.`
      : `Rechazaste el comprobante ${comprobante.claimCode}.`,
  };
}

export function avisoDecisionPagoInicial(pago: Pick<PagoInicial, 'downPaymentAmount' | 'applicationCode'>, verificado: boolean): AvisoDeDecision {
  return {
    tono: verificado ? 'success' : 'danger',
    texto: verificado
      ? `Confirmaste el pago inicial de ${formatBob(Number(pago.downPaymentAmount))}. El cliente ya lo ve pagado en su app.`
      : `Rechazaste el pago inicial de la compra ${pago.applicationCode}. El cliente verá el motivo.`,
  };
}
