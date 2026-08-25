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
