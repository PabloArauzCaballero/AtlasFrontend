/**
 * Tipos del dominio de COMPRA de ATLAS (modelo adversarial V3).
 *
 * Estos contratos son deliberadamente los del documento maestro, no una simplificacion: cuando
 * AtlasBackend implemente `purchase_order`, `purchase_commitment`, `payment_schedule` y
 * `payment_instruction`, la app debe poder cambiar el origen de datos sin reescribir pantallas.
 *
 * Lo que la app NUNCA envia (invariantes R18/R33/R35): merchant, sucursal, POS, porcentajes,
 * `financed_amount`, decision o destino de cobro. Solo el token opaco del QR y el monto bruto.
 */
import type { Currency, Minor } from '../domain/money';

export type MerchantContext = {
  organizationId: string;
  tradeName: string;
  branchId: string;
  branchName: string;
  posId: string;
  posName: string;
  city: string;
  industry: string;
  /** Solo para mostrar: el consumidor debe saber en que negocio esta comprando. */
  verified: boolean;
};

/** Sesion efimera creada al escanear el QR interno (`qr_scan_session`). */
export type ScanSession = {
  id: string;
  posQrId: string;
  context: MerchantContext;
  status: 'OPEN' | 'CONSUMED' | 'EXPIRED' | 'RISK_HOLD';
  openedAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type OrderStatus =
  | 'CREATED'
  | 'UNDER_EVALUATION'
  | 'DECLINED'
  | 'REVIEW'
  | 'CREDIT_APPROVED'
  | 'PENDING_MERCHANT_ACCEPTANCE'
  | 'REJECTED_BY_MERCHANT'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'COMMITTED'
  | 'WAITING_INITIAL_PAYMENT'
  | 'ACTIVE'
  | 'COMPLETED';

export type CreditDecision = {
  id: string;
  decisionSeq: number;
  decision: 'APPROVED' | 'DECLINED' | 'REVIEW';
  approvedFinancedAmount: Minor;
  score: number;
  riskGrade: 'A' | 'B' | 'C' | 'D';
  decisionEngineVersion: string;
  policyVersion: string;
  reasonCodes: string[];
  validUntil: string;
  createdAt: string;
};

export type PurchaseOrder = {
  id: string;
  orderCode: string;
  scanSessionId: string;
  context: MerchantContext;
  policyVersionId: string;
  currency: Currency;
  grossAmount: Minor;
  initialPaymentAmount: Minor;
  financedAmount: Minor;
  status: OrderStatus;
  /** Cambia ante cualquier dato economico o contextual relevante (R36). */
  contentHash: string;
  rowVersion: number;
  createdAt: string;
  expiresAt: string;
  decision: CreditDecision | null;
  acceptance: { acceptedAt: string; orderContentHash: string; memberRole: string } | null;
  commitmentId: string | null;
  /**
   * La solicitud de credito REAL que abrio esta orden en el backend, cuando la decidio Atlas.
   *
   * Es lo que ata la orden local con la aceptacion del comercio, que vive en el backend y no en el
   * telefono: sin este id, la app no sabria a que solicitud preguntarle «¿ya la acepto el negocio?»
   * y no tendria mas remedio que adivinar. `null` en las compras de demostracion, que no crean nada
   * en el backend y siguen usando el comercio simulado.
   */
  backendApplicationId: string | null;
};

export type ScheduleItem = {
  id: string;
  sequenceNo: number;
  itemType: 'INITIAL' | 'INSTALLMENT';
  dueAt: string;
  amount: Minor;
  status: 'PENDING' | 'DUE' | 'PAID' | 'OVERDUE' | 'DISPUTED' | 'COVERED';
  resolvedPaidAt: string | null;
};

/**
 * Instruccion de pago: dice DONDE y CUANTO pagar directamente al comercio.
 *
 * Guarda el snapshot del beneficiario y del QR bancario vigente al emitirla. Un cambio posterior
 * del QR del comercio NO altera una instruccion ya emitida (invariante R31).
 */
export type PaymentInstruction = {
  id: string;
  scheduleItemId: string;
  beneficiaryNameSnapshot: string;
  paymentEndpointMaskedSnapshot: string;
  qrPayloadSnapshot: string;
  amount: Minor;
  currency: Currency;
  status: 'ISSUED' | 'EXPIRED' | 'FULFILLED';
  issuedAt: string;
  expiresAt: string;
};

/** Lo que el cliente declara haber pagado. Es EVIDENCIA, no estado financiero (R59). */
export type PaymentClaim = {
  id: string;
  instructionId: string;
  reportedAmount: Minor;
  transactionReference: string | null;
  proofUri: string | null;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  reportedAt: string;
};

/** Estado canonico de una obligacion, derivado de evidencia y reglas (R61). */
export type PaymentResolution = {
  id: string;
  scheduleItemId: string;
  resolutionSeq: number;
  resolvedStatus: 'PAID' | 'NOT_PAID' | 'DISPUTED' | 'PARTIAL';
  resolvedAmount: Minor;
  resolutionSource: 'MERCHANT_CONFIRMATION' | 'OPS_REVIEW' | 'PROVIDER_RECONCILIATION';
  isFinal: boolean;
  createdAt: string;
};

export type PaymentSchedule = {
  id: string;
  purchaseOrderId: string;
  commitmentId: string;
  policyVersionId: string;
  currency: Currency;
  totalAmount: Minor;
  items: ScheduleItem[];
};

export type Dispute = {
  id: string;
  scheduleItemId: string;
  reasonCode: string;
  status: 'OPEN' | 'RESOLVED';
  openedAt: string;
};

/** Linea de credito del consumidor: limite + movimientos + reservas (R51). */
export type CreditLine = {
  id: string;
  currency: Currency;
  approvedLimit: Minor;
  status: 'ACTIVE' | 'SUSPENDED';
  ledger: { id: string; entryType: 'CONSUME' | 'RELEASE' | 'REPAY' | 'INCREASE'; amount: Minor; referenceId: string; createdAt: string }[];
  reservations: { id: string; orderId: string; amount: Minor; status: 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED'; expiresAt: string }[];
};

export type SandboxState = {
  creditLine: CreditLine;
  scanSessions: ScanSession[];
  orders: PurchaseOrder[];
  schedules: PaymentSchedule[];
  instructions: PaymentInstruction[];
  claims: PaymentClaim[];
  resolutions: PaymentResolution[];
  disputes: Dispute[];
};
