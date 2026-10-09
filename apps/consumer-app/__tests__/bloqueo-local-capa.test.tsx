/**
 * APP-13: la capa del bloqueo. Con sesion restaurada y biometria, al abrir pide Face ID; si falla, el
 * PIN desbloquea sin cerrar la sesion; con el bloqueo apagado no aparece; al volver de segundo plano
 * tras mas de cinco minutos vuelve a aparecer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as authApi from '../src/api/endpoints/auth';
import * as biometria from '../src/device/biometria';
import { estaBloqueada, guardarPreferenciaDeBloqueo, marcarSesionRecienAbierta, olvidarBloqueo, UMBRAL_BLOQUEO_MS } from '../src/features/bloqueo-local';
import { BloqueoLocal } from '../src/ui/bloqueo-local';

jest.mock('../src/api/endpoints/auth', () => ({ verifyPin: jest.fn() }));
jest.mock('../src/device/biometria', () => ({
  leerBiometria: jest.fn(),
  autenticarConBiometria: jest.fn(),
  nombreDeLaBiometria: () => 'Face ID',
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
  enableAppSwitcherProtectionAsync: jest.fn(async () => undefined),
  disableAppSwitcherProtectionAsync: jest.fn(async () => undefined),
}));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('../src/session/session', () => ({
  useSession: () => ({ status: "authenticated", signOut: mockSignOut }),
}));

const verifyPin = authApi.verifyPin as jest.Mock;
const leerBiometria = biometria.leerBiometria as jest.Mock;
const autenticar = biometria.autenticarConBiometria as jest.Mock;

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BloqueoLocal />
    </SafeAreaProvider>,
  );

let cambioDeEstado: ((estado: string) => void) | null = null;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  olvidarBloqueo();
  cambioDeEstado = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, oyente) => {
    cambioDeEstado = oyente as (estado: string) => void;
    return { remove: jest.fn() } as never;
  });
  leerBiometria.mockResolvedValue({ disponible: true, tipo: 'rostro' });
});

it('al abrir con sesion guardada pide Face ID y, si reconoce, desbloquea', async () => {
  autenticar.mockResolvedValue('ok');
  await montar();
  await waitFor(() => expect(autenticar).toHaveBeenCalled());
  await waitFor(() => expect(estaBloqueada()).toBe(false));
  expect(screen.queryByTestId('bloqueo-local')).toBeNull();
});

it('si Face ID falla, el PIN de la cuenta desbloquea sin cerrar la sesion', async () => {
  autenticar.mockResolvedValue('fallo');
  verifyPin.mockResolvedValue({ verified: true, verifiedAt: 'x' });
  await montar();
  await waitFor(() => expect(screen.getByTestId('bloqueo-local')).toBeTruthy());
  await waitFor(() => expect(screen.getAllByText(/No pudimos reconocer/).length).toBeGreaterThan(0));
  fireEvent.changeText(screen.getByLabelText('PIN'), '4821');
  await waitFor(() => expect(verifyPin).toHaveBeenCalledWith('4821'));
  await waitFor(() => expect(screen.queryByTestId('bloqueo-local')).toBeNull());
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('con el bloqueo apagado en el perfil no aparece', async () => {
  await guardarPreferenciaDeBloqueo('desactivado');
  await montar();
  await act(async () => undefined);
  await act(async () => undefined);
  expect(screen.queryByTestId('bloqueo-local')).toBeNull();
  expect(autenticar).not.toHaveBeenCalled();
});

it('recien entrado con el PIN no se pide; al volver tras mas de cinco minutos, si', async () => {
  marcarSesionRecienAbierta();
  autenticar.mockResolvedValue('cancelado');
  const ahora = jest.spyOn(Date, 'now');
  ahora.mockReturnValue(1_000_000);
  await montar();
  await act(async () => undefined);
  expect(screen.queryByTestId('bloqueo-local')).toBeNull();

  await act(async () => cambioDeEstado?.('background'));
  ahora.mockReturnValue(1_000_000 + 60_000);
  await act(async () => cambioDeEstado?.('active'));
  expect(screen.queryByTestId('bloqueo-local')).toBeNull();

  await act(async () => cambioDeEstado?.('background'));
  ahora.mockReturnValue(2_000_000 + UMBRAL_BLOQUEO_MS + 1);
  await act(async () => cambioDeEstado?.('active'));
  await waitFor(() => expect(screen.getByTestId('bloqueo-local')).toBeTruthy());
  ahora.mockRestore();
});
