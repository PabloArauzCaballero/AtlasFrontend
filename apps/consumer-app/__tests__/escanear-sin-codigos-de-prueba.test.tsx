import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Escanear from '../app/(app)/(tabs)/escanear';

/**
 * La pantalla de escaneo no ofrece «Códigos de prueba», ni siquiera cuando la compra corre en sandbox
 * (TEST): el cliente veía dos botones de demostración que no le servían. «Ingresar el código a mano»
 * se queda: es el respaldo cuando el QR no se lee.
 */
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
  usePathname: () => '/escanear',
}));
jest.mock('../src/api/config', () => ({ ...jest.requireActual('../src/api/config'), isSandboxPurchase: true }));
jest.mock('../src/api/endpoints/loans', () => ({ resolveMerchantQr: jest.fn() }));
jest.mock('../src/sandbox/store', () => ({ useSandbox: () => ({ ready: true, scan: jest.fn(), scanResolved: jest.fn(), state: { orders: [], schedules: [], claims: [] } }) }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('en sandbox NO pinta la tarjeta «Códigos de prueba»', async () => {
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Escanear />
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Ingresar el código a mano')).toBeTruthy();
  expect(screen.queryByText('Códigos de prueba')).toBeNull();
  expect(screen.queryByText('Comercio válido')).toBeNull();
  expect(screen.queryByText('Comercio con QR revocado')).toBeNull();
});
