import { aplicarFiltro, cajasDeSucursal, estadoDe, fechaDeFiltro, hayFiltros, lineaDelTotal, opcionesDeCaja, opcionesDeSucursal, textoDePagina, textoVacioDelHistorial, tipoDe } from '../../src/features/gestion-pos/historial';
import {
  avisoDecisionComprobante,
  avisoDecisionPagoInicial,
  avisoDecisionSolicitud,
  cuerpoDecisionSolicitud,
  cuerpoVerificacion,
} from '../../src/features/gestion-pos/decisiones';
import { formatBob } from '../../src/features/gestion-pos/formato';
import { ELIJA_EL_MOTIVO, MOTIVOS_COMPROBANTE, MOTIVOS_PAGO_INICIAL, MOTIVOS_SOLICITUD } from '../../src/features/gestion-pos/motivos';
import { nombreDeCaja, textoDeOrigen } from '../../src/features/gestion-pos/origen-de-caja';
import type { HistorialDePos, MovimientoDePos } from '../../src/api/servicios/merchantCreditService';

/**
 * La lógica de Gestión POS es copia de la web, y estas pruebas son la forma de que la copia no se
 * desvíe en silencio: los casos del historial son los de `AtlasERPFrontend/tests/unit/pos-historial.test.ts`,
 * y los textos se comparan LITERALES con los de las pantallas web (un motivo con otro valor es un
 * 400 del backend; un aviso con otras palabras ya no es «lo mismo que la web»).
 */

/* `Intl` separa «Bs» del número con un espacio duro; para comparar se normaliza. */
const plano = (texto: string) => texto.replace(/\s/g, ' ');

describe('Gestión POS · importes', () => {
  it('formatea en bolivianos como la web, aunque el backend mande texto', () => {
    expect(formatBob(1500)).toBe(formatBob('1500'));
    expect(plano(formatBob('1234.5'))).toMatch(/1\.234,5/);
    expect(formatBob(null)).toBe(formatBob(0));
  });
});

describe('Gestión POS · origen de caja (OrigenDeCaja de la web)', () => {
  it('la caja se nombra siempre: alias, o la serie si no tiene alias', () => {
    expect(nombreDeCaja({ terminalAlias: 'Caja 1' })).toBe('Caja 1');
    expect(nombreDeCaja({ terminalAlias: '  ', terminalSerial: 'SN-6' })).toBe('Caja SN-6');
    expect(nombreDeCaja({ terminalAlias: null, terminalSerial: 'SN-6' })).toBe('Caja SN-6');
    expect(nombreDeCaja({})).toBeNull();
    expect(textoDeOrigen({ branchName: 'Centro', terminalSerial: 'SN-6' })).toBe('Centro · Caja SN-6');
    expect(textoDeOrigen({})).toBe('Sin caja registrada');
  });
});

describe('Gestión POS · motivos de rechazo', () => {
  it('solicitudes: los códigos de la web, en su orden', () => {
    expect(MOTIVOS_SOLICITUD.map((m) => m.valor)).toEqual(['CLIENTE_DESISTIO', 'SIN_STOCK', 'IMPORTE_NO_CORRESPONDE', 'SOSPECHA_IDENTIDAD', 'OTRO']);
    expect(MOTIVOS_SOLICITUD[0]?.etiqueta).toBe('El cliente se arrepintió');
  });

  it('comprobantes: los códigos de la web, en su orden', () => {
    expect(MOTIVOS_COMPROBANTE.map((m) => m.valor)).toEqual(['NO_APARECE_EN_CUENTA', 'IMPORTE_NO_COINCIDE', 'COMPROBANTE_ILEGIBLE', 'OTRA_OPERACION', 'OTRO']);
  });

  it('pago inicial: viaja la FRASE (el cliente la lee), sin «Otro»', () => {
    expect(MOTIVOS_PAGO_INICIAL.every((m) => m.valor === m.etiqueta)).toBe(true);
    expect(MOTIVOS_PAGO_INICIAL.map((m) => m.valor)).toEqual([
      'No encuentro la transferencia en mi cuenta',
      'El importe no coincide',
      'El comprobante no se lee o no corresponde',
      'La transferencia es de otra operación',
    ]);
  });

  it('la opción vacía de la web es el texto del selector sin elegir', () => {
    expect(ELIJA_EL_MOTIVO).toBe('— Elija el motivo —');
    for (const lista of [MOTIVOS_SOLICITUD, MOTIVOS_COMPROBANTE, MOTIVOS_PAGO_INICIAL]) expect(lista.some((m) => m.valor === '')).toBe(false);
  });
});

describe('Gestión POS · decisiones', () => {
  it('aceptar no lleva motivo; rechazar sin motivo no manda nada', () => {
    expect(cuerpoDecisionSolicitud(true, '')).toEqual({ accepted: true });
    expect(cuerpoDecisionSolicitud(true, 'SIN_STOCK')).toEqual({ accepted: true });
    expect(cuerpoDecisionSolicitud(false, '')).toBeNull();
    expect(cuerpoDecisionSolicitud(false, 'SIN_STOCK')).toEqual({ accepted: false, reasonCode: 'SIN_STOCK' });
    expect(cuerpoVerificacion(true, 'x')).toEqual({ verified: true });
    expect(cuerpoVerificacion(false, '')).toBeNull();
    expect(cuerpoVerificacion(false, 'OTRO')).toEqual({ verified: false, reason: 'OTRO' });
  });

  it('los avisos dicen lo mismo que la web', () => {
    expect(avisoDecisionSolicitud({ applicationCode: 'SOL-1' }, true)).toEqual({
      tono: 'success',
      texto: 'Aceptaste la compra SOL-1. El cliente ya puede llevarse el producto.',
    });
    expect(avisoDecisionSolicitud({ applicationCode: 'SOL-1' }, false)).toEqual({ tono: 'danger', texto: 'Rechazaste la compra SOL-1.' });
    expect(avisoDecisionComprobante({ claimCode: 'CMP-9', claimedAmount: '250' }, true).texto).toBe(
      `Confirmaste el pago de ${formatBob(250)}. La cuota queda saldada.`,
    );
    expect(avisoDecisionComprobante({ claimCode: 'CMP-9', claimedAmount: '250' }, false).texto).toBe('Rechazaste el comprobante CMP-9.');
    expect(avisoDecisionPagoInicial({ applicationCode: 'SOL-2', downPaymentAmount: 600 }, true).texto).toBe(
      `Confirmaste el pago inicial de ${formatBob(600)}. El cliente ya lo ve pagado en su app.`,
    );
    expect(avisoDecisionPagoInicial({ applicationCode: 'SOL-2', downPaymentAmount: 600 }, false)).toEqual({
      tono: 'danger',
      texto: 'Rechazaste el pago inicial de la compra SOL-2. El cliente verá el motivo.',
    });
  });
});

