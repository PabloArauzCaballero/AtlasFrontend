/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock solo admiten require. */
/**
 * Leer un QR siempre hace algo visible, y una falla del CAMINO no se confunde con un QR falso.
 *
 * Antes cualquier error de `merchant-qr/resolve` salia como «Este QR no es de Atlas» y se anotaba
 * como rechazo (la camara lo ignoraba diez segundos): con la red caida, un QR perfecto quedaba
 * acusado de falso. Y mientras el servidor contestaba la pantalla no decia nada.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import ScanScreen from '../app/(app)/(tabs)/escanear';
import { resolveMerchantQr } from '../src/api/endpoints/loans';
import { AtlasApiError } from '../src/api/errors';

let mockAlLeer: ((evento: { data: string }) => void) | null = null;
const mockPush = jest.fn();

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
  useRouter: () => ({ replace: jest.fn(), push: mockPush, back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/escanear',
  useIsFocused: () => true,
}));
jest.mock('../src/api/endpoints/loans', () => ({ resolveMerchantQr: jest.fn() }));
jest.mock('../src/sandbox/store', () => ({
  useSandbox: () => ({
    scan: () => ({ ok: false, rejection: { code: 'QR_NOT_RECOGNIZED' } }),
    scanResolved: () => ({ sessionId: 'sesion-1' }),
  }),
}));

const resolver = resolveMerchantQr as jest.Mock;
const QR = 'TIENDA-NORTE-1A2B3C-CAJA-1';

const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const pantalla = () =>
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <ScanScreen />
    </SafeAreaProvider>,
  );

async function leer(token: string) {
  await act(async () => {
    mockAlLeer?.({ data: token });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  resolver.mockReset();
  mockPush.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

it('mientras el servidor confirma el QR la pantalla lo dice', async () => {
  let responder: (valor: unknown) => void = () => undefined;
  resolver.mockReturnValue(new Promise((resolve) => (responder = resolve)));
  await pantalla();

  await leer(QR);
  expect(screen.getByText('Verificando el código…')).toBeTruthy();

  await act(async () => {
    responder({ partnerProfileId: '1', branchId: '1', posTerminalId: '1', displayName: 'Tienda Sol', businessCategory: null, verified: true });
  });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/compra/monto?sessionId=sesion-1'));
  expect(screen.queryByText('Verificando el código…')).toBeNull();
});

it('con la red caída dice «Sin conexión», no «Este QR no es de Atlas», y deja reintentar el mismo QR', async () => {
  resolver.mockRejectedValue(new AtlasApiError({ kind: 'network', code: 'NETWORK_UNREACHABLE', message: 'Network request failed' }));
  await pantalla();

  await leer(QR);
  await waitFor(() => expect(screen.getByText('Sin conexión')).toBeTruthy());
  expect(screen.queryByText('Este QR no es de Atlas')).toBeNull();

  // Pasa el cerrojo de 1,5 s y el MISMO QR vuelve a mandarse enseguida: no quedó anotado como rechazado.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1_600);
  });
  resolver.mockResolvedValue({ partnerProfileId: '1', branchId: '1', posTerminalId: '1', displayName: 'Tienda Sol', businessCategory: null, verified: true });
  await leer(QR);
  expect(resolver).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
});

it('un 5xx del servicio tampoco acusa al QR', async () => {
  resolver.mockRejectedValue(new AtlasApiError({ kind: 'server', code: 'INTERNAL_SERVER_ERROR', message: 'boom', status: 500 }));
  await pantalla();

  await leer(QR);
  await waitFor(() => expect(screen.getByText('Sin conexión')).toBeTruthy());
});

it('si el servidor dice que la caja no está activa, lo explica con su código', async () => {
  resolver.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'QR_EXPIRED', message: 'QR_EXPIRED', status: 422 }));
  await pantalla();

  await leer(QR);
  await waitFor(() => expect(screen.getByText('QR vencido')).toBeTruthy());
});

it('el código a mano se escribe en casillas: sólo entran los símbolos permitidos y al completarse se manda solo', async () => {
  resolver.mockResolvedValue({ partnerProfileId: '1', branchId: '1', posTerminalId: '1', displayName: 'Tienda Sol', businessCategory: null, verified: true });
  await pantalla();

  // «0», «O», «1», «I», «L», «U» y «V» no existen en el código: se descartan al escribir, como el PIN descarta las letras.
  await fireEvent.changeText(screen.getByLabelText('Código de la caja'), 'k0o7m2-9qxd');
  await waitFor(() => expect(resolver).toHaveBeenCalledWith('K7M29QXD'));
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
});

it('con el código incompleto no se manda y «Continuar» está bloqueado', async () => {
  await pantalla();

  await fireEvent.changeText(screen.getByLabelText('Código de la caja'), 'K7M2');
  expect(resolver).not.toHaveBeenCalled();
  expect(screen.getByText('El código de la caja tiene 8 caracteres.')).toBeTruthy();
});
