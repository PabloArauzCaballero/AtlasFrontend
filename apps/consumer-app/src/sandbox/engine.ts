/**
 * Motor del dominio de compra V3, en funciones puras.
 *
 * Implementa la secuencia del documento maestro: escaneo -> sesion con TTL -> monto -> evaluacion
 * de credito -> reserva de linea -> aceptacion del comercio -> `purchase_commitment` atomico ->
 * calendario -> instruccion de pago -> evidencia -> resolucion.
 *
 * Invariantes respetadas explicitamente:
 *   R15 un QR revocado o expirado no abre sesion nueva.
 *   R17 una sesion consumida no origina una segunda orden.
 *   R33/R34 el servidor valida el monto y `initial + financed = gross`.
 *   R36 `content_hash` cambia ante cualquier dato economico o contextual relevante.
 *   R37 el comercio acepta un hash exacto; si la orden cambio, la aceptacion no sirve.
 *   R39 una orden tiene como maximo un commitment.
 *   R41/R42 aprobado no es originado, y aceptado tampoco.
 *   R43/R44 el commit revalida todo y aborta si algo cambio.
 *   R47 la decision debe seguir vigente y cubrir el financiado.
 *   R48 la reserva debe estar ACTIVE y ligada a la misma orden.
 *   R58/R59 la instruccion no prueba el pago, y el comprobante es evidencia, no estado.
 *   R63 el inicial debe resolverse como pagado antes de activar la financiacion.
 */
import { type Minor, addMoney, minor } from '../domain/money';
import { STANDARD_POLICY_V1, assertBreakdownReconciles, buildBreakdown } from '../domain/policy';
import { findPosQrByToken, type PosQr } from './fixtures';
import type {
  CreditDecision,
  CreditLine,
  PaymentInstruction,
  PaymentSchedule,
  PurchaseOrder,
  SandboxState,
  ScanSession,
  ScheduleItem,
} from './types';

/** TTL de la sesion de escaneo. Corto: congela el contexto y limita el replay. */
export const SCAN_SESSION_TTL_MS = 10 * 60 * 1000;
/** TTL de la orden desde su creacion. Vencida no se acepta (R38). */
export const ORDER_TTL_MS = 15 * 60 * 1000;
/** Vigencia de la decision de credito. */
export const DECISION_TTL_MS = 10 * 60 * 1000;
/** Plazo para pagar el inicial una vez originada la compra. */
export const INITIAL_PAYMENT_TTL_MS = 60 * 60 * 1000;

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

/**
 * Hash de contenido de la orden.
 *
 * No pretende ser criptografico: aqui su unico trabajo es cambiar cuando cambie cualquier dato
 * economico o de contexto, que es lo que invalida una aceptacion previa. En el backend debe ser un
 * hash real y calcularse del lado del servidor.
 */
