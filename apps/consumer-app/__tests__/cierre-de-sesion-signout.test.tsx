/**
 * `signOut` con el cierre de sesion del servidor en contra.
 *
 * El cierre en el servidor es una anotacion: si la red cuelga o el backend responde 4xx, la persona
 * sale IGUAL, en 5 s como mucho, y los tokens se borran del dispositivo.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import * as authApi from '../src/api/endpoints/auth';
import * as customerApi from '../src/api/endpoints/customer';
import { AtlasApiError } from '../src/api/errors';
import { SessionProvider, useSession, type SessionValue } from '../src/session/session';
import { secureTokenStore, profileStorage } from '../src/session/token-storage';
import { PLAZO_CIERRE_MS } from '../src/session/cierre-de-sesion';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/client', () => ({ configureClient: jest.fn() }));
jest.mock('../src/api/endpoints/auth', () => ({ logout: jest.fn(async () => undefined), login: jest.fn(), me: jest.fn() }));
jest.mock('../src/api/endpoints/customer', () => ({
  getMe: jest.fn(async () => ({ customer: { status: 'active' } })),
  startSession: jest.fn(async () => ({ sessionId: '901', deviceId: '77' })),
  endSession: jest.fn(),
}));
jest.mock('../src/api/endpoints/onboarding', () => ({
  getStatus: jest.fn(async () => ({ lifecycleStatus: 'active' })),
  startOnboarding: jest.fn(),
}));
jest.mock('../src/api/endpoints/telemetry', () => ({ enviarLote: jest.fn(async () => undefined) }));
jest.mock('../src/device/device', () => ({
  deviceIdentity: jest.fn(async () => ({
    deviceFingerprintHash: 'h',
    fingerprintVersion: 'v1',
    channel: 'mobile_app',
    userAgent: 'ua',
    snapshot: { osFamily: 'ios' },
  })),
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

const endSession = customerApi.endSession as jest.Mock;

async function montar(): Promise<{ actual: () => SessionValue }> {
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
  // Restaurar y abrir la sesion de telemetria: todo son promesas ya resueltas.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  return { actual: () => valor as unknown as SessionValue };
}

async function salirMidiendo(sesion: SessionValue): Promise<number> {
  let hecho = false;
  // Se ARRANCA dentro de `act` sin esperarlo: un `act` abierto mientras otro avanza los relojes no se
  // anida bien. Los avances de abajo tambien van en `act` y vacian las actualizaciones de estado.
  await act(async () => {
    void sesion.signOut().then(() => {
      hecho = true;
    });
  });
  let ms = 0;
  while (!hecho && ms <= PLAZO_CIERRE_MS + 1_000) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    ms += 100;
  }
  if (!hecho) throw new Error('signOut no termino');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  return ms;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('signOut y el cierre en el servidor', () => {
  it('con la red colgada, signOut termina en 5 s o menos y cierra la sesion local', async () => {
    endSession.mockImplementation(() => new Promise(() => undefined));
    const { actual } = await montar();
    expect(actual().status).toBe('authenticated');

    const ms = await salirMidiendo(actual());

    expect(ms).toBeLessThanOrEqual(PLAZO_CIERRE_MS);
    expect(endSession).toHaveBeenCalledWith('23', '901', 'customer_logout', expect.objectContaining({ signal: expect.anything() }));
    expect(authApi.logout).toHaveBeenCalledWith('r');
    expect(secureTokenStore.clear).toHaveBeenCalled();
    expect(profileStorage.clear).toHaveBeenCalled();
    expect(actual().status).toBe('anonymous');
  });

  it('un 4xx del cierre no bloquea el cierre local', async () => {
    endSession.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'VALIDATION_ERROR', message: 'no', status: 400 }));
    const { actual } = await montar();

    const ms = await salirMidiendo(actual());

    expect(ms).toBeLessThan(PLAZO_CIERRE_MS);
    expect(secureTokenStore.clear).toHaveBeenCalled();
    expect(actual().status).toBe('anonymous');
  });
});
