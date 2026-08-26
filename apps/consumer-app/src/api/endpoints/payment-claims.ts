/**
 * Avisar que se pagó una cuota por transferencia, con su comprobante.
 *
 * Son dos pasos y no uno a propósito: el comprobante viaja DIRECTO al almacén con una URL firmada
 * que el servidor emite, y sólo entonces se manda el aviso con su clave. Meter la imagen dentro
 * del JSON habría hecho pasar varios megas por la API en cada intento, y un reintento por señal
 * mala los habría vuelto a pasar enteros.
 *
 * Nada de esto salda la cuota: la salda el comercio cuando ve el dinero en su cuenta.
 */
import { request } from '../client';

export type ProofTicket = {
  uploadUrl: string;
  storageKey: string;
  headers?: Record<string, string>;
};

export type PaymentClaim = {
  claimId: string;
  claimCode: string;
  status: string;
  installmentId: string;
  submittedAt: string;
};

/**
 * Donde y cuanto pagar: el QR bancario REAL del comercio.
 *
 * La app decia «se paga al QR bancario del comercio» y no ensenaba ninguno, porque no existia
 * ninguna ruta que lo devolviera. El QR que se veia en la pantalla de pago salia del simulador
 * local: un codigo de demostracion que ningun banco sabe leer.
 *
 * La imagen viaja EMBEBIDA como `data:` y no como enlace a proposito. Un `<Image source={{uri}}>`
 * no manda cabeceras, asi que una ruta autenticada daria 401 y una URL prefirmada seria un enlace
 * que funciona sin sesion. Un QR pesa decenas de kilobytes: cabe en la respuesta que ya se pide.
 */
export type PaymentQr = {
  qrId: string;
  bankInstitutionCode: string | null;
  accountNumberMasked: string | null;
  /** Prefijo del hash del archivo: identifica la evidencia sin publicarla entera. */
  fingerprint: string;
  status: string;
  contentType: string;
  imageDataUrl: string;
};

export type PaymentInstruction = {
  installmentId: string;
  loanId: string;
  loanCode: string;
  installmentNumber: number;
  dueDate: string;
  currencyCode: string;
  amountDue: string;
  amountOutstanding: string;
  status: string;
  merchant: { partnerProfileId: string; displayName: string } | null;
  paymentQr: PaymentQr | null;
  /**
   * Por que no hay QR, cuando no lo hay.
   *
   * Se dice con precision para que la pantalla no mande a reclamar al sitio equivocado: que el
   * comercio no haya subido su QR lo resuelve el comercio, no Atlas.
   */
  paymentQrUnavailableReason: 'LOAN_WITHOUT_PARTNER' | 'PARTNER_HAS_NO_PAYMENT_QR' | 'PAYMENT_QR_OBJECT_MISSING' | null;
  /** Lo ya avisado de esta cuota. Sin esto la pantalla ofreceria avisar dos veces del mismo pago. */
  openClaim: {
    claimId: string;
    claimCode: string;
    status: string;
    submittedAt: string;
    rejectionReason: string | null;
  } | null;
};

export const getPaymentInstruction = (customerId: string, installmentId: string) =>
  request<PaymentInstruction>(
    `/mobile/customers/${encodeURIComponent(customerId)}/payment-claims/instructions/${encodeURIComponent(installmentId)}`,
  );

/** Permiso para subir el comprobante. Caduca: se pide justo antes de subir. */
export const requestProofTicket = (customerId: string, input: { contentType: string; sizeBytes: number }) =>
  request<ProofTicket>(`/mobile/customers/${encodeURIComponent(customerId)}/payment-claims/proof-tickets`, {
    method: 'POST',
    body: input,
  });

/** Sube la imagen al almacén con la URL firmada. No pasa por la API. */
export async function uploadProof(ticket: ProofTicket, fileUri: string, contentType: string): Promise<void> {
  const blob = await (await fetch(fileUri)).blob();
  const respuesta = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, ...(ticket.headers ?? {}) },
    body: blob,
  });
  if (!respuesta.ok) {
    throw new Error(`No se pudo subir el comprobante (HTTP ${respuesta.status}).`);
  }
}

/** El aviso. Queda esperando a que el comercio lo confirme. */
export const submitPaymentClaim = (
  customerId: string,
  input: {
    installmentId: string;
    amount: string;
    payerReference?: string;
    storageKey: string;
    contentType: string;
  },
) =>
  request<PaymentClaim>(`/mobile/customers/${encodeURIComponent(customerId)}/payment-claims`, {
    method: 'POST',
    body: input,
  });
