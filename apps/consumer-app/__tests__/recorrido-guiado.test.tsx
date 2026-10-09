import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { TourProvider, TourTarget, useTour, type TourStep } from '../src/ui/tour';

/**
 * El recorrido guiado se veía «bugueadísimo» en el teléfono y la primera vez dejaba la app colgada (2026-10-06): el
 * `Modal` se rehacía con cada medida y la tarjeta podía caer fuera de la ventana sin «Saltar» a la vista.
 */
const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const PASOS: TourStep[] = [
  { target: 'a', title: 'Paso uno', body: 'Primero.' },
  { target: 'b', title: 'Paso dos', body: 'Segundo.' },
];

let lanzar: (pasos: TourStep[], clave?: string) => void = () => undefined;
function Lanzador() {
  lanzar = useTour().start;
  return null;
}

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <TourProvider>
        <Lanzador />
        <TourTarget id="a">
          <Text>Objetivo A</Text>
        </TourTarget>
      </TourProvider>
    </SafeAreaProvider>,
  );

describe('recorrido guiado', () => {
  it('sin pasos no abre nada: un velo sin tarjeta no tendría salida', async () => {
    await montar();
    await act(async () => lanzar([]));
    expect(screen.queryByText(/Paso 1 de/)).toBeNull();
  });

  it('un segundo arranque con otro en curso NO lo reinicia (Ayuda + arranque automático de Inicio, 2026-10-08)', async () => {
    await montar();
    await act(async () => lanzar(PASOS, 'inicio'));
    await waitFor(() => expect(screen.getByText('Paso uno')).toBeTruthy(), { timeout: 4000 });
    await act(async () => fireEvent.press(screen.getByTestId('tour-siguiente')));
    await waitFor(() => expect(screen.getByText('Paso dos')).toBeTruthy(), { timeout: 4000 });
    await act(async () => lanzar(PASOS, 'inicio'));
    expect(screen.getByText('Paso dos')).toBeTruthy();
    expect(screen.queryByText('Paso uno')).toBeNull();
  }, 15000);

  it('no usa `Modal`: la capa se pinta sobre la navegación y no se rehace entre pasos', async () => {
    await montar();
    await act(async () => lanzar(PASOS));
    await waitFor(() => expect(screen.getByText('Paso uno')).toBeTruthy(), { timeout: 4000 });
    const tipos: string[] = [];
    const recorrer = (nodo: unknown): void => {
      if (Array.isArray(nodo)) return nodo.forEach(recorrer);
      if (nodo && typeof nodo === 'object' && 'type' in nodo) {
        tipos.push(String((nodo as { type: string }).type));
        recorrer((nodo as { children?: unknown }).children ?? null);
      }
    };
    recorrer(screen.toJSON());
    expect(tipos).not.toContain('Modal');
  });

  it('un objetivo que no aparece no bloquea: la tarjeta sale igual, y «Saltar» cierra y lo marca visto', async () => {
    await montar();
    await act(async () => lanzar([PASOS[1]!], 'prueba.v1'));
    await waitFor(() => expect(screen.getByText('Paso dos')).toBeTruthy(), { timeout: 4000 });
    await fireEvent.press(screen.getByTestId('tour-saltar'));
    expect(screen.queryByText('Paso dos')).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('atlas.tour.seen.prueba.v1', '1');
  });

  it('«Siguiente» avanza y «Entendido» cierra', async () => {
    await montar();
    await act(async () => lanzar(PASOS));
    await waitFor(() => expect(screen.getByText('Paso uno')).toBeTruthy(), { timeout: 4000 });
    await fireEvent.press(screen.getByTestId('tour-siguiente'));
    await waitFor(() => expect(screen.getByText('Paso dos')).toBeTruthy(), { timeout: 4000 });
    expect(screen.getByText('Entendido')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tour-siguiente'));
    expect(screen.queryByText('Paso dos')).toBeNull();
  }, 15_000);
});
