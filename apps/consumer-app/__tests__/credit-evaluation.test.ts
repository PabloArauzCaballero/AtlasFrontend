import { minor, toMajorNumber } from '../src/domain/money';
import { mapApplicationToDecision, pickProductFor } from '../src/features/credit-evaluation';
import type { CreditApplication, CreditProduct } from '../src/api/endpoints/credit';

const product = (over: Partial<CreditProduct>): CreditProduct => ({
  productId: '1',
  productCode: 'bnpl_estandar',
  productName: 'BNPL estandar',
  currencyCode: 'BOB',
  minAmount: '50',
  maxAmount: '2000',
  minTermMonths: 1,
  maxTermMonths: 6,
  ...over,
});

const application = (over: Partial<CreditApplication>): CreditApplication => ({
  applicationId: '10',
  applicationCode: 'CRA-0001',
  customerId: '1',
  productCode: 'bnpl_estandar',
  status: 'approved',
  requestedAmount: '400.00',
  requestedTermMonths: 2,
  currencyCode: 'BOB',
  submittedAt: '2026-08-19T00:00:00.000Z',
  purposeCode: 'bnpl_purchase',
  ...over,
});

describe('toMajorNumber', () => {
  it('convierte centavos a bolivianos sin perder el importe', () => {
    expect(toMajorNumber(minor(40_000))).toBe(400);
    expect(toMajorNumber(minor(1))).toBe(0.01);
  });
});

describe('pickProductFor', () => {
  it('elige el producto cuyo rango admite el importe', () => {
    const products = [product({ productId: '1', minAmount: '1000', maxAmount: '5000' }), product({ productId: '2', minAmount: '50', maxAmount: '900' })];
    expect(pickProductFor(products, 400)?.productId).toBe('2');
  });

  it('no fuerza una solicitud que el backend rechazaria por rango', () => {
    expect(pickProductFor([product({ minAmount: '1000', maxAmount: '5000' })], 400)).toBeNull();
    expect(pickProductFor([], 400)).toBeNull();
  });
});

describe('mapApplicationToDecision', () => {
  const base = { financedAmount: minor(40_000), decisionSeq: 1, now: 1_000, ttlMs: 600_000 };

  it('aprueba solo por el importe pedido y no por uno inventado en el telefono', () => {
    const decision = mapApplicationToDecision({ ...base, application: application({ status: 'approved' }) });
    expect(decision.decision).toBe('APPROVED');
    expect(decision.approvedFinancedAmount).toBe(40_000);
  });

  it('no aprueba importe alguno cuando el backend rechaza', () => {
    const decision = mapApplicationToDecision({ ...base, application: application({ status: 'rejected' }) });
    expect(decision.decision).toBe('DECLINED');
    expect(decision.approvedFinancedAmount).toBe(0);
  });

  it('under_review NO es rechazo: ni siquiera cuando el motor no respondio', () => {
    const porPolitica = mapApplicationToDecision({ ...base, application: application({ status: 'under_review', decisionMode: 'decision_engine' }) });
    const porAveria = mapApplicationToDecision({
      ...base,
      application: application({ status: 'under_review', decisionMode: 'engine_unavailable_manual' }),
    });

    expect(porPolitica.decision).toBe('REVIEW');
    expect(porAveria.decision).toBe('REVIEW');
    expect(porAveria.approvedFinancedAmount).toBe(0);
    // La averia se puede distinguir de la politica: es la diferencia entre «no llegue a preguntar»
    // y «la politica pide que lo mire una persona», y cada una se comunica distinto.
    expect(porAveria.policyVersion).toBe('engine_unavailable_manual');
  });

  it('un estado que la app no conoce nunca se lee como aprobacion', () => {
    expect(mapApplicationToDecision({ ...base, application: application({ status: 'submitted' }) }).decision).toBe('REVIEW');
    expect(mapApplicationToDecision({ ...base, application: application({ status: 'counter_offer' }) }).decision).toBe('REVIEW');
  });

  it('arrastra la ejecucion del motor para que la decision sea auditable', () => {
    const decision = mapApplicationToDecision({ ...base, application: application({ executionId: 'exec-42' }) });
    expect(decision.decisionEngineVersion).toContain('exec-42');
    expect(decision.id).toBe('CRA-0001');
  });

  it('la vigencia sale del reloj de la app y del TTL, no del servidor', () => {
    const decision = mapApplicationToDecision({ ...base, application: application({}) });
    expect(decision.validUntil).toBe(new Date(1_000 + 600_000).toISOString());
  });
});