describe('Gestión POS · historial (casos de pos-historial.test.ts de la web)', () => {
  const filtros: HistorialDePos['filters'] = {
    branches: [
      { branchId: '1', branchName: 'Equipetrol', branchCode: 'EQ' },
      { branchId: '2', branchName: 'Centro', branchCode: 'CE' },
    ],
    terminals: [
      { terminalId: '5', branchId: '1', branchName: 'Equipetrol', terminalAlias: 'Caja 1', terminalSerial: 'SN-5' },
      { terminalId: '6', branchId: '2', branchName: 'Centro', terminalAlias: null, terminalSerial: 'SN-6' },
    ],
  };

  it('el filtro de caja ofrece sólo las cajas de la sucursal elegida', () => {
    expect(cajasDeSucursal(filtros, '2').map((t) => t.terminalId)).toEqual(['6']);
    expect(cajasDeSucursal(filtros, undefined).map((t) => t.terminalId)).toEqual(['5', '6']);
    expect(cajasDeSucursal(null, undefined)).toEqual([]);
  });

  it('cambiar de sucursal suelta una caja de otra sucursal, y cualquier cambio vuelve a la página 1', () => {
    const actual = { branchId: '1', terminalId: '5', page: 3, pageSize: 20 };
    expect(aplicarFiltro(actual, { branchId: '2' }, filtros)).toEqual({ branchId: '2', page: 1, pageSize: 20 });
    expect(aplicarFiltro(actual, { from: '2026-10-01' }, filtros)).toEqual({ ...actual, from: '2026-10-01', page: 1 });
    expect(aplicarFiltro(actual, { page: 4 }, filtros).page).toBe(4);
  });

  it('nombra el tipo y el estado de cada fila', () => {
    const m = { kind: 'installment_payment', status: 'verified' } as MovimientoDePos;
    expect(tipoDe(m).texto).toBe('Cuota');
    expect(estadoDe(m)).toEqual({ texto: 'Confirmado', tono: 'success' });
    expect(tipoDe({ ...m, kind: 'purchase_request' })).toEqual({ texto: 'Solicitud de compra', tono: 'info' });
    expect(tipoDe({ ...m, kind: 'down_payment' }).texto).toBe('Pago inicial');
    expect(estadoDe({ ...m, status: 'declined' }).texto).toBe('Rechazada');
    expect(estadoDe({ ...m, status: 'raro' })).toEqual({ texto: 'raro', tono: 'neutral' });
  });

  it('las opciones de los selectores son las de la web', () => {
    expect(opcionesDeSucursal(filtros)).toEqual([
      { valor: '', etiqueta: 'Todas las sucursales' },
      { valor: '1', etiqueta: 'Equipetrol' },
      { valor: '2', etiqueta: 'Centro' },
    ]);
    expect(opcionesDeCaja(filtros, undefined).map((o) => o.etiqueta)).toEqual(['Todas las cajas', 'Caja 1 · Equipetrol', 'Caja SN-6 · Centro']);
    expect(opcionesDeCaja(filtros, '1').map((o) => o.etiqueta)).toEqual(['Todas las cajas', 'Caja 1']);
  });

  it('el total, el vacío y la página', () => {
    expect(hayFiltros({ page: 1 })).toBe(false);
    expect(hayFiltros({ to: '2026-10-09' })).toBe(true);
    const datos = { totals: { count: 1, amount: '500' } } as HistorialDePos;
    expect(plano(lineaDelTotal(datos, false).texto)).toBe(plano(`1 operación · ${formatBob(500)} confirmados`));
    expect(lineaDelTotal({ totals: { count: 3, amount: '0' } } as HistorialDePos, true).texto).toMatch(/^3 operaciones · .* confirmados con estos filtros$/);
    expect(lineaDelTotal(null, false).cuenta).toBe('0');
    expect(lineaDelTotal(null, false).operaciones).toBe('operaciones');
    expect(textoVacioDelHistorial(true)).toBe('No hay nada con estos filtros.');
    expect(textoVacioDelHistorial(false)).toBe('Todavía no hay movimientos en la caja.');
    expect(textoDePagina({ page: 2, pages: 5, total: 93 })).toBe('Página 2 de 5 · 93 en total');
  });

  it('las fechas del filtro se leen como día local, sin correrse', () => {
    const fecha = fechaDeFiltro('2026-01-01');
    expect(fecha?.getFullYear()).toBe(2026);
    expect(fecha?.getMonth()).toBe(0);
    expect(fecha?.getDate()).toBe(1);
    expect(fechaDeFiltro(undefined)).toBeUndefined();
    expect(fechaDeFiltro('ayer')).toBeUndefined();
  });
});
