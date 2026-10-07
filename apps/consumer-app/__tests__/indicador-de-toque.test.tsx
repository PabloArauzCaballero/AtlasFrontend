import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { autonomia } from '../src/ui/button-shine';
import { golpeDelDedo, IndicadorDeToque, MANO_SVG, ondaDelToque } from '../src/ui/indicador-de-toque';

/**
 * «Toca aquí» (`ui/indicador-de-toque.tsx`): la mano baja y, al llegar, nacen las ondas. Todo sale de UNA fase, así que se
 * prueba la fase: dedo y ondas no pueden quedar descompasados.
 */
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);

describe('curvas del toque', () => {
  it('la mano arranca y acaba arriba, toca en el 14-20 % del ciclo y no da saltos', () => {
    expect(golpeDelDedo(0)).toBe(0);
    expect(golpeDelDedo(0.14)).toBeCloseTo(1, 5);
    expect(golpeDelDedo(0.17)).toBe(1);
    expect(golpeDelDedo(0.45)).toBeCloseTo(0, 5);
    expect(golpeDelDedo(0.9)).toBe(0);
    let anterior = golpeDelDedo(0);
    for (let p = 0.005; p <= 1; p += 0.005) {
      const g = golpeDelDedo(p);
      expect(Math.abs(g - anterior)).toBeLessThan(0.2);
      anterior = g;
    }
  });

  it('las ondas nacen cuando la mano toca y se apagan antes de que acabe el ciclo', () => {
    expect(ondaDelToque(0.1, 0)).toBe(-1);
    expect(ondaDelToque(0.14, 0)).toBeCloseTo(0, 5);
    expect(ondaDelToque(0.14 + 0.55, 0)).toBeCloseTo(1, 5);
    expect(ondaDelToque(0.95, 0)).toBe(-1);
    // La segunda va detrás de la primera.
    expect(ondaDelToque(0.2, 0.16)).toBe(-1);
    expect(ondaDelToque(0.2, 0)).toBeGreaterThan(0);
  });
});

describe('IndicadorDeToque', () => {
  afterEach(() => {
    autonomia.activa = false;
  });

  it('la mano es un SVG completo y con sus degradados definidos', () => {
    expect(MANO_SVG.startsWith('<svg')).toBe(true);
    expect(MANO_SVG.trim().endsWith('</svg>')).toBe(true);
    for (const id of ['itcu', 'itde', 'itdp', 'itpo']) {
      expect(MANO_SVG).toContain(`id="${id}"`);
      expect(MANO_SVG).toContain(`url(#${id})`);
    }
  });

  it('se pinta, y para el lector de pantalla no existe: el botón ya se anuncia solo', async () => {
    await montar(<IndicadorDeToque />);
    const caja = screen.getByTestId('indicador-de-toque', { includeHiddenElements: true });
    expect(caja.props.accessibilityElementsHidden).toBe(true);
    expect(caja.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
