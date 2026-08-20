/**
 * Productos y solicitudes de credito del cliente final. Espeja `credit` de AtlasBackend.
 *
 * Este modulo es el CABLE de la decision: la app no decide nada sobre el credito. Manda el monto y
 * el plazo al backend, el backend proyecta las features del cliente y llama al motor de decision
 * (`AtlasDecisionEngineBackend`) con ese payload, y devuelve el estado resuelto junto con el
 * `executionId` de la ejecucion que lo produjo. Ese identificador es la prueba de que la decision
 * viene del motor y no de una regla escrita en el telefono.
 */
import { newIdempotencyKey, request } from '../client';

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
};

export const listCreditApplications = (customerId: string) =>
  request<{ customerId: string; applications: CreditApplicationSummary[] }>(`/customers/${customerId}/credit-applications`);

/** Reexportado para que quien construya una solicitud vea de donde sale la clave de reintento. */
export { newIdempotencyKey };
