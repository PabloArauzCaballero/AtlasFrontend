import type { ComprobanteDePago, MovimientoDePos, PagoInicial, SolicitudDeCompra } from '../../src/api/servicios/merchantCreditService';
import { fechaCorta } from '../../src/features/gestion-pos/formato';
import { cuantosFiltros, lineaDelMovimiento } from '../../src/features/gestion-pos/historial';
import {
  estadoDeSolicitud,
  lineaDeComprobante,
  lineaDePagoInicial,
  lineaDeSolicitud,
  pendientesDeComprobantes,
  refCorta,
} from '../../src/features/gestion-pos/tarjetas';

/**
 * Lo que dicen las tarjetas (Pablo, 2026-10-10: «mucho más claras»): el estado en español, UNA línea
 * secundaria sin huecos ni ids internos, y el contador de «Comprobantes» con los pagos iniciales.
 */

const HOY = new Date(2026, 9, 10, 12);
// Hora LOCAL: la línea enseña la hora del teléfono, así que la prueba no depende de la zona de la máquina.
const local = (dia: number, h: number, m: number, anio = 2026) => new Date(anio, 9, dia, h, m).toISOString();

const solicitud: SolicitudDeCompra = {
  applicationId: 'a1',
  applicationCode: 'CRA-b51c9eaa-bde4-4f00-9a7e-12ab34cd56ef',
  status: 'approved',
  requestedAmount: '1500.00',
  requestedTermMonths: 6,
  currencyCode: 'BOB',
  businessAcceptance: 'pending',
  submittedAt: local(9, 14, 3),
  branchName: 'Equipetrol',
  branchCode: 'EQ',
  terminalAlias: 'Caja 1',
  terminalSerial: 'SN-5',
};

describe('Gestión POS · tarjetas', () => {
  it('fecha corta: día, mes en tres letras y hora; el año sólo si no es el de hoy', () => {
    expect(fechaCorta(local(9, 14, 3), HOY)).toBe('9 oct, 14:03');
    expect(fechaCorta(local(9, 8, 5, 2025), HOY)).toBe('9 oct 2025, 08:05');
    expect(fechaCorta(null, HOY)).toBeNull();
    expect(fechaCorta('no-es-fecha', HOY)).toBeNull();
  });

  it('la referencia corta son los últimos seis caracteres del código, nunca el id entero', () => {
    expect(refCorta(solicitud.applicationCode)).toBe('cd56ef');
    expect(refCorta('SOL-1')).toBe('sol1');
    expect(refCorta(null)).toBe('');
  });

  it('solicitud: estado en español y «N cuotas · fecha · sucursal · caja»', () => {
    expect(estadoDeSolicitud(solicitud)).toEqual({ texto: 'Por aceptar', tono: 'warning' });
    expect(estadoDeSolicitud({ businessAcceptance: null }).texto).toBe('Por aceptar');
    expect(estadoDeSolicitud({ businessAcceptance: 'accepted' }).texto).toBe('Aceptada');
    expect(estadoDeSolicitud({ businessAcceptance: 'raro' }).texto).toBe('Pendiente');
    expect(lineaDeSolicitud(solicitud, HOY)).toBe('6 cuotas · 9 oct, 14:03 · Equipetrol · Caja 1');
    expect(lineaDeSolicitud({ ...solicitud, requestedTermMonths: 1, branchName: null, terminalAlias: null, terminalSerial: null }, HOY)).toBe('1 cuota · 9 oct, 14:03');
  });

  it('comprobante y pago inicial: qué se paga, la referencia del banco, fecha y caja', () => {
    const c = { payerReference: '778812', submittedAt: local(9, 15, 0), branchName: 'Centro', terminalSerial: 'SN-6' } as ComprobanteDePago;
    expect(lineaDeComprobante(c, HOY)).toBe('Cuota · Ref. 778812 · 9 oct, 15:00 · Centro · Caja SN-6');
    const p = { payerReference: null, submittedAt: null, branchName: null, terminalAlias: null } as PagoInicial;
    expect(lineaDePagoInicial(p, HOY)).toBe('Pago inicial · Ref. sin referencia · Sin fecha');
  });

  it('historial: «fecha · sucursal · caja · referencia», sin huecos', () => {
    const m = { happenedAt: local(9, 14, 3), branchName: 'Casa matriz', terminalAlias: 'Caja 5', terminalSerial: null, reference: null } as MovimientoDePos;
    expect(lineaDelMovimiento(m, HOY)).toBe('9 oct, 14:03 · Casa matriz · Caja 5');
    expect(lineaDelMovimiento({ ...m, branchName: null, terminalAlias: null, reference: 'X1' }, HOY)).toBe('9 oct, 14:03 · Ref. X1');
  });

  it('el botón «Filtros» cuenta los filtros puestos (la página no cuenta)', () => {
    expect(cuantosFiltros({ page: 3 })).toBe(0);
    expect(cuantosFiltros({ branchId: 'b', from: '2026-10-01', page: 1 })).toBe(2);
  });

  it('el contador de «Comprobantes» suma cuotas y pagos iniciales (la web sólo contaba cuotas)', () => {
    expect(pendientesDeComprobantes(null, null)).toBeNull();
    expect(pendientesDeComprobantes(1, 2)).toBe(3);
    expect(pendientesDeComprobantes(null, 2)).toBe(2);
    expect(pendientesDeComprobantes(0, null)).toBe(0);
  });
});
