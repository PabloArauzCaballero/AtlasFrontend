import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Button } from '../src/ui/primitives';
import {
  ANCHO_BANDA,
  autonomia,
  FRACCION_BARRIDO,
  opacidadDelBarrido,
  posicionDelBarrido,
  vivaPorSiSola,
} from '../src/ui/button-shine';

/**
 * El brillo del botón (`ui/button-shine.tsx`): reactivo en todos, autónomo SÓLO en la acción principal y apagado donde
 * un botón que se mueve solo estorbaría (bloqueado, cargando) o está de más (secundarios).
 */
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>);
const medir = () => fireEvent(screen.getByRole('button'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 52 } } });

describe('curvas del brillo', () => {
  it('el barrido entra por la izquierda, cruza y sale por la derecha, fuera de la vista en los dos extremos', () => {
    expect(posicionDelBarrido(0, 300)).toBe(-ANCHO_BANDA);
    expect(posicionDelBarrido(FRACCION_BARRIDO, 300)).toBe(300 + ANCHO_BANDA);
    expect(posicionDelBarrido(0.9, 300)).toBe(300 + ANCHO_BANDA);
    // Monótono: nunca vuelve atrás a mitad de camino.
    let anterior = -Infinity;
    for (let q = 0; q <= FRACCION_BARRIDO; q += 0.01) {
      const x = posicionDelBarrido(q, 300);
      expect(x).toBeGreaterThanOrEqual(anterior);
      anterior = x;
    }
  });

  it('la luz es invisible al empezar, al acabar y durante todo el reposo (el salto de fase cae donde no se ve)', () => {
    expect(opacidadDelBarrido(0)).toBeCloseTo(0, 5);
    expect(opacidadDelBarrido(FRACCION_BARRIDO)).toBeCloseTo(0, 5);
    expect(opacidadDelBarrido(0.6)).toBe(0);
    expect(opacidadDelBarrido(0.999)).toBe(0);
    expect(opacidadDelBarrido(FRACCION_BARRIDO / 2)).toBeCloseTo(1, 5);
  });

  it('sólo se mueve sola la acción principal, desbloqueada y sin movimiento reducido', () => {
    autonomia.activa = true;
    expect(vivaPorSiSola({ principal: true, bloqueado: false, reducido: false })).toBe(true);
    expect(vivaPorSiSola({ principal: false, bloqueado: false, reducido: false })).toBe(false);
    expect(vivaPorSiSola({ principal: true, bloqueado: true, reducido: false })).toBe(false);
    expect(vivaPorSiSola({ principal: true, bloqueado: false, reducido: true })).toBe(false);
    autonomia.activa = false;
    expect(vivaPorSiSola({ principal: true, bloqueado: false, reducido: false })).toBe(false);
  });
});

describe('Button · brillo', () => {
  beforeEach(() => {
    autonomia.activa = true;
  });
  afterEach(() => {
    autonomia.activa = false;
  });

  it('la acción principal lleva el barrido de luz', async () => {
    await montar(<Button label="Continuar" onPress={() => undefined} />);
    await medir();
    expect(screen.getByTestId('boton-brillo')).toBeTruthy();
  });

  it('el acabado de cristal es estático: está en el principal aunque no haya movimiento', async () => {
    autonomia.activa = false;
    await montar(<Button label="Continuar" onPress={() => undefined} />);
    expect(screen.getByTestId('boton-cristal')).toBeTruthy();
  });

  it('un botón bloqueado no lleva el acabado de cristal: un apagado que brilla invita a pulsarlo', async () => {
    await montar(<Button label="Continuar" disabled blockedReason="Falta un dato." onPress={() => undefined} />);
    expect(screen.queryByTestId('boton-cristal')).toBeNull();
  });

  it('un botón bloqueado NO brilla ni se mueve: invitaría a pulsarlo', async () => {
    await montar(<Button label="Continuar" disabled blockedReason="Falta un dato." onPress={() => undefined} />);
    await medir();
    expect(screen.queryByTestId('boton-brillo')).toBeNull();
    expect(screen.queryByTestId('boton-destello')).toBeNull();
  });

  it('mientras carga, deja de barrer', async () => {
    await montar(<Button label="Continuar" loading onPress={() => undefined} />);
    await medir();
    expect(screen.queryByTestId('boton-brillo')).toBeNull();
  });

  it('los secundarios no se mueven solos, pero SÍ se iluminan al tocarlos', async () => {
    await montar(<Button label="Volver" variant="secondary" onPress={() => undefined} />);
    await medir();
    expect(screen.queryByTestId('boton-brillo')).toBeNull();
    expect(screen.getByTestId('boton-destello')).toBeTruthy();
  });

  it('con la parte autónoma apagada (web, pruebas) el botón sigue completo y responde al toque', async () => {
    autonomia.activa = false;
    const alPulsar = jest.fn();
    await montar(<Button label="Continuar" onPress={alPulsar} />);
    await medir();
    expect(screen.queryByTestId('boton-brillo')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Continuar/ }));
    expect(alPulsar).toHaveBeenCalledTimes(1);
  });
});
