import { avanceDeQuietud, estaQuieto } from '../src/features/quietud';

/**
 * La prueba de vida dispara sola cuando la imagen se queda quieta. Se mide con el tamaño de fotogramas JPEG pequeños:
 * la misma escena pesa casi lo mismo; si la cabeza o el teléfono se mueven, el tamaño salta.
 */
describe('estaQuieto', () => {
  it('con menos fotogramas de los necesarios, todavía no', () => expect(estaQuieto([1000, 1001])).toBe(false));
  it('tres fotogramas casi iguales: quieto', () => expect(estaQuieto([9000, 1000, 1010, 995])).toBe(true));
  it('un salto del 10 % en el último: se movió', () => expect(estaQuieto([1000, 1005, 1100])).toBe(false));
  it('un fotograma vacío o corrupto nunca cuenta como quieto', () => {
    expect(estaQuieto([1000, 0, 1000])).toBe(false);
    expect(estaQuieto([1000, Number.NaN, 1000])).toBe(false);
  });
});

describe('avanceDeQuietud', () => {
  it('va de 0 a 1 según cuántos fotogramas seguidos se parecen', () => {
    expect(avanceDeQuietud([1000])).toBe(0);
    expect(avanceDeQuietud([800, 1000, 1004])).toBeCloseTo(2 / 3);
    expect(avanceDeQuietud([1000, 1004, 998])).toBe(1);
  });
});
