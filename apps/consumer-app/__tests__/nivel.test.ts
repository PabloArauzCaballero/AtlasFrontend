import type { Progress, TierCode } from '../src/api/endpoints/credit-line';
import { fraseDeLoQueFalta, ICONO_DE_NIVEL, porcentajeDeBarra } from '../src/features/nivel';

/**
 * La barra de experiencia mide el camino al SIGUIENTE nivel, no el total sobre 100: así no se vacía al subir.
 */
const ESCALERA = [
  { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1 },
  { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, multiplier: 1.5 },
  { code: 'ESTABLECIDO', label: 'Establecido', from: 50, multiplier: 2.5 },
  { code: 'CONSOLIDADO', label: 'Consolidado', from: 70, multiplier: 4 },
  { code: 'PREFERENTE', label: 'Preferente', from: 85, multiplier: 6 },
] as const;

function progreso(score: number): Pick<Progress, 'score' | 'ladder' | 'nextTier'> {
  const ladder = ESCALERA.map((e) => ({ ...e, reached: score >= e.from })) as Progress['ladder'];
  const siguiente = ESCALERA.find((e) => e.from > score);
  return {
    score,
    ladder,
    nextTier: siguiente
      ? { code: siguiente.code as TierCode, label: siguiente.label, from: siguiente.from, pointsMissing: siguiente.from - score, multiplier: siguiente.multiplier }
      : null,
  };
}

describe('porcentajeDeBarra', () => {
  it('recién llegado, la barra está vacía', () => expect(porcentajeDeBarra(progreso(0))).toBe(0));
  it('mide dentro del escalón: 12 de 25 es 48 %', () => expect(porcentajeDeBarra(progreso(12))).toBe(48));
  it('con 30 puntos (escalón 25-50) la barra va al 20 %, no al 30 %', () => expect(porcentajeDeBarra(progreso(30))).toBe(20));
  it('al cruzar el umbral la barra vuelve a empezar: subir de nivel NO la deja llena', () => {
    expect(porcentajeDeBarra(progreso(49))).toBe(96);
    expect(porcentajeDeBarra(progreso(50))).toBe(0);
  });
  it('en el último nivel está llena', () => expect(porcentajeDeBarra(progreso(92))).toBe(100));
  it('nunca se sale de 0-100', () => {
    for (let s = 0; s <= 100; s += 1) {
      const p = porcentajeDeBarra(progreso(s));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

describe('fraseDeLoQueFalta', () => {
  it('dice cuántos puntos y para qué nivel', () => expect(fraseDeLoQueFalta(progreso(10))).toBe('Te faltan 15 de calificación para «En construcción».'));
  it('en singular cuando falta uno', () => expect(fraseDeLoQueFalta(progreso(24))).toBe('Te falta 1 de calificación para «En construcción».'));
  it('en el último nivel lo dice', () => expect(fraseDeLoQueFalta(progreso(90))).toBe('Estás en el nivel más alto.'));
});

describe('iconos', () => {
  it('cada nivel tiene su icono', () => {
    for (const e of ESCALERA) expect(ICONO_DE_NIVEL[e.code as TierCode]).toBeTruthy();
  });
});
