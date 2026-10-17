import { configureClient, request } from '../src/api/client';
import { caducaPronto, caducidadDe, MARGEN_MS } from '../src/api/caducidad-del-token';

/**
 * El token de acceso dura una hora. Quien abría la app al día siguiente mandaba la portada con el token muerto:
 * 401, refresco y repetir, dos viajes de más a 210 ms cada uno antes de pintar nada. Ahora, si el `exp` del propio
 * token dice que ya caducó, se refresca ANTES y la petición sale una sola vez.
 */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (valor: unknown) => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

function respuesta(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('caducidad del token', () => {
  const ahora = Date.UTC(2026, 9, 17, 12, 0, 0);

  it('lee el exp de un JWT en milisegundos', () => {
    expect(caducidadDe(jwt({ sub: '1', exp: ahora / 1000 }))).toBe(ahora);
  });

  it('un token caducado o a menos del margen caduca pronto; uno con vida, no', () => {
    expect(caducaPronto(jwt({ exp: (ahora - 1000) / 1000 }), ahora)).toBe(true);
    expect(caducaPronto(jwt({ exp: (ahora + MARGEN_MS - 1000) / 1000 }), ahora)).toBe(true);
    expect(caducaPronto(jwt({ exp: (ahora + 3_600_000) / 1000 }), ahora)).toBe(false);
  });

  it('lo que no es un JWT legible no caduca pronto: decide el 401 de siempre', () => {
    expect(caducaPronto('viejo', ahora)).toBe(false);
    expect(caducaPronto('a.%%%.c', ahora)).toBe(false);
    expect(caducaPronto(jwt({ sub: '1' }), ahora)).toBe(false);
  });
});

describe('cliente HTTP · refresca antes con el token caducado', () => {
  const originalFetch = globalThis.fetch;
  let urls: string[] = [];
  let autorizaciones: (string | undefined)[] = [];

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function servidor(responder: (url: string) => Response) {
    urls = [];
    autorizaciones = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      urls.push(String(url));
      autorizaciones.push((init.headers as Record<string, string> | undefined)?.authorization);
      return responder(String(url));
    }) as unknown as typeof fetch;
  }

  function almacen(accessToken: string) {
    let par = { accessToken, refreshToken: 'refresco' };
    configureClient({
      tokenStore: {
        read: async () => par,
        write: async (nuevo) => {
          par = nuevo;
        },
        clear: async () => undefined,
      },
    });
  }

  it('con el token caducado: un refresco y UNA petición, sin 401 de por medio', async () => {
    almacen(jwt({ exp: Math.floor(Date.now() / 1000) - 60 }));
    servidor((url) =>
      url.endsWith('/auth/refresh')
        ? respuesta(200, { data: { accessToken: 'nuevo', refreshToken: 'otro' } })
        : respuesta(200, { data: { ok: true } }),
    );

    await expect(request('/customers/1/me')).resolves.toEqual({ ok: true });

    expect(urls.map((url) => url.replace(/^.*\/api\/v1/, ''))).toEqual(['/auth/refresh', '/customers/1/me']);
    expect(autorizaciones[1]).toBe('Bearer nuevo');
  });

  it('con el token vigente no refresca', async () => {
    almacen(jwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    servidor(() => respuesta(200, { data: { ok: true } }));

    await request('/customers/1/me');

    expect(urls).toHaveLength(1);
  });

  it('si el refresco anticipado no sale, la petición va igual con el token que había', async () => {
    const caducado = jwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    almacen(caducado);
    servidor((url) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return respuesta(200, { data: { ok: true } });
    });

    await expect(request('/customers/1/me', { presupuestoReintentosMs: 0 })).resolves.toEqual({ ok: true });
    expect(autorizaciones[autorizaciones.length - 1]).toBe(`Bearer ${caducado}`);
  });
});
