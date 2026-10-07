import { estaQuieto } from '../src/features/quietud';

/**
 * La selfie sale sola: la quietud por tamaño de JPEG casi nunca se cumple en un teléfono real (ruido del sensor), así que la
 * cuenta atrás de 3 s es la que garantiza el disparo. Aquí se fija por qué hace falta: una escena que la persona ve «quieta»
 * puede no parecerlo al medidor.
 */
describe('por qué la selfie ya no depende de la quietud medida', () => {
  it('una escena quieta con ruido de sensor del 5 % no cuenta como quieta para el medidor', () => {
    expect(estaQuieto([10_000, 10_500, 9_600, 10_400])).toBe(false);
  });
});
