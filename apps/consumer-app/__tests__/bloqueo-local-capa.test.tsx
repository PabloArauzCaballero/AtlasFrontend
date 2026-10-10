/**
 * APP-13: la capa del bloqueo montada, con `AppState` y relojes falsos. Al abrir en frio pide Face ID; si falla, el
 * PIN desbloquea sin cerrar la sesion; sin biometria pide el PIN; y con la app abierta se tapa al volver tras mas de
 * 60 s fuera y tras 5 min sin tocarla, y no se tapa en las salidas cortas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as authApi from '../src/api/endpoints/auth';
import * as biometria from '../src/device/biometria';
import {
  bloquearAlArrancar,
  estaBloqueada,
  INACTIVIDAD_MS,
  marcarSesionRecienAbierta,
  olvidarBloqueo,
  registrarInteraccion,
  REVISION_MS,
  SALIDA_CORTA_MS,
} from '../src/features/bloqueo-local';
import { BloqueoLocal } from '../src/ui/bloqueo-local';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
  // Todos los oyentes de `AppState` (el vigilante y el candado), como en el sistema.
  const oyentes = new Set<(estado: string) => void>();
  cambioDeEstado = (estado) => [...oyentes].forEach((oyente) => oyente(estado));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, oyente) => {
    oyentes.add(oyente as (estado: string) => void);
    return { remove: () => oyentes.delete(oyente as (estado: string) => void) } as never;
  });
  leerBiometria.mockResolvedValue({ disponible: true, tipo: 'rostro' });
});

it('al abrir en frio con sesion guardada pide Face ID y, si reconoce, desbloquea', async () => {
  autenticar.mockResolvedValue('ok');
  bloquearAlArrancar();
  await montar();
  await waitFor(() => expect(autenticar).toHaveBeenCalled());
  await waitFor(() => expect(estaBloqueada()).toBe(false));
  expect(screen.queryByTestId('bloqueo-local')).toBeNull();
});

it('si Face ID falla, el PIN de la cuenta desbloquea sin cerrar la sesion', async () => {
  autenticar.mockResolvedValue('fallo');
  verifyPin.mockResolvedValue({ verified: true, verifiedAt: 'x' });
  bloquearAlArrancar();
  await montar();
  await waitFor(() => expect(screen.getByTestId('bloqueo-local')).toBeTruthy());
  await waitFor(() => expect(screen.getAllByText(/No pudimos reconocer/).length).toBeGreaterThan(0));
  fireEvent.changeText(screen.getByLabelText('PIN'), '4821');
  await waitFor(() => expect(verifyPin).toHaveBeenCalledWith('4821'));
  await waitFor(() => expect(screen.queryByTestId('bloqueo-local')).toBeNull());
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('sin biometria registrada pide el PIN, y no hay forma de apagarlo (ya no hay ajuste)', async () => {
  leerBiometria.mockResolvedValue({ disponible: false, tipo: null });
  // Lo que dejo guardado la version con ajuste ya no se lee.
  await AsyncStorage.setItem('atlas.bloqueo.preferencia', 'desactivado');
  bloquearAlArrancar();
  await montar();
  await waitFor(() => expect(screen.getByLabelText('PIN')).toBeTruthy());
  expect(autenticar).not.toHaveBeenCalled();
  expect(screen.getByTestId('bloqueo-local')).toBeTruthy();
});

describe('con la app abierta (relojes falsos)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    autenticar.mockResolvedValue('cancelado');
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const pasar = async (ms: number) => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  };
  const estado = async (valor: string) => {
    await act(async () => cambioDeEstado?.(valor));
  };

  it('recien entrado con el PIN no se pide; iOS fuera 30 s no; fuera 61 s si', async () => {
    marcarSesionRecienAbierta();
    await montar();
    await pasar(0);
    expect(screen.queryByTestId('bloqueo-local')).toBeNull();

    await estado('inactive');
    await estado('background');
    await pasar(30_000);
    await estado('active');
    expect(screen.queryByTestId('bloqueo-local')).toBeNull();

    await estado('inactive');
    await estado('background');
    await pasar(SALIDA_CORTA_MS + 1_000);
    await estado('inactive');
    await estado('active');
    expect(screen.getByTestId('bloqueo-local')).toBeTruthy();
  });

  it('con el candado puesto, volver de segundo plano vuelve a pedir Face ID; la propia hoja (inactive) no', async () => {
    bloquearAlArrancar();
    await montar();
    await pasar(0);
    expect(autenticar).toHaveBeenCalledTimes(1);
    // Cancelar la hoja de Face ID: `inactive → active`, sin volver a pedirla en bucle.
    await estado('inactive');
    await estado('active');
    await pasar(0);
    expect(autenticar).toHaveBeenCalledTimes(1);
    // Salir y volver con el candado puesto: se vuelve a pedir.
    await estado('background');
    await estado('active');
    await pasar(0);
    expect(autenticar).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('bloqueo-local')).toBeTruthy();
  });

  it('la hoja de Face ID o un permiso (`active → inactive → active`) no bloquean', async () => {
    marcarSesionRecienAbierta();
    await montar();
    await estado('inactive');
    await pasar(20_000);
    await estado('active');
    expect(screen.queryByTestId('bloqueo-local')).toBeNull();
  });

  it('5 min sin tocar la pantalla la tapan; tocarla a los 4 reinicia la cuenta', async () => {
    marcarSesionRecienAbierta();
    await montar();
    await pasar(4 * 60_000);
    registrarInteraccion();
    await pasar(4 * 60_000);
    expect(screen.queryByTestId('bloqueo-local')).toBeNull();
    await pasar(INACTIVIDAD_MS - 4 * 60_000 + REVISION_MS);
    expect(screen.getByTestId('bloqueo-local')).toBeTruthy();
  });
});
