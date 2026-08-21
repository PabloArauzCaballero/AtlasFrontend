/**
 * Traduccion entre el dominio de compra de la app y la decision de credito del backend.
 *
 * La app NO decide. Manda monto financiado y plazo a `POST /customers/:id/credit-applications`; el
 * backend proyecta las features del cliente, llama al motor de decision con ese payload y devuelve
 * el expediente resuelto. Aqui solo se traduce esa respuesta al vocabulario que ya entienden las
 * pantallas de compra.
 *
 * Tres reglas que no se pueden relajar:
 *
 * 1. `under_review` NUNCA se presenta como rechazo. El backend manda a revision tanto cuando la
 *    politica lo pide como cuando el motor no respondio, y confundir una averia con un «no» le
 *    niega credito a quien cumplia.
 * 2. El importe aprobado es el que pidio la app solo si el backend aprobo. No se infiere ni se
 *    redondea nada en el telefono.
 * 3. `executionId` viaja hasta la pantalla: es la unica prueba verificable de que la decision la
 *    produjo el motor y no una regla local.
 */
import { createCreditApplication, listCreditProducts, type CreditApplication, type CreditProduct } from '../api/endpoints/credit';
import { minor, toMajorNumber, type Minor } from '../domain/money';
import type { CreditDecision } from '../sandbox/types';

/** Plazo del producto BNPL de Atlas: 3 cuotas cada 14 dias ≈ 2 meses de calendario. */
const BNPL_TERM_MONTHS = 2;

export type LiveDecisionFailure = { kind: 'unavailable'; code: string; message: string };

export type LiveDecisionResult =
  | { kind: 'decided'; decision: CreditDecision; application: CreditApplication }
  | LiveDecisionFailure;

/**
 * Elige el producto con el que se pide la decision.
 *
 * Se toma el primero cuyo rango admite el importe. Si ninguno lo admite, no se fuerza una solicitud
 * que el backend rechazaria por rango: eso ensuciaria el expediente del cliente con intentos que la
 * app sabia de antemano que no eran presentables.
 */
export function pickProductFor(products: readonly CreditProduct[], financedMajor: number): CreditProduct | null {
  return (
    products.find((product) => {
      const min = Number(product.minAmount);
      const max = Number(product.maxAmount);
      return financedMajor >= min && financedMajor <= max;
    }) ?? null
  );
}

export function mapApplicationToDecision(input: {
  application: CreditApplication;
  financedAmount: Minor;
  decisionSeq: number;
  now: number;
  ttlMs: number;
}): CreditDecision {
  const { application, financedAmount, decisionSeq, now, ttlMs } = input;
  const status = (application.status ?? '').toLowerCase();
  const decision: CreditDecision['decision'] =
    status === 'approved' ? 'APPROVED' : status === 'rejected' ? 'DECLINED' : 'REVIEW';

  return {
    id: application.applicationCode,
    decisionSeq,
    decision,
    approvedFinancedAmount: decision === 'APPROVED' ? financedAmount : minor(0),
    // El score real vive en el expediente del backend y no se expone al cliente final. La app no
    // inventa uno: publica 0 y deja que la trazabilidad la aporte `executionId`.
    score: 0,
    riskGrade: decision === 'APPROVED' ? 'A' : decision === 'DECLINED' ? 'D' : 'C',
    decisionEngineVersion: application.executionId ? `atlas-decision-engine:${application.executionId}` : 'atlas-backend',
    policyVersion: application.decisionMode ?? 'decision_engine',
    reasonCodes: [application.decisionMode ?? 'decision_engine'],
    validUntil: new Date(now + ttlMs).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Pide al backend la decision para un importe financiado.
 *
 * Devuelve `unavailable` ante cualquier fallo de red o de contrato. Quien llame decide que hacer,
 * pero no puede convertirlo en rechazo: no se llego a preguntar.
 */
export async function requestLiveDecision(input: {
  customerId: string;
  financedAmount: Minor;
  decisionSeq: number;
  now: number;
  ttlMs: number;
  purposeCode?: string;
}): Promise<LiveDecisionResult> {
  const financedMajor = toMajorNumber(input.financedAmount);

  let products: CreditProduct[];
  try {
    const response = await listCreditProducts(input.customerId);
    products = response.products ?? [];
  } catch (error) {
    return { kind: 'unavailable', code: 'CREDIT_PRODUCTS_UNAVAILABLE', message: messageOf(error) };
  }

  const product = pickProductFor(products, financedMajor);
  if (!product) {
    return {
      kind: 'unavailable',
      code: 'NO_PRODUCT_FOR_AMOUNT',
      message: 'Ningún producto de crédito activo admite este importe.',
    };
  }

  try {
    const application = await createCreditApplication(input.customerId, {
      productId: product.productId,
      requestedAmount: financedMajor,
      requestedTermMonths: BNPL_TERM_MONTHS,
      purposeCode: input.purposeCode ?? 'bnpl_purchase',
    });
    return {
      kind: 'decided',
      application,
      decision: mapApplicationToDecision({
        application,
        financedAmount: input.financedAmount,
        decisionSeq: input.decisionSeq,
        now: input.now,
        ttlMs: input.ttlMs,
      }),
    };
  } catch (error) {
    return { kind: 'unavailable', code: codeOf(error), message: messageOf(error) };
  }
}

function codeOf(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && code.length > 0 ? code : 'CREDIT_APPLICATION_FAILED';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
