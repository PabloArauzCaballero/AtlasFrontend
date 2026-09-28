/**
 * El latido de la sesion (`useLatidoDeSesion`).
 *
 * `expire_stale_sessions` caduca por `COALESCE(last_activity_at, started_at)` y solo el latido
 * escribe `last_activity_at`. Estas pruebas fijan cuando late la app y cuando NO:
 *
 * 1. Late al volver a primer plano y cada `CADENCIA_LATIDO_MS`, holgada frente a la ventana de 2 h.
 * 2. No late sin sesion, ni en segundo plano, ni despues de cerrar sesion o desmontar.
 * 3. Un fallo no lanza ni rompe nada; un rechazo definitivo (422 `SESSION_NOT_ACTIVE`) deja de latir.
 */
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as customerApi from '../src/api/endpoints/customer';
import { AtlasApiError } from '../src/api/errors';
import { CADENCIA_LATIDO_MS, useLatidoDeSesion, type ContextoDeLatido } from '../src/session/use-latido-de-sesion';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/endpoints/customer', () => ({ sessionHeartbeat: jest.fn() }));

let mockClave = 0;
jest.mock('../src/api/client', () => ({ newIdempotencyKey: jest.fn(() => `clave-${++mockClave}`) }));

const sessionHeartbeat = customerApi.sessionHeartbeat as jest.Mock;

const SESION: ContextoDeLatido = { customerId: '23', sessionId: '901', deviceId: '77' };

let estadoActual: AppStateStatus = 'active';
let oyentes: ((estado: AppStateStatus) => void)[] = [];
let quitados = 0;

async function cambiarA(estado: AppStateStatus) {
  estadoActual = estado;
  await act(async () => {
    for (const oyente of [...oyentes]) oyente(estado);
    await Promise.resolve();
  });
}

async function avanzar(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

let aviso: jest.SpyInstance;
const estadoOriginal = Object.getOwnPropertyDescriptor(AppState, 'currentState');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockClave = 0;
  estadoActual = 'active';
  oyentes = [];
  quitados = 0;
  sessionHeartbeat.mockResolvedValue({ sessionId: '901', status: 'accepted' });
  // En el mock de react-native `currentState` es un dato, no un getter: se sustituye y se restaura.
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => estadoActual });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_tipo: string, oyente: (estado: AppStateStatus) => void) => {
    oyentes.push(oyente);
    return {
      remove: () => {
        quitados += 1;
        oyentes = oyentes.filter((o) => o !== oyente);
      },
    };
  }) as never);
  aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (estadoOriginal) Object.defineProperty(AppState, 'currentState', estadoOriginal);
});

