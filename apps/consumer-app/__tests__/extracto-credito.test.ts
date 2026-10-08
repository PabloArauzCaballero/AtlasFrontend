import { armarExtracto } from '../src/features/extracto-credito';
import type { LoanDetail } from '../src/api/endpoints/loans';

/** Pablo (2026-10-08): faltaba «Mi extracto de crédito». */
const credito = {
  loanId: '1',
  loanCode: 'LOAN-1',
  currencyCode: 'BOB',
  principalAmount: '480.00',
  termMonths: 2,
  status: 'active',
  disbursedAt: '2026-10-08T12:53:07Z',
  merchant: { partnerProfileId: '2', displayName: 'Multicenter' },
  payments: [
    { paymentId: 'p1', amount: '245.00', receivedAt: '2026-11-07T10:00:00Z', status: 'posted' },
    { paymentId: 'p2', amount: '99.00', receivedAt: '2026-11-08T10:00:00Z', status: 'reversed' },
  ],
  schedule: [
    { installmentId: 'c1', installmentNumber: 1, dueDate: '2026-11-08', principalAmount: '240', interestAmount: '5', lateFeeAmount: '0', paidPrincipal: '240', paidInterest: '5', paidLateFee: '0', status: 'paid', daysPastDue: 0 },
    { installmentId: 'c2', installmentNumber: 2, dueDate: '2026-12-08', principalAmount: '240', interestAmount: '2.5', lateFeeAmount: '0', paidPrincipal: '0', paidInterest: '0', paidLateFee: '0', status: 'pending', daysPastDue: 0 },
  ],
} as unknown as LoanDetail;

describe('extracto de crédito', () => {
  it('la compra suma, el pago resta y el saldo se arrastra; lo revertido no cuenta', () => {
    const e = armarExtracto([credito], '2026-11-10');
    expect(e.movimientos.map((m) => [m.tipo, m.importe, m.saldo])).toEqual([
      ['pago', -245, 235],
      ['compra', 480, 480],
    ]);
    expect(e.movimientos[1]?.concepto).toBe('Compra en Multicenter · LOAN-1');
    expect(e).toMatchObject({ totalFinanciado: 480, totalPagado: 245, saldo: 235 });
  });

  it('lo que viene: sólo las cuotas sin pagar, con lo que falta de cada una', () => {
    const e = armarExtracto([credito], '2026-11-10');
    expect(e.proximas).toEqual([{ id: 'c2', fecha: '2026-12-08', concepto: 'Cuota 2 de 2 · Multicenter', importe: 242.5, vencida: false }]);
  });

  it('sin créditos, un extracto vacío y en cero', () => {
    expect(armarExtracto([])).toEqual({ movimientos: [], totalFinanciado: 0, totalPagado: 0, saldo: 0, proximas: [] });
  });
});
