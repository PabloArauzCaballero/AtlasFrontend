import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Cargando, SkeletonLista } from '../src/ui/primitives';

/** La espera de Atlas: marca con anillo de luz + barra de carga; con movimiento reducido no se mueve nada. */
const mockReducido = { valor: false };
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...real, useReducedMotion: () => mockReducido.valor, withRepeat: jest.fn(real.withRepeat) };
});

beforeEach(() => {
  mockReducido.valor = false;
  jest.mocked(Reanimated.withRepeat).mockClear();
});

describe('Cargando', () => {
  it('bloque: se anuncia como barra de progreso con su texto y pinta la barra de carga', async () => {
    await render(<Cargando bloque texto="Buscando tu pago…" />);
    const p = screen.getByRole('progressbar');
    expect(p.props.accessibilityLabel).toBe('Buscando tu pago…');
    expect(p.props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByText('Buscando tu pago…')).toBeTruthy();
    expect(screen.getByTestId('barra-de-carga', { includeHiddenElements: true })).toBeTruthy();
  });

  it('fila: texto al lado y barra debajo', async () => {
    await render(<Cargando texto="Consultando tu crédito…" />);
    expect(screen.getByText('Consultando tu crédito…')).toBeTruthy();
    expect(screen.getByTestId('barra-de-carga', { includeHiddenElements: true })).toBeTruthy();
  });

  it('compacto (sin texto, dentro de un botón): sólo el anillo, sin barra', async () => {
    await render(<Cargando />);
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toBe('Cargando');
    expect(screen.queryByTestId('barra-de-carga', { includeHiddenElements: true })).toBeNull();
  });

  it('con movimiento animado, el anillo gira en bucle', async () => {
    await render(<Cargando bloque texto="x" />);
    expect(Reanimated.withRepeat).toHaveBeenCalled();
  });

  it('con movimiento reducido no arranca ninguna animación en bucle, pero sigue diciendo que carga', async () => {
    mockReducido.valor = true;
    await render(<Cargando bloque texto="Buscando tu pago…" />);
    expect(Reanimated.withRepeat).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});

describe('SkeletonLista', () => {
  it('anuncia que algo está llegando, además de la forma de la lista', async () => {
    await render(<SkeletonLista filas={2} />);
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toBe('Cargando…');
    expect(screen.getByTestId('barra-de-carga', { includeHiddenElements: true })).toBeTruthy();
  });
});
