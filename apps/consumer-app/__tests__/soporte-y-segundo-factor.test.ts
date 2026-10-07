import { configureClient } from '../src/api/client';
import { setMfaPreference } from '../src/api/endpoints/auth';
import { closeChannel } from '../src/api/endpoints/support';

/**
 * Dos llamadas que el cliente de API tenía y ninguna pantalla usaba: cerrar la conversación de
 * soporte y activar el segundo factor. Aquí se fija el contrato con el backend: la ruta, el cuerpo
 * y —en MFA— el nombre real del campo de respuesta (`mfaEnabled`, no `enabled`).
 */
type Llamada = { url: string; method: string; body: unknown };

const json = (body: unknown) =>
  ({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('soporte y segundo factor · contrato con el backend', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    llamadas.length = 0;
    configureClient({
      tokenStore: {
        read: async () => ({ accessToken: 'token', refreshToken: 'refresco' }),
        write: async () => undefined,
        clear: async () => undefined,
      },
    });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function responder(body: unknown) {
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null });
      return json({ requestId: 'r1', data: body });
    }) as typeof fetch;
  }

  it('cerrar la conversación manda el motivo USER_ENDED al canal correcto', async () => {
    responder({ closed: true });
    await closeChannel('ch-9');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toMatch(/\/support\/channels\/ch-9\/close$/);
    expect(llamadas[0]?.method).toBe('POST');
    expect(llamadas[0]?.body).toEqual({ reason: 'USER_ENDED' });
  });

  it('el segundo factor se activa con { enabled } y se lee como { mfaEnabled }', async () => {
    responder({ mfaEnabled: true });
    const respuesta = await setMfaPreference(true);
    expect(llamadas[0]?.url).toMatch(/\/auth\/mfa$/);
    expect(llamadas[0]?.body).toEqual({ enabled: true });
    expect(respuesta.mfaEnabled).toBe(true);
  });
});
