import type { Progress } from '../src/api/endpoints/credit-line';
import { formatoPuntos, fraseDeLoQueFalta, ICONO_DE_NIVEL, nivelPorPuntos, porcentajeDeBarra } from '../src/features/nivel';

/**
 * El Nivel Atlas se mide en PUNTOS de experiencia (1 por boliviano comprado), nunca en la calificación 1-100. Pablo (2026-10-06): salía «24»
 * cuando el nivel son puntos que se ganan con las compras.
 */
const conPuntos = (xp: number) =>
  ({ experience: { xp } as Progress['experience'] }) as Pick<Progress, 'level' | 'nextLevel' | 'levelLadder' | 'experience' | 'points'>;

describe('nivelPorPuntos (cálculo local, backend anterior)', () => {
  it.each([
    [0, 'NUEVO'],
    [499, 'NUEVO'],
    [500, 'EN_CONSTRUCCION'],
    [2_000, 'ESTABLECIDO'],
    [5_000, 'CONSOLIDADO'],
    [10_000, 'PREFERENTE'],
  ])('%i puntos → %s', (xp, code) => expect(nivelPorPuntos(conPuntos(xp)).level.code).toBe(code));

  it('un valor inválido cuenta como 0 puntos', () => {
    expect(nivelPorPuntos(conPuntos(Number.NaN)).level).toMatchObject({ code: 'NUEVO', points: 0 });
    expect(nivelPorPuntos(conPuntos(-5)).level.points).toBe(0);
  });

  it('si el backend manda el nivel, se usa ese y no se recalcula', () => {
    const r = nivelPorPuntos({
      ...conPuntos(0),
      level: { code: 'CONSOLIDADO', label: 'Consolidado', index: 4, of: 5, points: 6_000 },
      nextLevel: { code: 'PREFERENTE', label: 'Preferente', from: 10_000, pointsMissing: 4_000 },
      levelLadder: [],
    });
    expect(r.level.code).toBe('CONSOLIDADO');
    expect(r.nextLevel?.pointsMissing).toBe(4_000);
  });
});

describe('porcentajeDeBarra', () => {
  it('recién llegado, la barra está vacía', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(0)))).toBe(0));
  it('mide dentro del escalón: 1.250 entre 500 y 2.000 es 50 %', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(1_250)))).toBe(50));
  it('al cruzar un umbral la barra empieza de nuevo, no se queda llena', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(2_000)))).toBe(0));
  it('en el último nivel está llena', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(25_000)))).toBe(100));
});

describe('fraseDeLoQueFalta', () => {
  it('habla en PUNTOS y con separador de miles, nunca en calificación', () => {
    const frase = fraseDeLoQueFalta(nivelPorPuntos(conPuntos(24)));
    expect(frase).toBe('Te faltan 476 puntos para «En crecimiento». Sumas 1 por cada boliviano que compras.');
    expect(frase).not.toMatch(/calificación|de 100/);
  });
  it('singular con 1 punto', () => expect(fraseDeLoQueFalta(nivelPorPuntos(conPuntos(499)))).toMatch(/^Te falta 1 punto para/));
  it('en el último nivel lo dice', () => expect(fraseDeLoQueFalta(nivelPorPuntos(conPuntos(10_000)))).toBe('Estás en el nivel más alto.'));
  it('formatoPuntos usa punto de miles', () => expect(formatoPuntos(10000)).toBe('10.000'));
});

describe('ICONO_DE_NIVEL', () => {
  it('cada nivel tiene icono', () => {
    for (const code of ['NUEVO', 'EN_CONSTRUCCION', 'ESTABLECIDO', 'CONSOLIDADO', 'PREFERENTE'] as const) expect(ICONO_DE_NIVEL[code]).toBeTruthy();
  });
});
