/**
 * El cierre de la sesion en el servidor (`endSession` + `cerrarSesionEnServidor`).
 *
 * `POST .../sessions/:id/end` exige `x-idempotency-key` y la app no la mandaba: el backend respondia
 * 400, `signOut` se lo tragaba y ninguna sesion se cerro nunca desde la app. Estas pruebas pasan por
 * el cliente HTTP REAL (con `fetch` simulado) y fijan:
 *
 * 1. Sale con la clave.
 * 2. Con la red colgada termina en `PLAZO_CIERRE_MS` (5 s) y no lanza.
 * 3. Como mucho dos intentos ante un fallo de red; un 4xx no se repite y no lanza.
 */
import { configureClient } from '../src/api/client';
import { cerrarSesionEnServidor, PLAZO_CIERRE_MS } from '../src/session/cierre-de-sesion';

type Llamada = { url: string; method: string; headers: Record<string, string>; body: unknown };

function respuesta(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const originalFetch = globalThis.fetch;
const llamadas: Llamada[] = [];
let aviso: jest.SpyInstance;

function simularFetch(responder: () => Promise<Response>) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    llamadas.push({
      url: String(url),
      method: String(init.method),
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    return responder();
  }) as unknown as typeof fetch;
}

/** Resuelve la promesa con temporizadores falsos, avanzando hasta `tope` ms. Devuelve el tiempo que tardo. */
async function resolverCon<T>(promesa: Promise<T>, tope: number): Promise<{ valor: T; ms: number }> {
  let hecho = false;
  let valor!: T;
  void promesa.then((v) => {
    valor = v;
    hecho = true;
  });
  let ms = 0;
  while (!hecho && ms <= tope) {
    await jest.advanceTimersByTimeAsync(100);
    ms += 100;
  }
  if (!hecho) throw new Error(`no termino en ${tope} ms`);
  return { valor, ms };
}

beforeEach(() => {
  jest.useFakeTimers();
  llamadas.length = 0;
  configureClient({
    tokenStore: {
      read: async () => ({ accessToken: 'acceso', refreshToken: 'refresco' }),
      write: async () => undefined,
      clear: async () => undefined,
    },
  });
  aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('cerrarSesionEnServidor', () => {
  it('manda POST .../sessions/:id/end con x-idempotency-key y confirma el cierre', async () => {
    simularFetch(async () => respuesta(200, { data: { sessionId: '901', sessionStatus: 'ended', endedAt: '2026-09-27T12:00:00Z' } }));

    const { valor } = await resolverCon(cerrarSesionEnServidor('23', '901'), PLAZO_CIERRE_MS);

    expect(valor).toBe(true);
    expect(llamadas).toHaveLength(1);
    const [llamada] = llamadas as [Llamada];
    expect(llamada.url).toMatch(/\/customers\/23\/sessions\/901\/end$/);
    expect(llamada.method).toBe('POST');
    expect(llamada.headers['x-idempotency-key']).toEqual(expect.any(String));
    expect(llamada.headers['x-idempotency-key']?.length).toBeGreaterThan(0);
    expect(llamada.body).toEqual({ reasonCode: 'customer_logout' });
  });

  it('con la red colgada termina en 5 s o menos, sin lanzar', async () => {
    // Un fetch que no contesta NUNCA, ni siquiera al abortarse: el peor caso.
    simularFetch(() => new Promise<Response>(() => undefined));

    const { valor, ms } = await resolverCon(cerrarSesionEnServidor('23', '901'), PLAZO_CIERRE_MS + 500);

    expect(valor).toBe(false);
    expect(ms).toBeLessThanOrEqual(PLAZO_CIERRE_MS);
  });

  it('ante fallos de red hace como mucho dos intentos, con la MISMA clave, y no lanza', async () => {
    simularFetch(async () => {
      throw new TypeError('Network request failed');
    });

    const { valor, ms } = await resolverCon(cerrarSesionEnServidor('23', '901'), PLAZO_CIERRE_MS + 500);

    expect(valor).toBe(false);
    expect(ms).toBeLessThanOrEqual(PLAZO_CIERRE_MS);
    expect(llamadas.length).toBeGreaterThanOrEqual(1);
    expect(llamadas.length).toBeLessThanOrEqual(2);
    expect(new Set(llamadas.map((l) => l.headers['x-idempotency-key'])).size).toBe(1);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('901'));
  });

  it('un 4xx no se repite, no lanza y se anota', async () => {
    simularFetch(async () => respuesta(422, { requestId: 'r1', error: { code: 'SESSION_NOT_ACTIVE', message: 'SESSION_NOT_ACTIVE' } }));

    const { valor } = await resolverCon(cerrarSesionEnServidor('23', '901'), PLAZO_CIERRE_MS);

    expect(valor).toBe(false);
    expect(llamadas).toHaveLength(1);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('422'));
  });
});
