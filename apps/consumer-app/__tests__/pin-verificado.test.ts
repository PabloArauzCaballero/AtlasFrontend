import { marcarPinConfirmado, olvidarPinConfirmado, pinConfirmadoReciente } from '../src/features/pin-verificado';

/** El PIN confirmado se recuerda sólo en memoria y sólo unos minutos. */
describe('pin confirmado', () => {
  beforeEach(() => olvidarPinConfirmado());

  it('sin confirmar nunca, no está confirmado', () => {
    expect(pinConfirmadoReciente()).toBe(false);
  });

  it('recién confirmado, sí', () => {
    marcarPinConfirmado(1_000);
    expect(pinConfirmadoReciente(1_000 + 60_000)).toBe(true);
  });

  it('pasados cinco minutos hay que volver a escribirlo', () => {
    marcarPinConfirmado(1_000);
    expect(pinConfirmadoReciente(1_000 + 5 * 60_000 + 1)).toBe(false);
  });

  it('olvidarlo (cerrar sesión) lo quita al instante', () => {
    marcarPinConfirmado(1_000);
    olvidarPinConfirmado();
    expect(pinConfirmadoReciente(1_001)).toBe(false);
  });
});
