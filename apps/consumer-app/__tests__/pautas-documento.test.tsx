import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import PautasDocumento from '../app/(onboarding)/pautas-documento';

/** C5 — las pautas del documento, con sus imágenes, en una pantalla de información propia. */
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/pautas-documento',
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const pintar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PautasDocumento />
    </SafeAreaProvider>,
  );

describe('Pautas para tus fotos', () => {
  it('abre en el documento con las tres pautas pedidas y la de encuadre', async () => {
    await pintar();
    expect(screen.getByText('Pautas para el documento de identidad')).toBeTruthy();
    for (const titulo of ['Buena iluminación', 'Evita los reflejos', 'Enfoque y nitidez', 'De frente, sin inclinar'])
      expect(screen.getByText(titulo)).toBeTruthy();
  });

  it('cada pauta enseña una imagen correcta y una incorrecta, descritas para el lector de pantalla', async () => {
    await pintar();
    expect(screen.getAllByLabelText(/^Correcto: /)).toHaveLength(4);
    expect(screen.getByLabelText('Incorrecto: Carnet demasiado oscuro, no se lee')).toBeTruthy();
    expect(screen.getByLabelText('Incorrecto: Carnet con una franja de reflejo sobre el texto')).toBeTruthy();
    expect(screen.getByLabelText('Incorrecto: Carnet borroso, movido')).toBeTruthy();
    // El bien y el mal no se distinguen sólo por color: llevan su rótulo escrito.
    expect(screen.getAllByText('Correcto')).toHaveLength(4);
    expect(screen.getAllByText('Incorrecto')).toHaveLength(4);
  });

  it('la pestaña Selfie cambia a las pautas de la selfie', async () => {
    await pintar();
    await fireEvent.press(screen.getByLabelText('Pautas para la selfie'));
    expect(screen.getByText('Pautas para la selfie')).toBeTruthy();
    expect(screen.getByText('Sin accesorios')).toBeTruthy();
    expect(screen.queryByText('Evita los reflejos')).toBeNull();
  });
});
