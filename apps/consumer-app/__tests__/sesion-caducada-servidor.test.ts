import { configureClient, request, type TokenPair } from '../src/api/client';

/**
 * El tope absoluto de la sesión lo garantiza también el backend: pasado, el refresco responde 401
 * `SESSION_EXPIRED`. El cliente borra los tokens y le pasa ESE código a la sesión, que lo dice como «tu sesión dura
 * 8 horas» (ver `sesion-tope-8h.test.tsx`) en vez de echar a la persona sin explicación.
 */
const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('401 SESSION_EXPIRED del refresco', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    ['SESSION_EXPIRED', 'SESSION_EXPIRED'],
    ['REFRESH_REVOKED', 'REFRESH_REVOKED'],
  ])('un refresco rechazado con %s borra los tokens y avisa con el código', async (codigo, esperado) => {
    let guardados: TokenPair | null = { accessToken: 'viejo', refreshToken: 'r1' };
    const avisos: (string | null)[] = [];
    configureClient({
      tokenStore: {
        read: async () => guardados,
        write: async (t) => {
          guardados = t;
        },
        clear: async () => {
          guardados = null;
        },
      },
      onSessionExpired: (c) => avisos.push(c),
    });
    globalThis.fetch = (async (url: string) => {
      if (String(url).endsWith('/auth/refresh')) return json(401, { requestId: 'r', error: { code: codigo, message: `${codigo}: tope` } });
      return json(401, { requestId: 'r', error: { code: 'TOKEN_EXPIRED', message: 'TOKEN_EXPIRED' } });
    }) as unknown as typeof fetch;

    await expect(request('/customers/1/loans')).rejects.toMatchObject({ status: 401 });
    expect(guardados).toBeNull();
    expect(avisos).toEqual([esperado]);
  });
});
