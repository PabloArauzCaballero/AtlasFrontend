/**
 * La lógica de Cartera y facturación: formatos, cestas de estado, agrupación por crédito, cuadre de
 * cobros y el alcance del comercio. Son las reglas de `MerchantPortfolioScreen` y
 * `MerchantBillingScreen` de la web; si alguna se rompe, la app pinta una deuda en el color equivocado.
 */
import type { CreditoDeCartera, CuotaDeCartera, PagoDeCartera } from '@/api/servicios/merchantCreditService';
import {
  codigoCorto,
  creditosConCuotas,
  cuadreDeCobros,
  cuotasPlanas,
  estadoDeCredito,
  estadoDeCuota,
  estadoDeFactura,
  estadoDelCargo,
  nombreDeCaja,
  textoDeOrigen,
} from '@/features/cartera/estados';
import { bob, cuotasTexto, fechaCorta, formatBob, formatDate, tasaCorta, textoDeFallo } from '@/features/cartera/formato';
import { MENSAJE_PERSONAL_INTERNO, resolverAlcance } from '@/features/cartera/use-merchant-scope';

const NBSP = / /g;
const plano = (texto: string) => texto.replace(NBSP, ' ');

function cuota(parcial: Partial<CuotaDeCartera>): CuotaDeCartera {
  return {
    installmentId: 'c1',
    installmentNumber: 1,
    dueDate: '2026-10-01',
    amountDue: '100.00',
    amountPaid: '0.00',
    amountOutstanding: '100.00',
    status: 'PENDING',
    daysPastDue: 0,
    overdue: false,
    ...parcial,
  };
}

function credito(parcial: Partial<CreditoDeCartera>): CreditoDeCartera {
  return {
    loanId: 'l1',
    loanCode: 'LOAN-1',
    currencyCode: 'BOB',
    principalAmount: '300.00',
    status: 'ACTIVE',
    outstanding: '300.00',
    collected: '0.00',
    commissionAccrued: '0.00',
    installments: [],
    ...parcial,
  };
}

describe('formato', () => {
  it('escribe bolivianos como la web (es-BO)', () => {
    expect(plano(formatBob(1234.5))).toBe('Bs 1.234,50');
    expect(plano(bob('99.9'))).toBe('Bs 99,90');
    expect(plano(bob(undefined))).toBe('Bs 0,00');
  });

  it('no mueve un día las fechas sin hora (La Paz es UTC-4)', () => {
    expect(formatDate('2026-01-01')).toMatch(/1 ene/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('no-es-fecha')).toBe('—');
  });

  it('pinta el día de cobro corto y aguanta un instante con hora', () => {
    expect(fechaCorta('2026-10-09')).toMatch(/09 oct/);
    expect(fechaCorta('2026-10-09T00:00:00.000Z')).toMatch(/09 oct/);
    expect(fechaCorta('basura')).toBe('basura');
  });

  it('usa el mensaje del error o el respaldo', () => {
    expect(textoDeFallo(new Error('falló'), 'respaldo')).toBe('falló');
    expect(textoDeFallo('x', 'respaldo')).toBe('respaldo');
  });
});

describe('cestas de estado', () => {
  it('una cuota es pagada, en mora o pendiente', () => {
    expect(estadoDeCuota(cuota({ amountOutstanding: '0' }))).toBe('pagado');
    expect(estadoDeCuota(cuota({ overdue: true }))).toBe('mora');
    expect(estadoDeCuota(cuota({}))).toBe('pendiente');
  });

  it('un cargo vencido por fecha está en mora aunque nadie lo haya marcado', () => {
    expect(estadoDelCargo('ISSUED', 50, '2026-10-01', '2026-10-09')).toBe('mora');
    expect(estadoDelCargo('ISSUED', 50, '2026-10-20', '2026-10-09')).toBe('pendiente');
    expect(estadoDelCargo('OVERDUE', 50, undefined, '2026-10-09')).toBe('mora');
    expect(estadoDelCargo('void', 50, '2026-10-01', '2026-10-09')).toBe('pagado');
    expect(estadoDelCargo('ISSUED', 0, '2026-10-01', '2026-10-09')).toBe('pagado');
  });

  it('una factura se debe entera mientras no diga PAID', () => {
    expect(estadoDeFactura({ status: 'PAID', totalAmount: 100, dueDate: '2026-01-01' }, '2026-10-09')).toBe('pagado');
    expect(estadoDeFactura({ status: 'ISSUED', totalAmount: 100, dueDate: '2026-01-01' }, '2026-10-09')).toBe('mora');
    expect(estadoDeFactura({ status: 'ISSUED', totalAmount: 100, dueDate: '2027-01-01' }, '2026-10-09')).toBe('pendiente');
  });
});

