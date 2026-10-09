import { apiBlobUrl, apiRequest } from '@/api/client';
import type { JsonObject } from '@/api/types';

/** Una solicitud esperando la respuesta del comercio. Sin identidad del cliente, a propósito. */
export interface SolicitudDeCompra {
  applicationId: string;
  applicationCode: string;
  status: string;
  requestedAmount: string | number;
  requestedTermMonths: number;
  currencyCode: string;
  businessAcceptance: string | null;
  submittedAt: string;
  /* En qué local y caja nació la compra. Null si no vino de un QR físico. */
  branchName: string | null;
  branchCode: string | null;
  terminalAlias: string | null;
  terminalSerial: string | null;
}

/** El pago inicial de una compra, avisado por el cliente con su comprobante. */
export interface PagoInicial {
  applicationId: string;
  applicationCode: string;
  downPaymentStatus: 'submitted' | 'confirmed' | 'rejected' | string | null;
  downPaymentAmount: string | number | null;
  currencyCode: string;
  payerReference: string | null;
  hasProof: boolean;
  branchName: string | null;
  terminalAlias: string | null;
  terminalSerial?: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

export interface ExpedientePropio {
  partnerId: string;
  legalName: string | null;
  tradeName: string | null;
  status: string;
}

/**
 * Las compras que el cliente pidió en el local y el motor aprobó.
 *
 * No hay ningún método para MODIFICAR una solicitud, y es deliberado: el importe y el esquema de
 * pagos los fijó el motor de decisión al aprobarla. Si el comercio pudiera cambiarlos estaría
 * deshaciendo desde el mostrador la decisión que sostiene el riesgo de la operación.
 */
/** Un comprobante de transferencia esperando la palabra del comercio. */
export interface ComprobanteDePago {
  claimId: string;
  claimCode: string;
  installmentId: string;
  claimedAmount: string | number;
  currencyCode: string;
  payerReference: string | null;
  proofEvidenceId: string | null;
  status: string;
  submittedAt: string;
  decidedAt: string | null;
  /* La sucursal y la caja de la compra que dio el crédito de esta cuota. Null si no vino de un QR físico. */
  branchId?: string | null;
  branchName?: string | null;
  terminalId?: string | null;
  terminalAlias?: string | null;
  terminalSerial?: string | null;
}

export interface CuotaDeCartera {
  installmentId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  amountOutstanding: string;
  status: string;
  daysPastDue: number;
  overdue: boolean;
}

export interface CreditoDeCartera {
  loanId: string;
  loanCode: string;
  currencyCode: string;
  principalAmount: string;
  status: string;
  outstanding: string;
  /* Lo cobrado de este crédito y la comisión de Atlas devengada sobre ello. */
  collected: string;
  commissionAccrued: string;
  /* De qué sucursal y caja salió la compra, y cuándo (Facturación agrupa por crédito con su origen). */
  branchName?: string | null;
  terminalAlias?: string | null;
  terminalSerial?: string | null;
  applicationCode?: string | null;
  originatedAt?: string | null;
  installments: CuotaDeCartera[];
}

/** Una fila del historial del POS: solicitud respondida, pago inicial o cuota ya verificados, con su caja. */
export interface MovimientoDePos {
  kind: 'purchase_request' | 'down_payment' | 'installment_payment';
  id: string;
  code: string;
  amount: number;
  currencyCode: string;
  status: string;
  reference: string | null;
  termMonths: number | null;
  happenedAt: string;
  branchId: string | null;
  branchName: string | null;
  terminalId: string | null;
  terminalAlias: string | null;
  terminalSerial: string | null;
}

export interface FiltroDeHistorial {
  branchId?: string | undefined;
  terminalId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface HistorialDePos {
  items: MovimientoDePos[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  /* El total del FILTRO entero (no de la página): lo que se compara con la caja al cerrar. */
  totals: { count: number; amount: string };
  filters: {
    branches: { branchId: string; branchName: string; branchCode: string }[];
    terminals: { terminalId: string; branchId: string; branchName: string; terminalAlias: string | null; terminalSerial: string }[];
  };
}

/**
 * Un cobro ya recibido, con la comisión que devengó ESE pago.
 *
 * `appliedAmount` es lo que el pago imputó a cuotas y `amount` lo que se declaró: coinciden salvo
 * en un pago revertido, donde lo imputado vuelve a cero y con ello su comisión.
 */
export interface PagoDeCartera {
  paymentId: string;
  paymentCode: string;
  loanId: string;
  loanCode: string;
  receivedAt: string;
  amount: string;
  appliedAmount: string;
  currencyCode: string;
  paymentMethod: string;
  externalReference: string | null;
  status: string;
  reversed: boolean;
  mdrRatePercent: string;
  commissionAccrued: string;
  installmentNumbers: number[];
}

export interface Cartera {
  partnerProfileId: string;
  summary: {
    activeCredits: number;
    totalCredits: number;
    outstanding: string;
    overdueAmount: string;
    overdueInstallments: number;
    collected: string;
    /* Lo que aún no vence, y el reparto de cuotas por estado: mora / pendiente / pagado. */
    pendingAmount: string;
    pendingInstallments: number;
    paidInstallments: number;
    paymentsCount: number;
    proofsAwaitingVerification: number;
    /* La comisión: su tasa (%) y lo devengado a Atlas sobre lo cobrado. */
    mdrRatePercent: string;
    commissionAccrued: string;
  };
  credits: CreditoDeCartera[];
  payments: PagoDeCartera[];
  calendar: { date: string; installments: number; amount: string; overdue: boolean }[];
}

export const merchantCreditService = {
  /** Cuál es mi expediente. El portal no lo sabía: sólo lo conocía justo tras crearlo. */
  misExpedientes() {
    return apiRequest<{ profiles: ExpedientePropio[] }>('/partner-onboarding/mine');
  },

  listar(partnerId: string, soloPendientes = true) {
    return apiRequest<{ partnerProfileId: string; applications: SolicitudDeCompra[] }>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/applications`,
      { query: { onlyPending: soloPendientes ? 'true' : 'false' } },
    );
  },

  /**
   * Los comprobantes que esperan mi confirmación.
   *
   * El dinero de una transferencia entra en la cuenta del comercio, no en la de Atlas: es el único
   * que puede decir si llegó.
   */
  listarComprobantes(partnerId: string, soloPendientes = true) {
    return apiRequest<{ partnerProfileId: string; claims: ComprobanteDePago[] }>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/payment-claims`,
      { query: { onlyPending: soloPendientes ? 'true' : 'false' } },
    );
  },

  /**
   * Los pagos INICIALES de mis compras: el 60 % que el cliente me pagó directo al comprar.
   *
   * Antes el comprobante se quedaba en el teléfono del cliente y yo nunca lo veía. Por defecto sólo los que esperan mi palabra.
   */
  listarPagosIniciales(partnerId: string, soloPendientes = true) {
    return apiRequest<{ partnerProfileId: string; downPayments: PagoInicial[] }>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/down-payments`,
      { query: { onlyPending: soloPendientes ? 'true' : 'false' } },
    );
  },

  /** La imagen del comprobante del pago inicial, como URL de blob. Quien la pida tiene que revocarla al desmontar. */
  pagoInicialImagen(partnerId: string, applicationId: string) {
    return apiBlobUrl(
      `/merchant-credit/${encodeURIComponent(partnerId)}/down-payments/${encodeURIComponent(applicationId)}/proof`,
    );
  },

  /** Confirmar da por recibido el dinero. Rechazar exige motivo y el cliente lo lee en su app. */
  verificarPagoInicial(partnerId: string, applicationId: string, body: JsonObject) {
    return apiRequest<JsonObject>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/down-payments/${encodeURIComponent(applicationId)}/verification`,
      { method: 'POST', body },
    );
  },

