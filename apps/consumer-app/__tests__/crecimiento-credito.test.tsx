import { render, screen } from '@testing-library/react-native';
import type { Progress } from '../src/api/endpoints/credit-line';
import { crecimientoDeCredito, formatoBs, formatoVeces, fraseDelSiguienteSalto } from '../src/features/crecimiento-credito';
import { CrecimientoCreditoCard } from '../src/ui/crecimiento-credito-card';

/**
 * «Cuánto puede crecer tu crédito» (Pablo, 2026-10-07). Lo que se cuida aquí: que los importes salgan SÓLO de lo que
 * publica el backend —la app no tiene escrito ningún tope— y que con un backend anterior no se invente ninguno.
 */
const ESCALERA = [
  { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, creditCeiling: 1500 },
  { code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 25, multiplier: 1.5, creditCeiling: 2250 },
  { code: 'ESTABLECIDO', label: 'Establecido', from: 50, multiplier: 2.5, creditCeiling: 3750 },
  { code: 'CONSOLIDADO', label: 'Consolidado', from: 70, multiplier: 4, creditCeiling: 6000 },
  { code: 'PREFERENTE', label: 'Preferente', from: 85, multiplier: 6, creditCeiling: 9000 },
] as const;

function progreso(score: number, { conImportes = true }: { conImportes?: boolean } = {}) {
  const indice = ESCALERA.reduce((ultimo, e, i) => (score >= e.from ? i : ultimo), 0);
  const techo = (e: (typeof ESCALERA)[number]) => (conImportes ? { creditCeiling: e.creditCeiling } : {});
  const base = (e: (typeof ESCALERA)[number]) => ({ code: e.code, label: e.label, multiplier: e.multiplier, ...techo(e) });
  const actual = ESCALERA[indice]!;
  const siguiente = ESCALERA[indice + 1];
  return {
    tier: { ...base(actual), index: indice + 1, of: ESCALERA.length },
    nextTier: siguiente ? { ...base(siguiente), from: siguiente.from, pointsMissing: siguiente.from - score } : null,
    ladder: ESCALERA.map((e) => ({ ...base(e), from: e.from, reached: score >= e.from })),
  } as unknown as Progress;
}

describe('crecimientoDeCredito', () => {
  it('dice el tope de hoy, el del siguiente escalón y cuánto más es', () => {
    const c = crecimientoDeCredito(progreso(12));
    expect(c.conImportes).toBe(true);
    expect(c.techoHoy).toBe(1500);
    expect(c.techoSiguiente).toBe(2250);
    expect(c.aumento).toBe(750);
    expect(c.techoMaximo).toBe(9000);
    expect(c.siguiente).toEqual({ label: 'En crecimiento', from: 25, pointsMissing: 13 });
  });

  it('la barra de cada escalón es su parte del tope máximo', () => {
    const c = crecimientoDeCredito(progreso(55));
    expect(c.peldanos.map((p) => p.porcentaje)).toEqual([17, 25, 42, 67, 100]);
    expect(c.peldanos.filter((p) => p.actual).map((p) => p.code)).toEqual(['ESTABLECIDO']);
    expect(c.peldanos.filter((p) => p.reached)).toHaveLength(3);
  });

  it('en el escalón más alto no hay siguiente salto', () => {
    const c = crecimientoDeCredito(progreso(90));
    expect(c.siguiente).toBeNull();
    expect(c.aumento).toBeNull();
    expect(c.techoHoy).toBe(9000);
    expect(fraseDelSiguienteSalto(c)).toMatch(/escalón más alto/);
  });

  it('con un backend que no publica los topes NO inventa importes: sólo cuántas veces crece', () => {
    const c = crecimientoDeCredito(progreso(12, { conImportes: false }));
    expect(c.conImportes).toBe(false);
    expect(c.techoHoy).toBeNull();
    expect(c.techoSiguiente).toBeNull();
    expect(c.aumento).toBeNull();
    expect(c.techoMaximo).toBeNull();
    expect(c.vecesSiguiente).toBe(1.5);
    expect(c.vecesMaximo).toBe(6);
  });

  it('escribe los importes sin centavos y las veces con coma', () => {
    expect(formatoBs(2250)).toBe('Bs 2.250');
    expect(formatoVeces(1.5)).toBe('×1,5');
    expect(formatoVeces(6)).toBe('×6');
  });

  it('la frase dice cuánta calificación falta, en singular y en plural', () => {
    expect(fraseDelSiguienteSalto(crecimientoDeCredito(progreso(12)))).toBe('Te faltan 13 puntos de calificación para «En crecimiento». Se sube pagando a tiempo.');
    expect(fraseDelSiguienteSalto(crecimientoDeCredito(progreso(24)))).toBe('Te falta 1 punto de calificación para «En crecimiento». Se sube pagando a tiempo.');
  });
});

describe('<CrecimientoCreditoCard>', () => {
  it('enseña el salto al siguiente escalón, cuánto más es y la escalera entera', async () => {
    await render(<CrecimientoCreditoCard progress={progreso(12)} />);
    expect(screen.getByText('Cuánto puede crecer tu crédito')).toBeTruthy();
    // El lector de pantalla recibe la cifra FINAL aunque la que se ve esté contando.
    expect(screen.getByTestId('crecimiento-hoy').props.accessibilityLabel).toBe('Bs 1.500');
    expect(screen.getByTestId('crecimiento-siguiente').props.accessibilityLabel).toBe('Bs 2.250');
    expect(screen.getByText('+ Bs 750 de crédito')).toBeTruthy();
    expect(screen.getByText('hasta Bs 9.000')).toBeTruthy();
    expect(screen.getByText('Nuevo · estás aquí')).toBeTruthy();
    for (const e of ESCALERA) expect(screen.getByTestId(`crecimiento-peldano-${e.code}`)).toBeTruthy();
  });

  it('en el escalón más alto enseña el tope, no un salto', async () => {
    await render(<CrecimientoCreditoCard progress={progreso(90)} />);
    expect(screen.getByTestId('crecimiento-tope').props.accessibilityLabel).toBe('Bs 9.000');
    expect(screen.queryByTestId('crecimiento-siguiente')).toBeNull();
    expect(screen.queryByText(/de crédito$/)).toBeNull();
  });

  it('sin topes publicados habla de veces y no pinta ningún importe', async () => {
    await render(<CrecimientoCreditoCard progress={progreso(12, { conImportes: false })} />);
    expect(screen.getByTestId('crecimiento-siguiente').props.accessibilityLabel).toBe('×1,5');
    expect(screen.getByText('hasta ×6')).toBeTruthy();
    expect(screen.queryByText(/Bs/)).toBeNull();
  });
});