export function computeContentHash(input: {
  organizationId: string;
  posId: string;
  grossAmount: Minor;
  initialPaymentAmount: Minor;
  financedAmount: Minor;
  policyVersionId: string;
  currency: string;
}): string {
  const canonical = [
    input.organizationId,
    input.posId,
    input.grossAmount,
    input.initialPaymentAmount,
    input.financedAmount,
    input.policyVersionId,
    input.currency,
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sha-sim:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export type ScanRejection =
  | { code: 'QR_NOT_RECOGNIZED' }
  | { code: 'QR_REVOKED' }
  | { code: 'QR_EXPIRED' };

/** Resuelve el token opaco a contexto de comercio y abre una sesion con TTL. */
export function openScanSession(token: string, now: number): { session: ScanSession; posQr: PosQr } | ScanRejection {
  const posQr = findPosQrByToken(token);
  if (!posQr) return { code: 'QR_NOT_RECOGNIZED' };
  if (posQr.status === 'REVOKED') return { code: 'QR_REVOKED' };
  if (posQr.status === 'EXPIRED') return { code: 'QR_EXPIRED' };

  return {
    posQr,
    session: {
      id: id('scan'),
      posQrId: posQr.posQrId,
      context: posQr.context,
      status: 'OPEN',
      openedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SCAN_SESSION_TTL_MS).toISOString(),
      consumedAt: null,
    },
  };
}

/**
 * Abre la sesion de compra con el comercio que resolvio EL SERVIDOR.
 *
 * `openScanSession` solo sabe de los QR de demostracion que viven en `fixtures`, asi que un codigo
 * real —el serial de un POS dado de alta en el expediente— resolvia bien contra el backend y
 * moria una linea despues con `QR_NOT_RECOGNIZED`. El comercio existia; el que no lo conocia era
 * el motor local.
 *
 * Aqui la sesion se construye con la respuesta del servidor y no se consulta ninguna fixture. El
 * motor local sigue llevando la sesion de compra —el dominio no existe todavia en el backend—,
 * pero los datos del comercio son los del expediente, que es lo unico que el telefono no puede
 * inventarse.
 */
export function openResolvedScanSession(
  resolved: {
    partnerProfileId: string;
    branchId: string;
    posTerminalId: string;
    displayName: string;
    businessCategory: string | null;
  },
  now: number,
): { session: ScanSession } {
  return {
    session: {
      id: id('scan'),
      posQrId: resolved.posTerminalId,
      context: {
        organizationId: resolved.partnerProfileId,
        tradeName: resolved.displayName,
        branchId: resolved.branchId,
        // El backend todavia no publica el nombre de la sucursal ni la ciudad en esta respuesta.
        // Se deja vacio en vez de rellenarlo con un placeholder: un nombre inventado en la
        // pantalla de confirmacion es peor que un campo que no se muestra.
        branchName: '',
        posId: resolved.posTerminalId,
        posName: '',
        city: '',
        industry: resolved.businessCategory ?? '',
        verified: true,
      },
      status: 'OPEN',
      openedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SCAN_SESSION_TTL_MS).toISOString(),
      consumedAt: null,
    },
  };
}

export const isExpired = (isoDate: string, now: number): boolean => new Date(isoDate).getTime() <= now;

/** Disponible = limite - consumido - reservado. No se confia en un contador mutable (R51). */
export function availableCredit(line: CreditLine): Minor {
  const consumed = line.ledger.reduce((total, entry) => {
    if (entry.entryType === 'CONSUME') return total + entry.amount;
    if (entry.entryType === 'RELEASE' || entry.entryType === 'REPAY') return total - entry.amount;
    if (entry.entryType === 'INCREASE') return total - entry.amount;
    return total;
  }, 0);
  const reserved = line.reservations
    .filter((reservation) => reservation.status === 'ACTIVE')
    .reduce((total, reservation) => total + reservation.amount, 0);
  return minor(Math.max(0, line.approvedLimit - consumed - reserved));
}

/**
 * Crea la orden desde una sesion de escaneo.
 *
 * Consume la sesion: no puede originar una segunda orden (R17). Los importes se calculan aqui con
 * la politica vigente; el cliente solo aporto el monto bruto (R35).
 */
