import { formatMoney, minor, parseAmountInput, percentageOf, splitEvenly } from '../src/domain/money';

describe('parseAmountInput', () => {
  it('acepta la forma boliviana con separador de miles', () => {
    expect(parseAmountInput('1.234,50')).toBe(123_450);
  });

  it('acepta la forma del teclado numerico', () => {
    expect(parseAmountInput('1234.50')).toBe(123_450);
  });

  it('trata un unico separador con dos decimales como decimal, no como miles', () => {
    expect(parseAmountInput('100,00')).toBe(10_000);
    expect(parseAmountInput('100.00')).toBe(10_000);
  });

  it('rechaza mas decimales de los que admite la moneda', () => {
    expect(parseAmountInput('10,005')).toBeNull();
  });

  it('rechaza texto vacio o no numerico', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
  });
});

describe('splitEvenly', () => {
  it('reparte sin perder ni inventar centavos', () => {
    const parts = splitEvenly(minor(40_000), 3);
    expect(parts).toEqual([13_333, 13_333, 13_334]);
    expect(parts.reduce((total, part) => total + part, 0)).toBe(40_000);
  });

  it('reconcilia exactamente para cualquier importe', () => {
    for (let cents = 1; cents <= 5_000; cents += 7) {
      const parts = splitEvenly(minor(cents), 3);
      expect(parts.reduce((total, part) => total + part, 0)).toBe(cents);
    }
  });
});

describe('percentageOf', () => {
  it('redondea al centavo mas cercano', () => {
    expect(percentageOf(minor(100_001), 0.6)).toBe(60_001);
  });

  it('rechaza una proporcion fuera de rango', () => {
    expect(() => percentageOf(minor(100), 1.5)).toThrow('INVALID_RATIO');
  });
});

describe('formatMoney', () => {
  it('muestra siempre la moneda', () => {
    expect(formatMoney(minor(123_450))).toContain('Bs');
  });
});

describe('minor', () => {
  it('rechaza importes que no sean enteros de centavos', () => {
    expect(() => minor(10.5)).toThrow('AMOUNT_NOT_INTEGER_MINOR_UNITS');
    expect(() => minor(Number.NaN)).toThrow('AMOUNT_NOT_FINITE');
  });
});
