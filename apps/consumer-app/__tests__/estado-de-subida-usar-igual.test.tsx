import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { EstadoDeSubidaVista } from '../src/ui/estado-de-subida';

const metricas = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const montar = (props: Parameters<typeof EstadoDeSubidaVista>[0]) =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <EstadoDeSubidaVista {...props} />
    </SafeAreaProvider>,
  );

/**
 * La comprobación del teléfono (tamaño y proporción del carnet) ahorra subidas dudosas, pero no es el juez: quien tiene una foto que
 * se ve bien y el umbral rechaza necesita poder usarla igual, y el Motor decide. Sin esa salida quedaba repitiendo (2026-10-07).
 */
describe('captura rechazada por el teléfono', () => {
  it('ofrece «Usar esta foto igual» y la usa', async () => {
    const onUsarIgual = jest.fn();
    await montar({ estado: { fase: 'rechazada', mensaje: 'La imagen salió muy pequeña.' }, onRepetir: jest.fn(), onUsarIgual });
    await fireEvent.press(screen.getByText('Usar esta foto igual'));
    expect(onUsarIgual).toHaveBeenCalledTimes(1);
  });

  it('sin una foto que reusar no ofrece nada que no pueda cumplir', async () => {
    await montar({ estado: { fase: 'rechazada', mensaje: 'x' }, onRepetir: jest.fn() });
    expect(screen.queryByText('Usar esta foto igual')).toBeNull();
    expect(screen.getByText('Repetir la foto')).toBeTruthy();
  });
});
