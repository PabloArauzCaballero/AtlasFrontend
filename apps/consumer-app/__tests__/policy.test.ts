import { minor } from '../src/domain/money';
import { STANDARD_POLICY_V1, assertBreakdownReconciles, buildBreakdown, validateGrossAmount } from '../src/domain/policy';

describe('buildBreakdown', () => {
  it('reproduce el ejemplo del documento maestro para Bs 1.000', () => {
    const breakdown = buildBreakdown(minor(100_000), STANDARD_POLICY_V1);

    expect(breakdown.initialPaymentAmount).toBe(60_000);
    expect(breakdown.financedAmount).toBe(40_000);
    expect(breakdown.installments.map((item) => item.amount)).toEqual([13_333, 13_333, 13_334]);
    expect(breakdown.installments.map((item) => item.dueInDays)).toEqual([14, 28, 42]);
  });

  it('cumple initial + financed = gross para cualquier importe (R34)', () => {
    for (let cents = 10_000; cents <= 300_000; cents += 137) {
      const breakdown = buildBreakdown(minor(cents), STANDARD_POLICY_V1);
      expect(breakdown.initialPaymentAmount + breakdown.financedAmount).toBe(cents);
    }
  });

  it('cumple que las cuotas suman el financiado (R87)', () => {
    for (let cents = 10_000; cents <= 300_000; cents += 211) {
      const breakdown = buildBreakdown(minor(cents), STANDARD_POLICY_V1);
      expect(() => assertBreakdownReconciles(breakdown)).not.toThrow();
    }
  });
});

describe('validateGrossAmount', () => {
  it('exige un monto', () => {
    expect(validateGrossAmount(null, STANDARD_POLICY_V1)).toEqual({ code: 'AMOUNT_REQUIRED' });
    expect(validateGrossAmount(minor(0), STANDARD_POLICY_V1)).toEqual({ code: 'AMOUNT_REQUIRED' });
  });

  it('aplica el minimo y el maximo de la politica', () => {
    expect(validateGrossAmount(minor(9_999), STANDARD_POLICY_V1)?.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(validateGrossAmount(minor(1_500_001), STANDARD_POLICY_V1)?.code).toBe('AMOUNT_ABOVE_MAXIMUM');
    expect(validateGrossAmount(minor(100_000), STANDARD_POLICY_V1)).toBeNull();
  });
});
