/**
 * APP-02, la otra mitad: el TELÉFONO no cambia.
 *
 * El modo cookie es sólo de la web. Con el almacén móvil (`token-storage.ts`, llavero/Keystore) el
 * login, el refresco y el cierre de sesión salen exactamente como antes: sin cabecera de modo, sin
 * `credentials`, y con el token de refresco en el cuerpo.
 */
import { configureClient, request } from '../src/api/client';
import * as auth from '../src/api/endpoints/auth';
import { secureTokenStore } from '../src/session/token-storage';

const mockLlavero = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(async (clave: string) => mockLlavero.get(clave) ?? null),
  setItemAsync: jest.fn(async (clave: string, valor: string) => {
    mockLlavero.set(clave, valor);
  }),
  deleteItemAsync: jest.fn(async (clave: string) => {
    mockLlavero.delete(clave);
  }),
}));

type Llamada = { url: string; headers: Record<string, string>; credentials?: string; body: unknown };

function respuesta(status: number, data: unknown) {
  const body = status < 400 ? { requestId: 'r', data } : { requestId: 'r', error: { code: 'UNAUTHORIZED', message: 'x' } };
  return { ok: status < 400, status, statusText: '', text: async () => JSON.stringify(body) } as unknown as Response;
}

describe('sesión en el teléfono: sin modo cookie', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    llamadas.length = 0;
    mockLlavero.clear();
    configureClient({ tokenStore: secureTokenStore });
    let vencido = true;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const l: Llamada = {
        url: String(url),
        headers: (init.headers ?? {}) as Record<string, string>,
        credentials: init.credentials,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      llamadas.push(l);
      if (l.url.endsWith('/auth/login')) return respuesta(200, { accessToken: 'a1', refreshToken: 'refresco-real-1', tokenType: 'Bearer' });
      if (l.url.endsWith('/auth/refresh')) return respuesta(200, { accessToken: 'a2', refreshToken: 'refresco-real-2', tokenType: 'Bearer' });
      if (l.url.endsWith('/auth/logout')) return respuesta(200, { loggedOut: true });
      if (vencido) {
        vencido = false;
        return respuesta(401, null);
      }
      return respuesta(200, { ok: true });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('el almacén móvil no declara modo cookie', () => {
    expect(secureTokenStore.modo).toBeUndefined();
  });

  it('login, refresco y logout: sin cabecera de modo, sin credentials, token de refresco en el cuerpo y en el llavero', async () => {
    const tokens = await auth.login('pablo@example.com', '4821');
    expect(tokens.refreshToken).toBe('refresco-real-1');
    await secureTokenStore.write({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken as string });

    await request('/customers/53/me');
    const refresco = llamadas.find((l) => l.url.endsWith('/auth/refresh'));
    expect(refresco?.body).toEqual({ refreshToken: 'refresco-real-1' });
    await expect(secureTokenStore.read()).resolves.toEqual({ accessToken: 'a2', refreshToken: 'refresco-real-2' });

    await auth.logout('refresco-real-2');
    const salida = llamadas.find((l) => l.url.endsWith('/auth/logout'));
    expect(salida?.body).toEqual({ refreshToken: 'refresco-real-2', allDevices: false });

    for (const l of llamadas) {
      expect(l.headers['x-atlas-session-mode']).toBeUndefined();
      expect(l.credentials).toBeUndefined();
    }
  });
});