describe('useLatidoDeSesion', () => {
  it('la cadencia deja holgura de sobra frente a la ventana de caducidad de 120 min', () => {
    expect(CADENCIA_LATIDO_MS).toBe(5 * 60 * 1000);
    expect(120 * 60 * 1000).toBeGreaterThanOrEqual(CADENCIA_LATIDO_MS * 20);
  });

  it('no late al montarse, y late cada N minutos en primer plano con el contrato del backend', async () => {
    await renderHook(() => useLatidoDeSesion(SESION));
    expect(sessionHeartbeat).not.toHaveBeenCalled();

    await avanzar(CADENCIA_LATIDO_MS - 1);
    expect(sessionHeartbeat).not.toHaveBeenCalled();
    await avanzar(1);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);

    const [customerId, sessionId, body, opciones] = sessionHeartbeat.mock.calls[0];
    expect(customerId).toBe('23');
    expect(sessionId).toBe('901');
    expect(body).toEqual({ deviceId: '77', clientHeartbeatId: 'hb-clave-1', capturedAt: expect.any(String) });
    expect(body.clientHeartbeatId.length).toBeLessThanOrEqual(120);
    expect(opciones.signal).toBeDefined();

    await avanzar(CADENCIA_LATIDO_MS * 2);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(3);
  });

  it('late al volver a primer plano', async () => {
    estadoActual = 'background';
    await renderHook(() => useLatidoDeSesion(SESION));
    await cambiarA('active');
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);

    // Y sigue con la cadencia desde ahi.
    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(2);
  });

  it('en segundo plano no late: se para el temporizador y se corta la llamada en curso', async () => {
    let señal: AbortSignal | undefined;
    sessionHeartbeat.mockImplementation((_c, _s, _b, opciones: { signal: AbortSignal }) => {
      señal = opciones.signal;
      return new Promise(() => undefined);
    });
    await renderHook(() => useLatidoDeSesion(SESION));
    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);

    await cambiarA('background');
    expect(señal?.aborted).toBe(true);

    await avanzar(CADENCIA_LATIDO_MS * 10);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('sin sesion no late nunca', async () => {
    await renderHook(() => useLatidoDeSesion(null));
    await cambiarA('background');
    await cambiarA('active');
    await avanzar(CADENCIA_LATIDO_MS * 3);
    expect(sessionHeartbeat).not.toHaveBeenCalled();
  });

  it('al cerrar sesion (contexto a null) se detiene y suelta el oyente', async () => {
    const { rerender } = await renderHook((props: { sesion: ContextoDeLatido | null }) => useLatidoDeSesion(props.sesion), {
      initialProps: { sesion: SESION },
    });
    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);

    await act(async () => {
      await rerender({ sesion: null });
    });
    expect(quitados).toBe(1);
    await cambiarA('background');
    await cambiarA('active');
    await avanzar(CADENCIA_LATIDO_MS * 3);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('al desmontar se detiene', async () => {
    const { unmount } = await renderHook(() => useLatidoDeSesion(SESION));
    await act(async () => {
      await unmount();
    });
    expect(oyentes).toHaveLength(0);
    await avanzar(CADENCIA_LATIDO_MS * 3);
    expect(sessionHeartbeat).not.toHaveBeenCalled();
  });

  it('un repintado con el mismo contexto en otro objeto no reinicia la cadencia', async () => {
    const { rerender } = await renderHook((props: { sesion: ContextoDeLatido }) => useLatidoDeSesion(props.sesion), {
      initialProps: { sesion: SESION },
    });
    await avanzar(CADENCIA_LATIDO_MS - 1_000);
    await act(async () => {
      await rerender({ sesion: { ...SESION } });
    });
    await avanzar(1_000);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('un fallo transitorio no lanza, deja log y el siguiente tic vuelve a latir', async () => {
    sessionHeartbeat.mockRejectedValueOnce(new AtlasApiError({ kind: 'network', code: 'NETWORK_ERROR', message: 'sin red' }));
    await renderHook(() => useLatidoDeSesion(SESION));
    await avanzar(CADENCIA_LATIDO_MS);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('NETWORK_ERROR'));

    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(2);
  });

  it('no encadena latidos: si el anterior sigue en curso, el tic se salta', async () => {
    sessionHeartbeat.mockImplementation(() => new Promise(() => undefined));
    await renderHook(() => useLatidoDeSesion(SESION));
    await avanzar(CADENCIA_LATIDO_MS * 4);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('SESSION_NOT_ACTIVE (422) deja de latir para esa sesion, sin lanzar', async () => {
    sessionHeartbeat.mockRejectedValue(
      new AtlasApiError({ kind: 'validation', code: 'SESSION_NOT_ACTIVE', message: 'SESSION_NOT_ACTIVE', status: 422 }),
    );
    await renderHook(() => useLatidoDeSesion(SESION));
    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('SESSION_NOT_ACTIVE'));

    await avanzar(CADENCIA_LATIDO_MS * 5);
    await cambiarA('background');
    await cambiarA('active');
    expect(sessionHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('una sesion nueva vuelve a latir aunque la anterior se diera por muerta', async () => {
    sessionHeartbeat.mockRejectedValueOnce(
      new AtlasApiError({ kind: 'validation', code: 'SESSION_NOT_ACTIVE', message: 'SESSION_NOT_ACTIVE', status: 422 }),
    );
    const { rerender } = await renderHook((props: { sesion: ContextoDeLatido }) => useLatidoDeSesion(props.sesion), {
      initialProps: { sesion: SESION },
    });
    await avanzar(CADENCIA_LATIDO_MS);
    await act(async () => {
      await rerender({ sesion: { ...SESION, sessionId: '902' } });
    });
    await avanzar(CADENCIA_LATIDO_MS);
    expect(sessionHeartbeat).toHaveBeenCalledTimes(2);
    expect(sessionHeartbeat.mock.calls[1][1]).toBe('902');
  });
});
