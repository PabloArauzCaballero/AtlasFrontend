import { pinProblem } from '../src/domain/pin';

describe('pinProblem', () => {
  it('acepta un PIN de 4 dígitos que no está en la lista', () => {
    expect(pinProblem('4829')).toBeNull();
  });

  it('rechaza lo que no son exactamente 4 dígitos', () => {
    expect(pinProblem('482')).toBe('Tu PIN debe ser de 4 dígitos.');
    expect(pinProblem('48291')).toBe('Tu PIN debe ser de 4 dígitos.');
    expect(pinProblem('una-contrasena-larga')).toBe('Tu PIN debe ser de 4 dígitos.');
  });

  it('rechaza los adivinables, igual que el servidor', () => {
    for (const pin of ['1234', '0000', '4321', '1212', '2000']) {
      expect(pinProblem(pin)).toBe('Ese PIN es demasiado fácil de adivinar. Elige otro.');
    }
  });
});
