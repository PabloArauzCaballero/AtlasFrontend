import { configureClient, request, type TokenPair } from '../src/api/client';

/**
 * APP-16: varios 401 a la vez comparten UN refresco.
 *
 * El backend rota el token de refresco en el primer uso. Con un refresco por 401, el segundo llegaba
 * con un token ya gastado, el backend lo rechazaba y la persona salía de la app sin haber hecho nada.
 */
const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) }) as unknown as Response;

const CADUCADO = () => json(401, { requestId: 'r', error: { code: 'TOKEN_EXPIRED', message: 'TOKEN_EXPIRED' } });

describe('refresco del token compartido', () => {
  const originalFetch = globalThis.fetch;
  let guardados: TokenPair | null;
  let refrescos: number;
  let expirado: number;
  let resolverRefresco: (() => void) | null;

  beforeEach(() => {
    guardados = { accessToken: 'viejo', refreshToken: 'r1' };
    refrescos = 0;
    expirado = 0;
    resolverRefresco = null;
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
      onSessionExpired: () => {
        expirado += 1;
      },
    });
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      const auth = (init.headers as Record<string, string>).authorization;
      if (String(url).endsWith('/auth/refresh')) {
        refrescos += 1;
        const body = JSON.parse(String(init.body)) as { refreshToken: string };
        // El refresco tarda: da tiempo a que lleguen los otros 401.
        await new Promise<void>((r) => {
          resolverRefresco = r;
        });
        if (body.refreshToken !== 'r1') return json(401, { requestId: 'r', error: { code: 'REFRESH_REUSED', message: 'REFRESH_REUSED' } });
        return json(200, { requestId: 'r', data: { accessToken: 'nuevo', refreshToken: 'r2' } });
      }
      return auth === 'Bearer nuevo' ? json(200, { requestId: 'r', data: { url: String(url) } }) : CADUCADO();
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const esperarRefresco = async () => {
    for (let i = 0; i < 50 && !resolverRefresco; i += 1) await new Promise((r) => setTimeout(r, 0));
    // Deja que los demás 401 lleguen y se cuelguen del mismo refresco antes de soltarlo.
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
    resolverRefresco?.();
  };

  it('tres 401 simultáneos hacen UN refresco y los tres se reintentan con el token nuevo', async () => {
    const tres = Promise.all([request('/a'), request('/b'), request('/c')]);
    await esperarRefresco();
    const resultados = await tres;

    expect(refrescos).toBe(1);
    expect(resultados).toHaveLength(3);
    expect(guardados).toEqual({ accessToken: 'nuevo', refreshToken: 'r2' });
    expect(expirado).toBe(0);
  });

  it('un 401 que llega después del refresco usa el par ya guardado, sin refrescar otra vez', async () => {
    const primera = request('/a');
    await esperarRefresco();
    await primera;
    expect(refrescos).toBe(1);

    // Esta operación salió con el token viejo (lo leyó antes) y vuelve con 401 cuando ya hay par nuevo.
    guardados = { accessToken: 'nuevo', refreshToken: 'r2' };
    const tokensLeidos: TokenPair = { accessToken: 'viejo', refreshToken: 'r1' };
    let lecturas = 0;
    configureClient({
      tokenStore: {
        read: async () => (lecturas++ === 0 ? tokensLeidos : guardados),
        write: async (t) => {
          guardados = t;
        },
        clear: async () => {
          guardados = null;
        },
      },
    });
    await expect(request('/tarde')).resolves.toEqual({ url: expect.stringContaining('/tarde') });
    expect(refrescos).toBe(1);
  });
});
