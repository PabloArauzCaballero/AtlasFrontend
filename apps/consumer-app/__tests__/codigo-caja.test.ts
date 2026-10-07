import { limpiarCodigoCaja, ALFABETO_CODIGO_CAJA, LARGO_CODIGO_CAJA } from '../src/features/codigo-caja';

describe('código a mano de una caja', () => {
  it('pasa a mayúsculas y quita guion y espacios: se puede pegar «k7m2-9qxd»', () => {
    expect(limpiarCodigoCaja('k7m2-9qxd')).toBe('K7M29QXD');
    expect(limpiarCodigoCaja(' K7M2 9QXD ')).toBe('K7M29QXD');
  });

  it('no deja escribir los símbolos que se confunden: 0, O, 1, I, L, U, V', () => {
    expect(limpiarCodigoCaja('0O1ILUV')).toBe('');
    expect(limpiarCodigoCaja('K0O7')).toBe('K7');
    expect(ALFABETO_CODIGO_CAJA).not.toMatch(/[01OILUV]/);
  });

  it('se corta en 8 caracteres', () => {
    expect(limpiarCodigoCaja('K7M29QXDK7M29QXD')).toHaveLength(LARGO_CODIGO_CAJA);
  });

  it('un serial largo pegado queda reducido a sus primeros 8 símbolos válidos: no sirve como código', () => {
    expect(limpiarCodigoCaja('SN-1789065299579-RMWUCC')).toHaveLength(8);
  });
});
