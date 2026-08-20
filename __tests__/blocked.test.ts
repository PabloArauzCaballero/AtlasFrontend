import { firstBlocker } from '../src/ui/blocked';

describe('firstBlocker', () => {
  it('no devuelve motivo cuando todo esta cumplido', () => {
    expect(firstBlocker([[true, 'Falta el nombre.'], [true, 'Falta el correo.']])).toBeNull();
  });

  it('devuelve el motivo del primer incumplimiento en orden de pantalla', () => {
    // El orden es la garantia que da este helper: senala el campo de mas arriba, que es al que hay
    // que subir. Si devolviera cualquiera de los dos, el aviso mandaria al usuario al sitio
    // equivocado la mitad de las veces.
    expect(
      firstBlocker([
        [true, 'Falta el nombre.'],
        [false, 'Falta la fecha de nacimiento.'],
        [false, 'Falta el correo.'],
      ]),
    ).toBe('Falta la fecha de nacimiento.');
  });

  it('nombra un solo motivo aunque falten varios', () => {
    const reason = firstBlocker([
      [false, 'Falta el nombre.'],
      [false, 'Falta el correo.'],
    ]);

    expect(reason).toBe('Falta el nombre.');
    expect(reason).not.toContain('correo');
  });

  it('sin requisitos no hay bloqueo', () => {
    expect(firstBlocker([])).toBeNull();
  });
});
