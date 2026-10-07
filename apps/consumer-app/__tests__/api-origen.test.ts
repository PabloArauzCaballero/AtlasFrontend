import { ATLAS_PRODUCT, configureClient, originHeaders, request } from '../src/api/client';
import { getMe, listActiveConsents } from '../src/api/endpoints/customer';
import { registrarDecisiones } from '../src/api/endpoints/privacy';
import { setScreenSource } from '../src/api/current-screen';

/**
 * AtlasBackend guarda `x-atlas-flow` en `origin_screen` y `x-atlas-product` en `origin_client`, y con
 * los dos marca VERIFICADA una pantalla del catalogo. Lo que se protege aqui son las formas de que eso
 * mienta sin fallar: un codigo de producto que no casa con el catalogo, una ruta que el backend
 * descarta en silencio, un reintento atribuido a la pantalla a la que el usuario navego despues, un
 * origen inventado antes de que la navegacion exista, y una tarea de fondo atribuida a la pantalla
 * que este arriba.
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
    setScreenSource(() => null);
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
    setScreenSource(null);
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
    // Misma traduccion que `originClient` en el interceptor del backend.
    expect(ATLAS_PRODUCT.replace(/-/g, '_').toUpperCase()).toBe('CONSUMER_APP');
  });

  it('sin pantalla va el producto y NO se inventa un origen', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);

    await request('/algo');

    expect(llamadas[0]?.headers['x-atlas-product']).toBe('consumer-app');
    expect(llamadas[0]?.headers).not.toHaveProperty('x-atlas-flow');
  });

  it('antes de que la navegacion este lista no se manda el `/` por defecto del router', () => {
    setScreenSource(null);
    expect(originHeaders()).not.toHaveProperty('x-atlas-flow');
  });

  it('con pantalla abierta viaja la ruta concreta, tambien en una llamada anonima', async () => {
    capturar([respuesta(200, { data: [] })]);
    setScreenSource(() => '/registro');

    await request('/consents/active', { anonymous: true });

    expect(llamadas[0]?.headers['x-atlas-flow']).toBe('/registro');
  });

  it('una ruta que el backend descartaria no se manda', () => {
    setScreenSource(() => '/comercio/a b');
    expect(originHeaders()).not.toHaveProperty('x-atlas-flow');
    setScreenSource(() => '/comercio/%C3%B1');
    expect(originHeaders()).not.toHaveProperty('x-atlas-flow');
  });

  it('si el router falla al leerse, no se manda origen y la peticion sigue', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);
    setScreenSource(() => {
      throw new Error('router no montado');
    });

    await request('/algo');

    expect(llamadas[0]?.headers).not.toHaveProperty('x-atlas-flow');
  });

  it('una llamada de fondo no se atribuye a la pantalla que este arriba', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);
    setScreenSource(() => '/inicio');

    await request('/customers/1/location-pings', { method: 'POST', body: {}, sinPantalla: true });

    expect(llamadas[0]?.headers).not.toHaveProperty('x-atlas-flow');
    expect(llamadas[0]?.headers['x-atlas-product']).toBe('consumer-app');
  });

  it('lo que pide la sesion o un sondeo de fondo tampoco se atribuye a la pantalla de arriba', async () => {
    capturar([respuesta(200, { data: {} })]);
    setScreenSource(() => '/');

    await getMe('1', { sinPantalla: true });
    await listActiveConsents({ sinPantalla: true });
    await registrarDecisiones('1', [], { sinPantalla: true });

    expect(llamadas.map((llamada) => llamada.headers['x-atlas-flow'])).toEqual([undefined, undefined, undefined]);
  });

  it('las mismas llamadas desde una pantalla SI llevan su origen', async () => {
    capturar([respuesta(200, { data: [] })]);
    setScreenSource(() => '/registro');

    await listActiveConsents();

    expect(llamadas[0]?.headers['x-atlas-flow']).toBe('/registro');
  });

  it('el refresco y el reintento son de la pantalla que PIDIO, aunque el usuario ya navegara', async () => {
    setScreenSource(() => '/pagar');
    capturar(
      [
        respuesta(401, { message: 'token vencido' }),
        respuesta(200, { data: { accessToken: 'nuevo', refreshToken: 'otro' } }),
        respuesta(200, { data: { ok: true } }),
      ],
      (i) => (i === 0 ? setScreenSource(() => '/avisos') : undefined),
    );

    await request('/cuotas/1/pagar', { method: 'POST', body: {} });

    expect(llamadas).toHaveLength(3);
    expect(llamadas.map((llamada) => llamada.headers['x-atlas-flow'])).toEqual(['/pagar', '/pagar', '/pagar']);
  });
});
