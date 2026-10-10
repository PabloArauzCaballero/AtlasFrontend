/**
 * La duración de la sesión al estándar bancario y la salida que nunca deja la app colgada.
 *
 * - Tope ABSOLUTO de 8 h desde el último inicio con PIN: pasado, se pide el inicio completo (no sólo Face ID), al
 *   abrir en frío, al volver al frente o con la app abierta. Sin saber cuándo empezó, se da por vencida.
 * - El 401 `SESSION_EXPIRED` del servidor (el tope del refresco en AtlasBackend) se trata igual: «vuelve a entrar»,
 *   con el mensaje de las 8 h.
 * - Abrir en frío una sesión guardada deja la app BLOQUEADA (Face ID / PIN) antes del primer fotograma.
 * - «Cerrar sesión» termina siempre, con la red colgada incluida, en `PLAZO_SALIDA_MS` como mucho.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import * as client from '../src/api/client';
import * as authApi from '../src/api/endpoints/auth';
import * as customerApi from '../src/api/endpoints/customer';
import { estaBloqueada, olvidarBloqueo } from '../src/features/bloqueo-local';
import { PLAZO_SALIDA_MS, SessionProvider, useSession, type SessionValue } from '../src/session/session';
import { secureTokenStore } from '../src/session/token-storage';
import {
  guardarInicioConPin,
  leerInicioConPin,
  MENSAJE_SESION_CADUCADA,
  mensajeDeSalida,
  sesionVencida,
  TOPE_DE_SESION_MS,
} from '../src/session/tope-de-sesion';

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

const HORA = 60 * 60 * 1000;

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
    await jest.advanceTimersByTimeAsync(0);
  });
  return () => valor as unknown as SessionValue;
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  olvidarBloqueo();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('la regla del tope', () => {
  it('8 h justas ya vencen; un minuto antes no', () => {
    const inicio = Date.parse('2026-10-09T08:00:00Z');
    expect(TOPE_DE_SESION_MS).toBe(8 * HORA);
    expect(sesionVencida(inicio, inicio + 8 * HORA - 60_000)).toBe(false);
    expect(sesionVencida(inicio, inicio + 8 * HORA)).toBe(true);
  });

  it('sin saber cuándo empezó, o con el reloj atrasado, se da por vencida', () => {
    expect(sesionVencida(null, Date.now())).toBe(true);
    expect(sesionVencida(Number.NaN, Date.now())).toBe(true);
    expect(sesionVencida(Date.now() + 60_000, Date.now())).toBe(true);
  });

  it('el mensaje que ve la persona', () => {
    expect(mensajeDeSalida('sesion_caducada')).toBe('Por seguridad, tu sesión dura 8 horas. Vuelve a entrar con tu PIN.');
    expect(mensajeDeSalida(null)).toBeNull();
  });
});

describe('al abrir en frío', () => {
  it('dentro del tope: entra, pero BLOQUEADA hasta Face ID o el PIN', async () => {
    await guardarInicioConPin(Date.now() - 2 * HORA);
    const sesion = await montar();
    expect(sesion().status).toBe('authenticated');
    expect(estaBloqueada()).toBe(true);
  });

  it('pasadas las 8 h: no entra, cierra también en el servidor y dice por qué', async () => {
    await guardarInicioConPin(Date.now() - 8 * HORA - 1);
    const sesion = await montar();
    expect(sesion().status).toBe('anonymous');
    expect(sesion().motivoDeSalida).toBe('sesion_caducada');
    expect(authApi.logout).toHaveBeenCalledWith('r');
    expect(secureTokenStore.clear).toHaveBeenCalled();
  });

  it('una sesión de una versión anterior (sin hora de inicio) pide el PIN', async () => {
    const sesion = await montar();
    expect(sesion().status).toBe('anonymous');
    expect(sesion().motivoDeSalida).toBe('sesion_caducada');
  });
});

describe('con la app abierta', () => {
  it('al cumplirse las 8 h se cierra sola y pide el inicio completo', async () => {
    await guardarInicioConPin(Date.now() - 7 * HORA - 59 * 60_000);
    const sesion = await montar();
    expect(sesion().status).toBe('authenticated');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(sesion().status).toBe('anonymous');
    expect(mensajeDeSalida(sesion().motivoDeSalida)).toBe(MENSAJE_SESION_CADUCADA);
  });

  it('el 401 SESSION_EXPIRED del servidor lleva a entrar de nuevo con el mensaje de las 8 h', async () => {
    await guardarInicioConPin(Date.now());
    const sesion = await montar();
    const { onSessionExpired } = (client.configureClient as jest.Mock).mock.calls[0][0];
    await act(async () => onSessionExpired('SESSION_EXPIRED'));
    expect(sesion().status).toBe('anonymous');
    expect(sesion().motivoDeSalida).toBe('sesion_caducada');
    expect(estaBloqueada()).toBe(false);
  });

  it('otro rechazo del servidor también saca, con un mensaje genérico', async () => {
    await guardarInicioConPin(Date.now());
    const sesion = await montar();
    const { onSessionExpired } = (client.configureClient as jest.Mock).mock.calls[0][0];
    await act(async () => onSessionExpired('UNAUTHORIZED'));
    expect(sesion().motivoDeSalida).toBe('sesion_cerrada');
  });
});

describe('entrar y salir', () => {
  it('entrar con el PIN empieza el tope de nuevo, borra el motivo y no deja candado', async () => {
    const sesion = await montar();
    expect(sesion().motivoDeSalida).toBe('sesion_caducada');
    await act(async () => {
      await sesion().signIn('x', '1234');
    });
    expect(sesion().status).toBe('authenticated');
    expect(sesion().motivoDeSalida).toBeNull();
    expect(estaBloqueada()).toBe(false);
    expect(await leerInicioConPin()).toBe(Date.now());
  });

  it('«Cerrar sesión» con la red colgada termina igual, en el plazo, y una sola vez aunque se pulse dos', async () => {
    await guardarInicioConPin(Date.now());
    (customerApi.endSession as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    (authApi.logout as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    const sesion = await montar();
    let terminadas = 0;
    await act(async () => {
      void sesion().signOut().then(() => (terminadas += 1));
      void sesion().signOut().then(() => (terminadas += 1));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PLAZO_SALIDA_MS);
    });
    expect(terminadas).toBe(2);
    expect(customerApi.endSession).toHaveBeenCalledTimes(1);
    expect(sesion().status).toBe('anonymous');
    expect(sesion().motivoDeSalida).toBeNull();
    expect(secureTokenStore.clear).toHaveBeenCalled();
    expect(await leerInicioConPin()).toBeNull();
  });
});
