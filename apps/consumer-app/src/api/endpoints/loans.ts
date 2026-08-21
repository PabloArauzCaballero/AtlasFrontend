/**
 * Prestamos, gastos, politica de mora y calificacion. Espeja `loans` y `credit-rating` del backend.
 *
 * Todo lo que hay aqui son LECTURAS de lo que el backend ya calculo. La app no reparte gastos por
 * rubro ni decide si alguien esta en mora: ese reparto decide lo que el cliente cree de si mismo, y
 * calcularlo en el telefono haria que dos versiones de la app ensenaran dos repartos del mismo
 * dinero. El unico calculo local es de presentacion —agrupar por comercio lo que ya viene marcado.
 */
import { apiConfig } from '../config';
import { request } from '../client';

/** El comercio donde nacio el credito. `null` en los anteriores al vinculo: no se puede inventar. */
export type LoanMerchant = {
  partnerProfileId: string;
  displayName: string;
  businessCategory: string | null;
};

export type LoanSummary = {
  loanId: string;
  loanCode: string;
  currencyCode: string;
  principalAmount: string;
  annualInterestRate: string;
  termMonths: number;
  status: string;
  disbursedAt: string | null;
  firstDueDate: string | null;
  maturityDate: string | null;
  paidPrincipal: string;
  paidInterest: string;
  outstandingPrincipal: string;
  daysPastDue: number;
  delinquencyBucket: string;
  merchant: LoanMerchant | null;
  decision: { executionId: string | null; artifactVersionId: string | null };
};

export type LoanInstallment = {
  installmentNumber: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  lateFeeAmount: string;
  paidPrincipal: string;
  paidInterest: string;
  paidLateFee: string;
  status: string;
  daysPastDue: number;
};

export type LoanDetail = LoanSummary & {
  schedule: LoanInstallment[];
  payments: Array<{ paymentId: string; amount: string; receivedAt: string; status: string }>;
};

export const listLoans = (customerId: string) => request<{ items: LoanSummary[] }>(`/customers/${customerId}/loans`);

export const getLoan = (loanId: string) => request<LoanDetail>(`/loans/${loanId}`);

export type CategorySpend = {
  category: string;
  financed: number;
  paid: number;
  outstanding: number;
  overdue: number;
  upcoming: number;
  loanCount: number;
  overdueLoanCount: number;
  share: number;
  merchants: Array<{
    partnerProfileId: string | null;
    displayName: string;
    financed: number;
    outstanding: number;
    overdue: number;
    loanCount: number;
  }>;
};

export type SpendingByCategory = {
  customerId: string;
  currencyCode: string;
  generatedAt: string;
  totals: {
    financed: number;
    paid: number;
    outstanding: number;
    overdue: number;
    upcoming: number;
    loanCount: number;
    overdueLoanCount: number;
  };
  nextDueDate: string | null;
  categories: CategorySpend[];
};

export const getSpendingByCategory = (customerId: string) =>
  request<SpendingByCategory>(`/customers/${customerId}/spending-by-category`);

/** Un tramo de la escala de mora, tal y como lo publica la politica vigente. */
export type DelinquencyStage = {
  code: string;
  label: string;
  fromDay: number | null;
  toDay: number | null;
  tone: 'ok' | 'info' | 'warn' | 'danger' | string;
  detail: string;
};

export type DelinquencyPolicy = {
  policyCode: string;
  versionCode: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  /** `regulatorio` o `atlas`. La pantalla NO puede presentar como ley lo que es politica de la casa. */
  source: { kind: string; reference: string | null };
  stages: DelinquencyStage[];
  effectiveFrom: string;
};

export const getDelinquencyPolicy = () => request<DelinquencyPolicy>('/policies/delinquency');

export type CreditRating = {
  customerId: string;
  grade: string;
  gradeLabel: string;
  /** Posicion contada desde la MEJOR categoria. Una letra sola no dice nada sin la escala. */
  position: number | null;
  scaleSize: number | null;
  worstDaysPastDue: number;
  ratedLoanCount: number;
  reason: string | null;
  previousGrade: string | null;
  ratedAt: string;
};

export const getCreditRating = (customerId: string) => request<CreditRating>(`/customers/${customerId}/credit-rating`);

/**
 * La direccion del informe, no su contenido.
 *
 * El PDF lo abre el visor del sistema con la sesion del usuario; traerlo a memoria para volver a
 * escribirlo en disco no anade nada y obliga a mantener una copia del documento en el telefono.
 */
export const spendingReportUrl = (customerId: string) => `${apiConfig.baseUrl}/customers/${customerId}/spending-report.pdf`;

/** Lo que el servidor sabe del comercio detras de un QR de caja. */
export type ResolvedMerchant = {
  partnerProfileId: string;
  branchId: string;
  posTerminalId: string;
  displayName: string;
  businessCategory: string | null;
  verified: true;
};

/**
 * Resuelve el token del QR contra el expediente del comercio.
 *
 * Rechaza con `QR_NOT_RECOGNIZED`, `QR_REVOKED` o `QR_EXPIRED`, que son los tres codigos que la
 * pantalla de escaneo ya traduce a un mensaje con salida.
 */
export const resolveMerchantQr = (token: string) =>
  request<ResolvedMerchant>('/merchant-qr/resolve', { method: 'POST', body: { token } });
