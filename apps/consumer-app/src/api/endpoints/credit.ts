/**
 * Productos y solicitudes de credito del cliente final. Espeja `credit` de AtlasBackend.
 *
 * Este modulo es el CABLE de la decision: la app no decide nada sobre el credito. Manda el monto y
 * el plazo al backend, el backend proyecta las features del cliente y llama al motor de decision
 * (`AtlasDecisionEngineBackend`) con ese payload, y devuelve el estado resuelto junto con el
 * `executionId` de la ejecucion que lo produjo. Ese identificador es la prueba de que la decision
 * viene del motor y no de una regla escrita en el telefono.
 */
import { newIdempotencyKey, request, type RequestOptions } from '../client';

export type CreditProduct = {
  productId: string;
  productCode: string;
  productName: string;
  currencyCode: string;
  minAmount: string;
  maxAmount: string;
  minTermMonths: number;
  maxTermMonths: number;
  annualInterestRate?: string | null;
  requiresManualReview?: boolean;
};

export type CreditProductsResponse = { customerId: string; eligible?: boolean; products: CreditProduct[] };

export const listCreditProducts = (customerId: string) =>
  request<CreditProductsResponse>(`/customers/${customerId}/credit-products`);

export type CreateCreditApplicationInput = {
  productId: string;
  requestedAmount: number;
  requestedTermMonths: number;
  purposeCode?: string;
  /**
   * El comercio donde nace la compra, resuelto antes por el lector de QR.
   *
   * Sin este dato la solicitud se crea igual y el motor la decide, pero queda HUERFANA de comercio:
   * el portal del comercio, que lista lo que espera su respuesta, nunca la ve. Ese era el eslabon
   * que faltaba para que el negocio pudiera aceptar desde su ERP la compra que el cliente acaba de
   * pedir. El backend valida que el expediente exista y este aprobado; aqui solo viaja.
   */
  partnerProfileId?: string;
  /**
   * La caja del comercio donde se escaneo el QR. De ella cuelga la sucursal: es lo que permite que
   * el portal del negocio diga en que local se hizo la venta. El backend comprueba que el terminal
   * sea de ese comercio antes de guardarlo.
   */
  posTerminalId?: string;
};

/**
 * Estado del expediente tal y como lo deja el backend tras consultar al motor.
 *
 * `under_review` incluye el caso «el motor no respondio»: el backend NO lo convierte en rechazo, y
 * la app tampoco puede presentarlo como tal. `decisionMode` es lo que distingue una revision por
 * politica (`decision_engine`) de una averia (`engine_unavailable_manual`).
 */
export type CreditApplication = {
  applicationId: string;
  applicationCode: string;
  customerId: string;
  productCode: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'under_review' | string;
  requestedAmount: string;
  requestedTermMonths: number;
  currencyCode: string;
  submittedAt: string;
  purposeCode: string | null;
  decisionMode?: string | null;
  executionId?: string | null;
};

export const createCreditApplication = (customerId: string, input: CreateCreditApplicationInput) =>
  request<CreditApplication>(`/customers/${customerId}/credit-applications`, {
    method: 'POST',
    body: input,
    idempotent: true,
  });

export type CreditApplicationSummary = {
  applicationId: string;
  applicationCode: string;
  status: string;
  requestedAmount: string;
  requestedTermMonths: number;
  currencyCode: string;
  submittedAt: string;
  decidedAt: string | null;
  decisionReasonCode: string | null;
  /**
   * Si el comercio ya respondió la venta que el motor aprobó: `pending` mientras la mira, `accepted`
   * cuando la confirma, `declined` si la rechaza. `null` cuando no aplica. Es lo que la app espera
   * antes de dejar pagar el inicial: aprobar el crédito es el paso de Atlas; confirmar la venta, el
   * del comercio.
   */
  businessAcceptance?: 'pending' | 'accepted' | 'declined' | null;
  businessAcceptanceAt?: string | null;
};

export const listCreditApplications = (customerId: string, origen: Pick<RequestOptions, 'sinPantalla'> = {}) =>
  request<{ customerId: string; applications: CreditApplicationSummary[] }>(
    `/customers/${customerId}/credit-applications`,
    origen,
  );

/** Reexportado para que quien construya una solicitud vea de donde sale la clave de reintento. */
export { newIdempotencyKey };
