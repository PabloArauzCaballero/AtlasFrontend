/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock y isolateModules solo admiten require. */
/**
 * Un QR que el servidor ya rechazo no se reenvia en bucle mientras siga delante de la camara.
 *
 * Medido en el emulador el 2026-09-26: con un QR inexistente en el cuadro, la app lo mandaba cada
 * 1,5 s (el cerrojo se soltaba y el siguiente fotograma lo volvia a leer), con vibracion cada vez.
 * Aqui la camara se simula: cada `leer()` es un fotograma con el QR dentro.
 */
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import ScanScreen from '../app/(app)/(tabs)/escanear';
import { resolveMerchantQr } from '../src/api/endpoints/loans';

let mockAlLeer: ((evento: { data: string }) => void) | null = null;

jest.mock('expo-camera', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: (evento: { data: string }) => void }) => {
      mockAlLeer = props.onBarcodeScanned ?? null;
      return <View testID="visor-qr" />;
    },
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/escanear',
  useIsFocused: () => true,
}));
jest.mock('../src/api/endpoints/loans', () => ({ resolveMerchantQr: jest.fn() }));
jest.mock('../src/sandbox/store', () => ({
  useSandbox: () => ({ scan: () => ({ ok: false, rejection: { code: 'QR_NOT_RECOGNIZED' } }), scanResolved: () => ({ sessionId: null }) }),
}));

const resolver = resolveMerchantQr as jest.Mock;
const MALO = 'SN-0000000000000-NOEXIS';
const OTRO = 'SN-1111111111111-OTROXX';

const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function leer(token: string) {
  await act(async () => {
    mockAlLeer?.({ data: token });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  resolver.mockReset();
  resolver.mockRejectedValue(new Error('[404] QR_NOT_RECOGNIZED'));
});
afterEach(() => {
  jest.useRealTimers();
});

it('el mismo QR rechazado no se vuelve a mandar hasta que pasan diez segundos', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metricas}>
      <ScanScreen />
    </SafeAreaProvider>,
  );
  await leer(MALO);
  await waitFor(() => expect(screen.getByText('Este QR no es de Atlas')).toBeTruthy());
  expect(resolver).toHaveBeenCalledTimes(1);

  // Hoy: a los 1,5 s se soltaba el cerrojo y el siguiente fotograma lo reenviaba.
  for (let segundo = 0; segundo < 9; segundo++) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    await leer(MALO);
  }
  expect(resolver).toHaveBeenCalledTimes(1);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_100);
  });
  await leer(MALO);
  expect(resolver).toHaveBeenCalledTimes(2);
});

it('otro QR se manda en cuanto se suelta el cerrojo, sin esperar los diez segundos', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metricas}>
      <ScanScreen />
    </SafeAreaProvider>,
  );
  await leer(MALO);
  await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_600);
  });
  await leer(OTRO);
  expect(resolver).toHaveBeenCalledTimes(2);
  expect(resolver).toHaveBeenLastCalledWith(OTRO);
});
