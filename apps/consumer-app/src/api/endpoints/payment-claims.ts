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
import { AtlasApiError } from '../errors';
import { fetchAlAlmacen } from '../almacen';

/**
 * Lo que devuelve `proof-tickets`: la MISMA forma que `UploadTicket` del backend
 * (`document-storage.service.ts`). Las cabeceras firmadas se llaman `requiredHeaders` y llevan
 * `content-type` y `content-length`: si el PUT no las manda tal cual, la firma no cuadra y el
 * almacén responde 403 aunque el archivo sea correcto.
 */
export type ProofTicket = {
  uploadUrl: string;
  storageKey: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
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

/**
 * Sube el comprobante al almacén con la URL firmada. No pasa por la API.
 *
 * Recibe los BYTES que se midieron para pedir el ticket, y las cabeceras van exactamente como las
 * firmó el backend. NUNCA un `Blob` como cuerpo: el `fetch` global es el de Expo
 * (`expo/src/winter`), y con un blob PISA el `Content-Type` con `blob.type`. El backend había
 * firmado `image/jpeg`, viajaba el tipo del archivo leído, y el almacén respondía 403
 * `SignatureDoesNotMatch` (medido en TEST el 2026-10-07, build 38): ningún comprobante llegaba al
 * comercio. Con bytes no hay pisado; es el camino del carnet, el extracto y el chat.
 */
export async function uploadProof(ticket: ProofTicket, bytes: Uint8Array): Promise<void> {
  const respuesta = await fetchAlAlmacen(ticket.uploadUrl, {
    method: ticket.method ?? 'PUT',
    headers: ticket.requiredHeaders,
    body: bytes as unknown as BodyInit,
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
    // R75. El backend todavía no lee la clave en esta ruta (lo frena el estado: 409 al segundo aviso);
    // se manda igual para que, el día que la lea, el reintento ya viaje con ella. Ver `avisoYaEnviado`.
    idempotent: true,
  });

/**
 * El aviso del pago INICIAL de una compra (el 60 %): mismo comprobante que el de una cuota, pero cuelga de la
 * SOLICITUD de crédito porque el préstamo todavía no existe. Sólo se acepta cuando el comercio ya aceptó la
 * venta, y NO da nada por pagado: el comercio lo confirma desde su ERP.
 */
export const submitDownPayment = (
  customerId: string,
  applicationId: string,
  input: { amount: string; payerReference?: string; storageKey: string; contentType: string },
) =>
  request<{ applicationId: string; downPaymentStatus: string | null; downPaymentAmount: string | null }>(
    `/customers/${encodeURIComponent(customerId)}/credit-applications/${encodeURIComponent(applicationId)}/down-payment`,
    // R75, igual que el aviso de una cuota: ver `avisoYaEnviado`.
    { method: 'POST', body: input, idempotent: true },
  );

/*
  El aviso ya estaba en el servidor: es éxito, no fallo (APP-15).

  Con `idempotent: true` el cliente REPITE el POST si se agota el plazo (`reintentos.ts`). Si el
  primer intento sí llegó, el backend —que hoy no lee `x-idempotency-key` en estas dos rutas— contesta
  al segundo con 409 `*_ALREADY_PENDING`: el aviso que la persona mandó está guardado y esperando al
  comercio. Pintarlo como error la haría reintentar un aviso que ya existe. Lo mismo si tocó dos
  veces el botón desde dos pantallas: hay un aviso pendiente, que es lo que quería.
*/
const YA_PENDIENTE = new Set(['DOWN_PAYMENT_ALREADY_PENDING', 'PAYMENT_CLAIM_ALREADY_PENDING']);

export function avisoYaEnviado(error: unknown): boolean {
  return error instanceof AtlasApiError && error.status === 409 && YA_PENDIENTE.has(error.code);
}