export function createOrder(input: {
  session: ScanSession;
  grossAmount: Minor;
  now: number;
}): { order: PurchaseOrder; session: ScanSession } | { code: 'SESSION_EXPIRED' | 'SESSION_ALREADY_USED' } {
  if (input.session.status === 'CONSUMED') return { code: 'SESSION_ALREADY_USED' };
  if (input.session.status !== 'OPEN' || isExpired(input.session.expiresAt, input.now)) return { code: 'SESSION_EXPIRED' };

  const breakdown = buildBreakdown(input.grossAmount, STANDARD_POLICY_V1);
  assertBreakdownReconciles(breakdown);

  const context = input.session.context;
  const order: PurchaseOrder = {
    id: id('ord'),
    orderCode: `ATL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    scanSessionId: input.session.id,
    context,
    policyVersionId: STANDARD_POLICY_V1.id,
    currency: STANDARD_POLICY_V1.currency,
    grossAmount: breakdown.grossAmount,
    initialPaymentAmount: breakdown.initialPaymentAmount,
    financedAmount: breakdown.financedAmount,
    status: 'UNDER_EVALUATION',
    contentHash: computeContentHash({
      organizationId: context.organizationId,
      posId: context.posId,
      grossAmount: breakdown.grossAmount,
      initialPaymentAmount: breakdown.initialPaymentAmount,
      financedAmount: breakdown.financedAmount,
      policyVersionId: STANDARD_POLICY_V1.id,
      currency: STANDARD_POLICY_V1.currency,
    }),
    rowVersion: 1,
    createdAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + ORDER_TTL_MS).toISOString(),
    decision: null,
    acceptance: null,
    commitmentId: null,
    backendApplicationId: null,
  };

  return { order, session: { ...input.session, status: 'CONSUMED', consumedAt: new Date(input.now).toISOString() } };
}

/**
 * Evaluacion de credito.
 *
 * El criterio del sandbox es deterministico y explicable: alcanza el disponible o no alcanza. Un
 * motor real anade fraude, capacidad y comportamiento, pero la FORMA del resultado —decision,
 * score, grado, reason codes, version de motor y vigencia— es la que el backend debe devolver.
 */
export function evaluateOrder(input: { order: PurchaseOrder; line: CreditLine; now: number }): CreditDecision {
  const available = availableCredit(input.line);
  const covers = available >= input.order.financedAmount;
  const ratio = input.line.approvedLimit > 0 ? input.order.financedAmount / input.line.approvedLimit : 1;

  const reasonCodes = covers
    ? ratio > 0.6
      ? ['LINE_UTILIZATION_HIGH']
      : ['WITHIN_AVAILABLE_LINE']
    : ['INSUFFICIENT_AVAILABLE_LINE'];

  return {
    id: id('dec'),
    decisionSeq: (input.order.decision?.decisionSeq ?? 0) + 1,
    decision: covers ? 'APPROVED' : 'DECLINED',
    approvedFinancedAmount: covers ? input.order.financedAmount : minor(0),
    score: covers ? Math.round(720 - ratio * 120) : 540,
    riskGrade: covers ? (ratio > 0.6 ? 'B' : 'A') : 'D',
    decisionEngineVersion: 'sandbox-engine-1.0.0',
    policyVersion: STANDARD_POLICY_V1.id,
    reasonCodes,
    validUntil: new Date(input.now + DECISION_TTL_MS).toISOString(),
    createdAt: new Date(input.now).toISOString(),
  };
}

export type CommitRejection = {
  code:
    | 'ORDER_EXPIRED'
    | 'ORDER_NOT_ACCEPTED'
    | 'DECISION_MISSING'
    | 'DECISION_EXPIRED'
    | 'DECISION_DOES_NOT_COVER'
    | 'RESERVATION_NOT_ACTIVE'
    | 'CONTENT_HASH_MISMATCH'
    | 'ALREADY_COMMITTED';
};

/**
 * Commit atomico: el unico punto donde la compra queda realmente originada (R41-R44).
 *
 * Revalida TODO otra vez —vigencia de la orden, hash aceptado, decision, reserva— porque entre el
 * scoring y la aceptacion pudo cambiar cualquier cosa. Si algo no cuadra, aborta; no arregla.
 */
export function commitPurchase(input: {
  order: PurchaseOrder;
  line: CreditLine;
  now: number;
}): { order: PurchaseOrder; line: CreditLine; schedule: PaymentSchedule } | CommitRejection {
  const { order, line, now } = input;

  if (order.commitmentId) return { code: 'ALREADY_COMMITTED' };
  if (isExpired(order.expiresAt, now)) return { code: 'ORDER_EXPIRED' };
  if (!order.acceptance) return { code: 'ORDER_NOT_ACCEPTED' };
  if (order.acceptance.orderContentHash !== order.contentHash) return { code: 'CONTENT_HASH_MISMATCH' };
  if (!order.decision) return { code: 'DECISION_MISSING' };
  if (order.decision.decision !== 'APPROVED' || isExpired(order.decision.validUntil, now)) return { code: 'DECISION_EXPIRED' };
  if (order.decision.approvedFinancedAmount < order.financedAmount) return { code: 'DECISION_DOES_NOT_COVER' };

  const reservation = line.reservations.find((item) => item.orderId === order.id && item.status === 'ACTIVE');
  if (!reservation || reservation.amount !== order.financedAmount) return { code: 'RESERVATION_NOT_ACTIVE' };

  const commitmentId = id('cmt');
  const breakdown = buildBreakdown(order.grossAmount, STANDARD_POLICY_V1);
  assertBreakdownReconciles(breakdown);

  const items: ScheduleItem[] = [
    {
      id: id('item'),
      sequenceNo: 0,
      itemType: 'INITIAL',
      dueAt: new Date(now + INITIAL_PAYMENT_TTL_MS).toISOString(),
      amount: breakdown.initialPaymentAmount,
      status: 'DUE',
      resolvedPaidAt: null,
    },
    ...breakdown.installments.map<ScheduleItem>((installment) => ({
      id: id('item'),
      sequenceNo: installment.sequenceNo,
      itemType: 'INSTALLMENT',
      dueAt: new Date(now + installment.dueInDays * 24 * 60 * 60 * 1000).toISOString(),
      amount: installment.amount,
      status: 'PENDING',
      resolvedPaidAt: null,
    })),
  ];

  const schedule: PaymentSchedule = {
    id: id('sch'),
    purchaseOrderId: order.id,
    commitmentId,
    policyVersionId: STANDARD_POLICY_V1.id,
    currency: order.currency,
    totalAmount: order.grossAmount,
    items,
  };

  return {
    schedule,
    order: { ...order, status: 'WAITING_INITIAL_PAYMENT', commitmentId, rowVersion: order.rowVersion + 1 },
    line: {
      ...line,
      reservations: line.reservations.map((item) => (item.id === reservation.id ? { ...item, status: 'COMMITTED' } : item)),
      ledger: [
        ...line.ledger,
        { id: id('led'), entryType: 'CONSUME', amount: order.financedAmount, referenceId: order.id, createdAt: new Date(now).toISOString() },
      ],
    },
  };
}

/**
 * Emite la instruccion de pago con el snapshot del destino verificado del comercio.
 *
 * El snapshot es el punto: si manana el comercio cambia su QR bancario, esta instruccion sigue
 * apuntando al beneficiario que estaba vigente cuando se emitio (R31).
 */
export function issueInstruction(input: {
  item: ScheduleItem;
  posQr: PosQr;
  currency: PaymentInstruction['currency'];
  now: number;
}): PaymentInstruction {
  return {
    id: id('ins'),
    scheduleItemId: input.item.id,
    beneficiaryNameSnapshot: input.posQr.bankQr.beneficiaryName,
    paymentEndpointMaskedSnapshot: input.posQr.bankQr.endpointMasked,
    qrPayloadSnapshot: input.posQr.bankQr.payload,
    amount: input.item.amount,
    currency: input.currency,
    status: 'ISSUED',
    issuedAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Conserva la imagen que subió el partner; no inventa un payload bancario a partir de ella. */
export function issueUploadedQrInstruction(input: {
  item: ScheduleItem;
  qr: { qrId: string; imageDataUrl: string; bankInstitutionCode: string | null; accountNumberMasked: string | null };
  beneficiaryName: string;
  currency: PaymentInstruction['currency'];
  now: number;
}): PaymentInstruction {
  return {
    id: id('ins'),
    scheduleItemId: input.item.id,
    beneficiaryNameSnapshot: input.beneficiaryName,
    paymentEndpointMaskedSnapshot: input.qr.accountNumberMasked ?? input.qr.bankInstitutionCode ?? '—',
    qrPayloadSnapshot: '',
    qrImageDataUrlSnapshot: input.qr.imageDataUrl,
    amount: input.item.amount,
    currency: input.currency,
    status: 'ISSUED',
    issuedAt: new Date(input.now).toISOString(),
    expiresAt: new Date(input.now + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Total pendiente del calendario: lo que la persona todavia debe. */
export function outstandingAmount(schedules: PaymentSchedule[]): Minor {
  return schedules
    .flatMap((schedule) => schedule.items)
    .filter((item) => item.status !== 'PAID' && item.status !== 'COVERED')
    .reduce<Minor>((total, item) => addMoney(total, item.amount), minor(0));
}

/** Proxima obligacion a vencer, que es lo que la pantalla de inicio debe destacar. */
export function nextDueItem(schedules: PaymentSchedule[]): { schedule: PaymentSchedule; item: ScheduleItem } | null {
  const pending = schedules
    .flatMap((schedule) => schedule.items.map((item) => ({ schedule, item })))
    .filter(({ item }) => item.status === 'DUE' || item.status === 'PENDING' || item.status === 'OVERDUE')
    .sort((left, right) => new Date(left.item.dueAt).getTime() - new Date(right.item.dueAt).getTime());
  return pending[0] ?? null;
}

export const emptyState = (approvedLimit: Minor): SandboxState => ({
  creditLine: {
    id: 'line_sandbox',
    currency: 'BOB',
    approvedLimit,
    status: 'ACTIVE',
    ledger: [],
    reservations: [],
  },
  scanSessions: [],
  orders: [],
  schedules: [],
  instructions: [],
  claims: [],
  resolutions: [],
  disputes: [],
});