  /** El historial del POS: filtrado por sucursal, caja y fechas, más reciente primero y en páginas. */
  historialPos(partnerId: string, filtro: FiltroDeHistorial) {
    const query: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(filtro)) if (valor !== undefined && valor !== '') query[clave] = String(valor);
    return apiRequest<HistorialDePos>(`/merchant-credit/${encodeURIComponent(partnerId)}/pos-history`, { query });
  },

  /** Qué me deben, quién y cuándo. Una sola lectura para créditos, calendario y panel. */
  cartera(partnerId: string) {
    return apiRequest<Cartera>(`/merchant-credit/${encodeURIComponent(partnerId)}/portfolio`);
  },

  /**
   * La imagen del comprobante, como URL de blob lista para un `<img>`.
   *
   * La cola enseñaba el importe declarado y la referencia del banco, pero no el papel: el comercio
   * confirmaba o rechazaba sin ver nada, y confirmar registra un pago real contra el préstamo.
   *
   * Quien la pida tiene que revocarla al desmontar.
   */
  comprobanteImagen(partnerId: string, claimId: string) {
    return apiBlobUrl(
      `/merchant-credit/${encodeURIComponent(partnerId)}/payment-claims/${encodeURIComponent(claimId)}/proof`,
    );
  },

  /** Confirmar registra el pago del préstamo. Rechazar exige motivo. */
  verificarComprobante(partnerId: string, claimId: string, body: JsonObject) {
    return apiRequest<JsonObject>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/payment-claims/${encodeURIComponent(claimId)}/verification`,
      { method: 'POST', body },
    );
  },

  /** `accepted: false` exige motivo: rechazar algo que el motor aprobó tiene que quedar explicado. */
  decidir(partnerId: string, applicationId: string, body: JsonObject) {
    return apiRequest<JsonObject>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/applications/${encodeURIComponent(applicationId)}/acceptance`,
      { method: 'POST', body },
    );
  },
};
