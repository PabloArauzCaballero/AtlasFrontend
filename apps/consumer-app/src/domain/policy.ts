/**
 * Politica de producto crediticio versionada (`credit_product_policy_version` del modelo V3).
 *
 * El 60/40, las 3 cuotas y los 14 dias NO se escriben como constantes sueltas dentro de una
 * pantalla: son una VERSION de politica. Una compra ya originada debe poder reconstruir con que
 * reglas se calculo, aunque manana el producto cambie.
 *
 * El calculo vive aqui y no en el servidor SOLO para poder anticipar el desglose mientras el
 * cliente escribe el monto. El importe autoritativo es siempre el que devuelve el backend
 * (invariante R35: el frontend no envia `financed_amount`).
 */
import { type Currency, type Minor, formatMoney, minor, percentageOf, splitEvenly } from './money';

export type ProductPolicyVersion = {
  id: string;
  productCode: string;
  versionNumber: number;
  currency: Currency;
  /** Base 1: 0.6 = 60%. */
  initialPaymentPct: number;
  financedPct: number;
  installmentCount: number;
  frequencyDays: number;
  minAmount: Minor;
  maxAmount: Minor;
  effectiveFrom: string;
};

/** Politica estandar descrita en el contexto maestro de ATLAS (60/40, 3 cuotas, 14 dias). */
export const STANDARD_POLICY_V1: ProductPolicyVersion = {
  id: 'policy-bnpl-60-40-v1',
  productCode: 'BNPL_60_40',
  versionNumber: 1,
  currency: 'BOB',
  initialPaymentPct: 0.6,
  financedPct: 0.4,
  installmentCount: 3,
  frequencyDays: 14,
  minAmount: minor(10_000), // Bs 100,00
  maxAmount: minor(1_500_000), // Bs 15.000,00
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

export type PurchaseBreakdown = {
  policyVersionId: string;
  currency: Currency;
  grossAmount: Minor;
  initialPaymentAmount: Minor;
  financedAmount: Minor;
  installments: { sequenceNo: number; amount: Minor; dueInDays: number }[];
};

export type AmountRejection =
  | { code: 'AMOUNT_REQUIRED' }
  | { code: 'AMOUNT_BELOW_MINIMUM'; minAmount: Minor }
  | { code: 'AMOUNT_ABOVE_MAXIMUM'; maxAmount: Minor };

/**
 * Valida el monto contra la politica vigente. Devuelve el motivo tipado en vez de un booleano:
 * la pantalla necesita explicar POR QUE, no solo pintar el campo de rojo.
 */
export function validateGrossAmount(amount: Minor | null, policy: ProductPolicyVersion): AmountRejection | null {
  if (amount === null || amount <= 0) return { code: 'AMOUNT_REQUIRED' };
  if (amount < policy.minAmount) return { code: 'AMOUNT_BELOW_MINIMUM', minAmount: policy.minAmount };
  if (amount > policy.maxAmount) return { code: 'AMOUNT_ABOVE_MAXIMUM', maxAmount: policy.maxAmount };
  return null;
}

export function describeAmountRejection(rejection: AmountRejection, policy: ProductPolicyVersion): string {
  switch (rejection.code) {
    case 'AMOUNT_REQUIRED':
      return 'Ingresa el monto total de tu compra.';
    case 'AMOUNT_BELOW_MINIMUM':
      return `El monto minimo financiable es ${formatMoney(rejection.minAmount, policy.currency)}.`;
    case 'AMOUNT_ABOVE_MAXIMUM':
      return `El monto maximo por compra es ${formatMoney(rejection.maxAmount, policy.currency)}.`;
  }
}

/**
 * Desglose 60/40 con reconciliacion exacta.
 *
 * `initial + financed = gross` sin excepciones (invariante R34), y la suma de las cuotas es
 * exactamente el financiado (invariante R87).
 */
export function buildBreakdown(grossAmount: Minor, policy: ProductPolicyVersion): PurchaseBreakdown {
  const initialPaymentAmount = percentageOf(grossAmount, policy.initialPaymentPct);
  const financedAmount = minor(grossAmount - initialPaymentAmount);
  const amounts = splitEvenly(financedAmount, policy.installmentCount);

  return {
    policyVersionId: policy.id,
    currency: policy.currency,
    grossAmount,
    initialPaymentAmount,
    financedAmount,
    installments: amounts.map((amount, index) => ({
      sequenceNo: index + 1,
      amount,
      dueInDays: policy.frequencyDays * (index + 1),
    })),
  };
}

/** Comprobacion defensiva usada por los tests y por el sandbox antes de originar. */
export function assertBreakdownReconciles(breakdown: PurchaseBreakdown): void {
  if (breakdown.initialPaymentAmount + breakdown.financedAmount !== breakdown.grossAmount) {
    throw new Error('BREAKDOWN_DOES_NOT_RECONCILE_GROSS');
  }
  const sum = breakdown.installments.reduce((total, item) => total + item.amount, 0);
  if (sum !== breakdown.financedAmount) throw new Error('BREAKDOWN_DOES_NOT_RECONCILE_FINANCED');
}
