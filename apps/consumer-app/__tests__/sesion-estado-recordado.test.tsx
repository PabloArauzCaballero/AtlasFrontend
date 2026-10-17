/**
 * Abrir la app con sesión guardada ya no espera un viaje con la pantalla en blanco (2026-10-17).
 *
 * Antes no se entraba a ningún área hasta que volvía el estado del alta, y la portada sólo pedía lo suyo después:
 * dos tandas en serie a 210 ms cada una desde Santa Cruz. Con el último estado que dio el servidor se entra YA,
 * con el candado puesto, y cuando el servidor contesta manda él.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { estaBloqueada, olvidarBloqueo } from '../src/features/bloqueo-local';
import { areaFor, SessionProvider, useSession, type SessionValue } from '../src/session/session';
import { guardarInicioConPin } from '../src/session/tope-de-sesion';
import { CLAVE_ESTADO_RECORDADO, leerEstadoRecordado, recordarEstado } from '../src/session/estado-recordado';
import { limpiarDatosLocales } from '../src/session/datos-locales';
import * as onboardingApi from '../src/api/endpoints/onboarding';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/client', () => ({ configureClient: jest.fn() }));
jest.mock('../src/api/endpoints/auth', () => ({
  logout: jest.fn(async () => undefined),
  login: jest.fn(async () => ({ accessToken: 'a2', refreshToken: 'r2' })),
  me: jest.fn(async () => ({ customerId: '23', actorId: '23' })),
}));
jest.mock('../src/api/endpoints/customer', () => ({
  getMe: jest.fn(async () => ({ customer: { status: 'active' } })),
  startSession: jest.fn(async () => ({ sessionId: '901', deviceId: '77' })),
  endSession: jest.fn(async () => undefined),
}));
jest.mock('../src/api/endpoints/onboarding', () => ({
  getStatus: jest.fn(async () => ({ lifecycleStatus: 'active' })),
  startOnboarding: jest.fn(),
}));
jest.mock('../src/api/endpoints/telemetry', () => ({ enviarLote: jest.fn(async () => undefined) }));
jest.mock('../src/device/device', () => ({
  deviceIdentity: jest.fn(async () => ({ deviceFingerprintHash: 'h', fingerprintVersion: 'v1', channel: 'mobile_app', userAgent: 'ua', snapshot: {} })),
  snapshotDeSesion: jest.fn((snapshot: Record<string, unknown>) => snapshot),
}));
jest.mock('../src/device/permissions', () => ({ permisosDecididos: jest.fn(async () => []) }));
jest.mock('../src/session/device-signals', () => ({
  activarSeñalesDelDispositivo: jest.fn(async () => undefined),
  desactivarSeñalesDelDispositivo: jest.fn(async () => undefined),
}));
jest.mock('../src/features/bitacora', () => ({
  bitacora: { arrancar: jest.fn(async () => undefined), cerrar: jest.fn(async () => undefined), adjuntarSesion: jest.fn() },
}));
jest.mock('../src/session/use-rastreo-primer-plano', () => ({ useRastreoEnPrimerPlano: jest.fn() }));
jest.mock('../src/session/token-storage', () => ({
  secureTokenStore: {
    read: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
    write: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
  profileStorage: {
    read: jest.fn(async () => ({ customerId: '23', displayName: null, identifier: 'x' })),
    write: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));


async function montar(): Promise<() => SessionValue> {
  let valor: SessionValue | null = null;
  function Espia() {
    valor = useSession();
    return null;
  }
  await render(
    <SessionProvider>
      <Espia />
    </SessionProvider>,
  );
  return () => valor as unknown as SessionValue;
}

/** El estado del alta queda colgado hasta que la prueba lo suelte: es el viaje al servidor. */
function servidorQueTarda() {
  let soltar: (valor: { lifecycleStatus: string }) => void = () => undefined;
  jest.mocked(onboardingApi.getStatus).mockImplementationOnce(
    () => new Promise((resolve) => (soltar = resolve as typeof soltar)) as ReturnType<typeof onboardingApi.getStatus>,
  );
  return (lifecycleStatus: string) => soltar({ lifecycleStatus });
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  olvidarBloqueo();
  await guardarInicioConPin(Date.now());
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('entrar con el estado recordado', () => {
  it('con un estado recordado entra al área YA, con el candado puesto, sin esperar al servidor', async () => {
    await recordarEstado('23', 'active');
    const soltar = servidorQueTarda();
    const sesion = await montar();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(sesion().status).toBe('authenticated');
    expect(areaFor(sesion())).toBe('app');
    expect(estaBloqueada()).toBe(true);

    await act(async () => {
      soltar('active');
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(areaFor(sesion())).toBe('app');
  });

  it('si la cuenta cambió, manda lo que dice el servidor', async () => {
    await recordarEstado('23', 'active');
    const soltar = servidorQueTarda();
    const sesion = await montar();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(areaFor(sesion())).toBe('app');

    await act(async () => {
      soltar('suspended');
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(areaFor(sesion())).toBe('onboarding');
    expect(await leerEstadoRecordado('23')).toBe('suspended');
  });

  it('sin estado recordado espera al servidor como antes, y recuerda lo que dijo', async () => {
    const soltar = servidorQueTarda();
    const sesion = await montar();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(sesion().status).toBe('restoring');

    await act(async () => {
      soltar('active');
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(sesion().status).toBe('authenticated');
    expect(await leerEstadoRecordado('23')).toBe('active');
  });

  it('el estado de OTRO cliente no vale', async () => {
    await recordarEstado('99', 'active');
    servidorQueTarda();
    const sesion = await montar();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(sesion().status).toBe('restoring');
  });

  it('se borra al cerrar sesión y al limpiar los datos locales', async () => {
    await recordarEstado('23', 'active');
    const sesion = await montar();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await sesion().signOut();
    });
    expect(await AsyncStorage.getItem(CLAVE_ESTADO_RECORDADO)).toBeNull();

    await recordarEstado('23', 'active');
    await limpiarDatosLocales();
    expect(await AsyncStorage.getItem(CLAVE_ESTADO_RECORDADO)).toBeNull();
  });
});
