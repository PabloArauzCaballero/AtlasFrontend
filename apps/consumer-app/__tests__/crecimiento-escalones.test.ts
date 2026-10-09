import { crecimientoDeCredito, ejemploDeRevision, filasDeEscalones, formatoBs } from '../src/features/crecimiento-credito';
import type { Progress } from '../src/api/endpoints/credit-line';

/** Pablo (2026-10-08): «Cómo crece tu crédito» tiene que decirlo con números, no sólo con frases. */
const progreso = {
  tier: { code: 'NUEVO', label: 'Nuevo', index: 1, of: 3, multiplier: 1, creditCeiling: 500 },
  nextTier: { code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 40, pointsMissing: 16, multiplier: 2, creditCeiling: 2000 },
  ladder: [
    { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, reached: true, creditCeiling: 500 },
    { code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 40, multiplier: 2, reached: false, creditCeiling: 2000 },
    { code: 'ESTABLECIDO', label: 'Establecido', from: 60, multiplier: 4, reached: false, creditCeiling: 5000 },
  ],
} as unknown as Pick<Progress, 'tier' | 'nextTier' | 'ladder'>;

describe('la escalera de crédito con números', () => {
  it('cada escalón dice su rango de calificación y su tope, y marca dónde estás', () => {
    expect(filasDeEscalones(crecimientoDeCredito(progreso))).toEqual([
      { code: 'NUEVO', label: 'Nuevo', rango: 'De 0 a 39', tope: `hasta ${formatoBs(500)}`, actual: true, alcanzado: true },
      { code: 'EN_CONSTRUCCION', label: 'En crecimiento', rango: 'De 40 a 59', tope: `hasta ${formatoBs(2000)}`, actual: false, alcanzado: false },
      { code: 'ESTABLECIDO', label: 'Establecido', rango: 'Desde 60', tope: `hasta ${formatoBs(5000)}`, actual: false, alcanzado: false },
    ]);
  });

  it('el ejemplo de revisión dobla el tope de hoy sin pasar del máximo', () => {
    expect(ejemploDeRevision(crecimientoDeCredito(progreso))).toContain(`como mucho a ${formatoBs(1000)}`);
  });
});