describe('cuotas agrupadas por crédito', () => {
  const viejo = credito({
    loanId: 'viejo',
    originatedAt: '2026-01-01T10:00:00Z',
    installments: [cuota({ installmentId: 'a2', dueDate: '2026-03-01' }), cuota({ installmentId: 'a1', dueDate: '2026-02-01', overdue: true })],
  });
  const nuevo = credito({
    loanId: 'nuevo',
    originatedAt: '2026-09-01T10:00:00Z',
    installments: [cuota({ installmentId: 'b1', amountOutstanding: '0' })],
  });

  it('ordena del más reciente al más antiguo y cada uno por vencimiento', () => {
    const grupos = creditosConCuotas([viejo, nuevo], 'todas');
    expect(grupos.map((g) => g.credito.loanId)).toEqual(['nuevo', 'viejo']);
    expect(grupos[1]!.cuotas.map((c) => c.installmentId)).toEqual(['a1', 'a2']);
  });

  it('el filtro deja sólo los créditos con cuotas en ese estado, y sólo esas cuotas', () => {
    const enMora = creditosConCuotas([viejo, nuevo], 'mora');
    expect(enMora).toHaveLength(1);
    expect(enMora[0]!.cuotas.map((c) => c.installmentId)).toEqual(['a1']);
  });

  it('«saldado» es que el cliente terminó de pagar TODAS sus cuotas', () => {
    const grupos = creditosConCuotas([viejo, nuevo], 'todas');
    expect(grupos.find((g) => g.credito.loanId === 'nuevo')!.saldado).toBe(true);
    expect(grupos.find((g) => g.credito.loanId === 'viejo')!.saldado).toBe(false);
  });

  it('aplana las cuotas con su crédito, su origen y su cesta (la tabla del PDF)', () => {
    const planas = cuotasPlanas([credito({ loanCode: 'L', branchName: 'Centro', terminalAlias: 'Caja 1', installments: [cuota({})] })]);
    expect(planas[0]).toMatchObject({ loanCode: 'L', origen: 'Centro · Caja 1', estado: 'pendiente' });
  });
});

describe('origen de la compra', () => {
  it('nombra la caja por su alias, o por su serie, o dice que no la hubo', () => {
    expect(nombreDeCaja({ terminalAlias: ' ', terminalSerial: 'T-9' })).toBe('Caja T-9');
    expect(textoDeOrigen({ branchName: 'Equipetrol', terminalAlias: 'Caja 1' })).toBe('Equipetrol · Caja 1');
    expect(textoDeOrigen({})).toBe('Sin caja registrada');
  });

  it('acorta el código del crédito y deja intacto lo que no reconoce', () => {
    expect(codigoCorto('LOAN-31c2c5b9-1234-4abc-8def-c1f88afa4eb4')).toBe('LOAN-31c2c5b9');
    expect(codigoCorto('LOAN-1')).toBe('LOAN-1');
  });
});

describe('cuadre de cobros', () => {
  const pago = (applied: string, comision: string): PagoDeCartera => ({
    paymentId: applied,
    paymentCode: 'P',
    loanId: 'l',
    loanCode: 'L',
    receivedAt: '2026-10-01',
    amount: applied,
    appliedAmount: applied,
    currencyCode: 'BOB',
    paymentMethod: 'QR',
    externalReference: null,
    status: 'POSTED',
    reversed: false,
    mdrRatePercent: '3',
    commissionAccrued: comision,
    installmentNumbers: [1],
  });

  it('dice qué parte de lo cobrado no tiene un pago detrás', () => {
    expect(cuadreDeCobros([pago('100', '3'), pago('50', '1.5')], '200')).toEqual({ comisionDePagos: 4.5, cobradoConPago: 150, cobradoSinPago: 50 });
  });

  it('nunca da un faltante negativo', () => {
    expect(cuadreDeCobros([pago('100', '3')], '80').cobradoSinPago).toBe(0);
  });
});

describe('alcance del comercio (/portal/scope)', () => {
  it('un comercio con una cuenta está listo sin elegir nada y no manda cuenta', () => {
    expect(resolverAlcance({ isInternalOperator: false, requiresAccountSelection: false, accounts: [{ id: 'a', name: 'A' }] }, '')).toEqual({
      isMerchant: true,
      requiresSelection: false,
      accountId: undefined,
      ready: true,
    });
  });

  it('con varias cuentas propias espera a que elija y entonces la manda', () => {
    const varias = { isInternalOperator: false, requiresAccountSelection: true, accounts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    expect(resolverAlcance(varias, '').ready).toBe(false);
    expect(resolverAlcance(varias, 'b')).toMatchObject({ ready: true, accountId: 'b' });
  });

  it('personal interno nunca queda listo (y el gancho lo dice con su texto)', () => {
    expect(resolverAlcance({ isInternalOperator: true, requiresAccountSelection: true, accounts: [] }, '').ready).toBe(false);
    expect(MENSAJE_PERSONAL_INTERNO).toMatch(/entra desde Operaciones/);
  });

  it('sin respuesta todavía no está listo', () => {
    expect(resolverAlcance(null, '').ready).toBe(false);
  });
});

describe('rótulos cortos de la pantalla', () => {
  it('la tasa sin decimales de relleno, para que «Comisión Atlas 3 %» no se corte', () => {
    expect(tasaCorta('3.00')).toBe('3');
    expect(plano(tasaCorta('2.50'))).toBe('2,5');
    expect(tasaCorta(undefined)).toBe('0');
    expect(tasaCorta('abc')).toBe('0');
  });

  it('«1 cuota» y «3 cuotas», no «cuota(s)»', () => {
    expect(cuotasTexto(1)).toBe('1 cuota');
    expect(cuotasTexto(3)).toBe('3 cuotas');
  });

  it('el estado de un crédito sale de sus cuotas, no del `status` en inglés', () => {
    expect(estadoDeCredito({ outstanding: '0.00', installments: [cuota({ amountOutstanding: '0', overdue: false })] })).toBe('pagado');
    expect(estadoDeCredito({ outstanding: '80.00', installments: [cuota({ amountOutstanding: '80', overdue: true })] })).toBe('mora');
    expect(estadoDeCredito({ outstanding: '80.00', installments: [cuota({ amountOutstanding: '80', overdue: false })] })).toBe('pendiente');
  });
});
