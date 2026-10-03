import type { LoanSummary } from '../src/api/endpoints/loans';
import { agruparPorMes, buscarPorComercio, coincideConFiltro, estadoDeCompra } from '../src/features/historial-compras';

/**
 * El historial de compras: lo que se decide aquí es lo que la persona lee como verdad sobre su deuda.
 */
function credito(extra: Partial<LoanSummary> & { loanId: string }): LoanSummary {
  return {
    loanCode: `L-${extra.loanId}`,
    currencyCode: 'BOB',
    principalAmount: '100.00',
    annualInterestRate: '0',
    termMonths: 3,
    status: 'active',
    disbursedAt: '2026-09-10T12:00:00Z',
    firstDueDate: '2026-10-10',
    maturityDate: null,
    paidPrincipal: '0',
    paidInterest: '0',
    outstandingPrincipal: '100',
    daysPastDue: 0,
    delinquencyBucket: 'current',
    merchant: { partnerProfileId: 'p1', displayName: 'Farmacia Andina', businessCategory: 'salud' },
    decision: { executionId: null, artifactVersionId: null },
    ...extra,
  } as LoanSummary;
}

describe('estado de una compra', () => {
  it.each([
    [{ status: 'paid_off', daysPastDue: 0 }, 'Pagada'],
    [{ status: 'cancelled', daysPastDue: 0 }, 'Cancelada'],
    [{ status: 'pending_disbursement', daysPastDue: 0 }, 'En trámite'],
    [{ status: 'active', daysPastDue: 0 }, 'Al día'],
    [{ status: 'active', daysPastDue: 12 }, 'En mora'],
  ])('%j → %s', (loan, etiqueta) => {
    expect(estadoDeCompra(loan).texto).toBe(etiqueta);
  });

  it('una pagada NUNCA se lee como en mora, aunque conserve días de atraso viejos', () => {
    expect(estadoDeCompra({ status: 'paid_off', daysPastDue: 30 }).texto).toBe('Pagada');
  });
});

describe('filtros', () => {
  const al_dia = credito({ loanId: '1' });
  const mora = credito({ loanId: '2', daysPastDue: 5 });
  const pagada = credito({ loanId: '3', status: 'paid_off' });
  const cancelada = credito({ loanId: '4', status: 'cancelled' });
  const todas = [al_dia, mora, pagada, cancelada];
  const ids = (filtro: Parameters<typeof coincideConFiltro>[1]) => todas.filter((l) => coincideConFiltro(l, filtro)).map((l) => l.loanId);

  it('todas las trae todas', () => expect(ids('todas')).toEqual(['1', '2', '3', '4']));
  it('al día: sólo activas sin atraso', () => expect(ids('al_dia')).toEqual(['1']));
  it('en mora: sólo activas con atraso', () => expect(ids('mora')).toEqual(['2']));
  it('pagadas: sólo las terminadas de pagar', () => expect(ids('pagadas')).toEqual(['3']));
});

describe('agrupar por mes', () => {
  it('el mes más reciente primero y, dentro, la compra más reciente primero', () => {
    const grupos = agruparPorMes([
      credito({ loanId: 'a', disbursedAt: '2026-08-02T10:00:00Z' }),
      credito({ loanId: 'b', disbursedAt: '2026-09-20T10:00:00Z' }),
      credito({ loanId: 'c', disbursedAt: '2026-09-03T10:00:00Z' }),
    ]);
    expect(grupos.map((g) => g.titulo)).toEqual(['septiembre de 2026', 'agosto de 2026']);
    expect(grupos[0]!.compras.map((l) => l.loanId)).toEqual(['b', 'c']);
  });

  it('sin desembolso usa la primera cuota; sin ninguna fecha va a «Sin fecha», al final', () => {
    const grupos = agruparPorMes([
      credito({ loanId: 'sin', disbursedAt: null, firstDueDate: null }),
      credito({ loanId: 'cuota', disbursedAt: null, firstDueDate: '2026-10-10' }),
      credito({ loanId: 'con', disbursedAt: '2026-09-10T00:00:00Z' }),
    ]);
    expect(grupos.map((g) => g.titulo)).toEqual(['octubre de 2026', 'septiembre de 2026', 'Sin fecha']);
  });

  it('una lista vacía no inventa grupos', () => {
    expect(agruparPorMes([])).toEqual([]);
  });
});

describe('buscar por comercio', () => {
  const lista = [
    credito({ loanId: '1', merchant: { partnerProfileId: 'a', displayName: 'Farmacia Andina', businessCategory: 'salud' } }),
    credito({ loanId: '2', merchant: { partnerProfileId: 'b', displayName: 'Ferretería Ñandú', businessCategory: 'hogar' } }),
    credito({ loanId: '3', merchant: null }),
  ];

  it('sin texto devuelve todo', () => expect(buscarPorComercio(lista, '  ')).toHaveLength(3));
  it('ignora mayúsculas', () => expect(buscarPorComercio(lista, 'FARMA').map((l) => l.loanId)).toEqual(['1']));
  it('ignora tildes en ambos lados', () => expect(buscarPorComercio(lista, 'ferreteria').map((l) => l.loanId)).toEqual(['2']));
  it('una compra sin comercio no revienta la búsqueda', () => expect(buscarPorComercio(lista, 'zzz')).toEqual([]));
});
