import type { Progress } from '../src/api/endpoints/credit-line';
import { formatoPuntos, fraseDeLoQueFalta, iconoDeEscalon, ICONO_DE_NIVEL, idDeEscalon, nivelPorPuntos, porcentajeDeBarra } from '../src/features/nivel';

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
    [50_000, 'PREFERENTE'],
  ])('%i puntos → escalón %s', (xp, code) => expect(nivelPorPuntos(conPuntos(xp)).level.code).toBe(code));

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
  it('mide dentro del escalón: 1.500 entre 1.000 y 2.000 es 50 %', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(1_500)))).toBe(50));
  it('al cruzar un umbral la barra empieza de nuevo, no se queda llena', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(2_000)))).toBe(0));
  it('en el último nivel está llena', () => expect(porcentajeDeBarra(nivelPorPuntos(conPuntos(60_000)))).toBe(100));
});

describe('fraseDeLoQueFalta', () => {
  it('habla en PUNTOS y con separador de miles, nunca en calificación', () => {
    const frase = fraseDeLoQueFalta(nivelPorPuntos(conPuntos(24)));
    expect(frase).toBe('Te faltan 76 puntos para «Explorador». Sumas 1 por cada boliviano que compras.');
    expect(frase).not.toMatch(/calificación|de 100/);
  });
  it('singular con 1 punto', () => expect(fraseDeLoQueFalta(nivelPorPuntos(conPuntos(99)))).toMatch(/^Te falta 1 punto para/));
  it('en el último nivel lo dice', () => expect(fraseDeLoQueFalta(nivelPorPuntos(conPuntos(50_000)))).toBe('Estás en el nivel más alto.'));
  it('formatoPuntos usa punto de miles', () => expect(formatoPuntos(10000)).toBe('10.000'));
});

describe('los doce niveles', () => {
  it('cada uno tiene id único, icono propio y el escalón de la tarjeta intacto', () => {
    const { levelLadder } = nivelPorPuntos(conPuntos(0));
    expect(levelLadder).toHaveLength(12);
    expect(new Set(levelLadder.map(idDeEscalon)).size).toBe(12);
    for (const e of levelLadder) expect(iconoDeEscalon(e)).toBeTruthy();
    expect(levelLadder.filter((e) => e.code === 'PREFERENTE').map((e) => e.label)).toEqual(['Preferente', 'Élite', 'Leyenda', 'Titán Atlas']);
  });

  it('el fallback sigue los mismos cortes que el backend', () => {
    expect(nivelPorPuntos(conPuntos(100)).level).toMatchObject({ id: 'EXPLORADOR', index: 2, of: 12 });
    expect(nivelPorPuntos(conPuntos(3_500)).level).toMatchObject({ id: 'CONFIABLE', code: 'ESTABLECIDO', index: 6 });
  });

  it('un payload anterior (sin id) sigue funcionando: el id es el código', () => {
    expect(idDeEscalon({ code: 'ESTABLECIDO' })).toBe('ESTABLECIDO');
    expect(iconoDeEscalon({ code: 'ESTABLECIDO' })).toBe(ICONO_DE_NIVEL.ESTABLECIDO);
  });
});

describe('ICONO_DE_NIVEL', () => {
  it('cada nivel tiene icono', () => {
    for (const code of ['NUEVO', 'EN_CONSTRUCCION', 'ESTABLECIDO', 'CONSOLIDADO', 'PREFERENTE'] as const) expect(ICONO_DE_NIVEL[code]).toBeTruthy();
  });
});
