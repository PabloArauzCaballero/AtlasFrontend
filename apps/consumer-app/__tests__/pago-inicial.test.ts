import { ESPERA_ENTRE_CONSULTAS_MS, estadoDelPagoInicial } from '../src/features/pago-inicial';

describe('pago inicial: lo que dice el backend, no el teléfono', () => {
  it('sin aviso, o sin solicitud, no hay nada que esperar', () => {
    expect(estadoDelPagoInicial(null)).toEqual({ tipo: 'sin_avisar' });
    expect(estadoDelPagoInicial(undefined)).toEqual({ tipo: 'sin_avisar' });
    expect(estadoDelPagoInicial({ downPaymentStatus: null })).toEqual({ tipo: 'sin_avisar' });
  });

  it('avisado = esperando al comercio; el comprobante es evidencia, no confirmación', () => {
    expect(estadoDelPagoInicial({ downPaymentStatus: 'submitted' })).toEqual({ tipo: 'esperando_al_comercio' });
  });

  it('sólo «confirmed» da el inicial por pagado', () => {
    expect(estadoDelPagoInicial({ downPaymentStatus: 'confirmed' })).toEqual({ tipo: 'confirmado' });
    expect(estadoDelPagoInicial({ downPaymentStatus: 'submitted' }).tipo).not.toBe('confirmado');
  });

  it('un rechazo trae su motivo; sin motivo dice algo útil en vez de quedar vacío', () => {
    expect(estadoDelPagoInicial({ downPaymentStatus: 'rejected', downPaymentRejectionReason: 'No encuentro la transferencia' })).toEqual({
      tipo: 'rechazado',
      motivo: 'No encuentro la transferencia',
    });
    expect(estadoDelPagoInicial({ downPaymentStatus: 'rejected' })).toMatchObject({ tipo: 'rechazado', motivo: expect.stringMatching(/no pudo confirmar/) });
  });

  it('pregunta cada pocos segundos, no en bucle', () => {
    expect(ESPERA_ENTRE_CONSULTAS_MS).toBeGreaterThanOrEqual(3_000);
  });
});
