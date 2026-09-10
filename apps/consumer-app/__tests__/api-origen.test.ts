import { ATLAS_PRODUCT, configureClient, originHeaders, request } from '../src/api/client';
import { setCurrentScreen } from '../src/api/current-screen';

/**
 * AtlasBackend guarda `x-atlas-flow` en `origin_screen` y `x-atlas-product` en `origin_client`, y con
 * los dos marca VERIFICADA una pantalla del catalogo. Lo que se protege aqui son las tres formas de
 * que eso mienta sin fallar: un codigo de producto que no casa con el catalogo (cero coincidencias,
 * que se lee «nadie la usa»), una ruta que el backend descarta en silencio, y un reintento que se
 * atribuye a la pantalla a la que el usuario navego despues.
 */
type Llamada = { url: string; headers: Record<string, string> };

function respuesta(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('cliente HTTP · origen de la llamada', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    llamadas.length = 0;
    setCurrentScreen(null);
    configureClient({
      tokenStore: {
        read: async () => ({ accessToken: 'viejo', refreshToken: 'refresco' }),
        write: async () => undefined,
        clear: async () => undefined,
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setCurrentScreen(null);
  });

  const capturar = (respuestas: Response[], alLlamar?: (i: number) => void) => {
    let i = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      llamadas.push({ url: String(url), headers: (init.headers ?? {}) as Record<string, string> });
      alLlamar?.(i);
      return respuestas[Math.min(i++, respuestas.length - 1)];
    }) as unknown as typeof fetch;
  };

  it('el producto se normaliza al codigo del catalogo de pantallas', () => {
    // Misma traduccion que `originClient` en el interceptor del backend. Si no da CONSUMER_APP, las
    // pantallas de la app no casan con nada y se quedan sin verificar sin que nada lo diga.
    expect(ATLAS_PRODUCT.replace(/-/g, '_').toUpperCase()).toBe('CONSUMER_APP');
  });

  it('sin pantalla declarada va el producto y NO se inventa un origen', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);

    await request('/algo');

    expect(llamadas[0]?.headers['x-atlas-product']).toBe('consumer-app');
    expect(llamadas[0]?.headers).not.toHaveProperty('x-atlas-flow');
  });

  it('con pantalla abierta viaja la ruta concreta', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);
    setCurrentScreen('/comercio/123');

    await request('/algo');

    expect(llamadas[0]?.headers['x-atlas-flow']).toBe('/comercio/123');
  });

  it('una ruta que el backend descartaria no se manda', () => {
    setCurrentScreen('/comercio/a b');
    expect(originHeaders()).not.toHaveProperty('x-atlas-flow');
    setCurrentScreen('/comercio/%C3%B1');
    expect(originHeaders()).not.toHaveProperty('x-atlas-flow');
  });

  it('el refresco y el reintento son de la pantalla que PIDIO, aunque el usuario ya navegara', async () => {
    setCurrentScreen('/pagar');
    capturar(
      [
        respuesta(401, { message: 'token vencido' }),
        respuesta(200, { data: { accessToken: 'nuevo', refreshToken: 'otro' } }),
        respuesta(200, { data: { ok: true } }),
      ],
      // El usuario cambia de pantalla justo despues de la primera peticion.
      (i) => (i === 0 ? setCurrentScreen('/avisos') : undefined),
    );

    await request('/cuotas/1/pagar', { method: 'POST', body: {} });

    expect(llamadas).toHaveLength(3);
    expect(llamadas.map((llamada) => llamada.headers['x-atlas-flow'])).toEqual(['/pagar', '/pagar', '/pagar']);
  });
});
