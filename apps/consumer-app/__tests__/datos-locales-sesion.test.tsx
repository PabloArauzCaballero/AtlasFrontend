/**
 * `signOut` limpia los datos locales del cliente, y `signIn` también cuando entra un cliente distinto
 * del último que hubo en el teléfono (la sesión del anterior caducó sin `signOut`).
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import * as authApi from '../src/api/endpoints/auth';
import { SessionProvider, useSession, type SessionValue } from '../src/session/session';
import { profileStorage } from '../src/session/token-storage';
import { guardarInicioConPin } from '../src/session/tope-de-sesion';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/client', () => ({ configureClient: jest.fn() }));
jest.mock('../src/api/endpoints/auth', () => ({
  logout: jest.fn(async () => undefined),
  login: jest.fn(async () => ({ accessToken: 'a2', refreshToken: 'r2' })),
  me: jest.fn(async () => ({ customerId: '23', actorId: '23' })),
}));
const mockLimpiar = jest.fn(async () => undefined);
jest.mock('../src/session/datos-locales', () => ({ limpiarDatosLocales: () => mockLimpiar() }));
jest.mock('../src/session/cierre-de-sesion', () => ({ cerrarSesionEnServidor: jest.fn(async () => undefined) }));
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return () => valor as unknown as SessionValue;
}

beforeEach(async () => {
  jest.clearAllMocks();
  // Una sesión abierta con el PIN hace un rato: dentro del tope de 8 h (`session/tope-de-sesion.ts`).
  await guardarInicioConPin(Date.now());
});

describe('lo que deja un cliente en el teléfono (APP-09)', () => {
  it('cerrar sesión lo limpia', async () => {
    const sesion = await montar();
    await act(async () => {
      await sesion().signOut();
    });
    expect(mockLimpiar).toHaveBeenCalledTimes(1);
    expect(sesion().status).toBe('anonymous');
  });

  it('entrar con OTRO cliente (la sesión del anterior caducó) lo limpia antes de enseñar nada', async () => {
    const sesion = await montar();
    (authApi.me as jest.Mock).mockResolvedValueOnce({ customerId: '99', actorId: '99' });
    await act(async () => {
      await sesion().signIn('otra@example.com', '1234');
    });
    expect(mockLimpiar).toHaveBeenCalledTimes(1);
    expect(profileStorage.write).toHaveBeenCalledWith(expect.objectContaining({ customerId: '99' }));
  });

  it('volver a entrar el MISMO cliente no borra nada', async () => {
    const sesion = await montar();
    await act(async () => {
      await sesion().signIn('x', '1234');
    });
    expect(mockLimpiar).not.toHaveBeenCalled();
  });
});
