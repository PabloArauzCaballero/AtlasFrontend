import { configureClient, request } from '../src/api/client';
import { fetchRepetible } from '../src/api/reintentos';

/**
 * El cliente durante un despliegue del backend.
 *
 * Mientras Coolify cambia los contenedores, las peticiones las contesta la pasarela: el proxy de Next
 * con un 500 en texto plano, o Traefik con `404 page not found`. Aquí se prueba lo que la persona
 * nota: que la operación termina sola cuando vuelve el API, que un cobro no se duplica, y —el fallo que
 * más dolía— que un refresco de sesión que coincide con el hueco NO la echa de la app.
 */

type Llamada = { url: string; method: string; headers: Record<string, string> };

const json = (status: number, body: unknown) =>
  ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const texto = (status: number, body: string, tipo = 'text/plain; charset=utf-8') =>
  ({ ok: status < 400, status, headers: { get: () => tipo }, text: async () => body }) as unknown as Response;

const PROXY_SIN_API = () => texto(500, 'Internal Server Error');
const TRAEFIK_SIN_CONTENEDOR = () => texto(404, '404 page not found');

describe('cliente HTTP · reintentos durante un despliegue', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;
  let limpiado = 0;
  let expirado = 0;

  const secuencia = (respuestas: (Response | Error)[]) => {
    let i = 0;
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string> });
      const siguiente = respuestas[Math.min(i++, respuestas.length - 1)];
      if (siguiente instanceof Error) throw siguiente;
      return siguiente;
    }) as unknown as typeof fetch;
  };

  /** Deja correr los temporizadores de espera sin que la promesa rechace sin manejador. */
  const correr = async <T>(promesa: Promise<T>) => {
    const capturada = promesa.then(
      (valor) => ({ valor, error: null as unknown }),
      (error: unknown) => ({ valor: null as T | null, error }),
    );
    await jest.advanceTimersByTimeAsync(120_000);
    return capturada;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    llamadas.length = 0;
    limpiado = 0;
    expirado = 0;
    configureClient({
      tokenStore: {
        read: async () => ({ accessToken: 'viejo', refreshToken: 'refresco' }),
        write: async () => undefined,
        clear: async () => {
          limpiado += 1;
        },
      },
      onSessionExpired: () => {
        expirado += 1;
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('una lectura que cae en el hueco termina sola cuando vuelve el API', async () => {
    secuencia([PROXY_SIN_API(), TRAEFIK_SIN_CONTENEDOR(), json(200, { requestId: 'r', data: { ok: true } })]);

    const { valor, error } = await correr(request<{ ok: boolean }>('/algo'));

    expect(error).toBeNull();
    expect(valor).toEqual({ ok: true });
    expect(llamadas).toHaveLength(3);
  });

  it('un error escrito por el backend no se repite', async () => {
    secuencia([json(500, { requestId: 'r', error: { code: 'BOOM', message: 'BOOM' } })]);

    const { error } = await correr(request('/algo'));

    expect(error).toMatchObject({ status: 500, fromGateway: false });
    expect(llamadas).toHaveLength(1);
  });

  it('un POST sin clave se repite si contestó la pasarela…', async () => {
    secuencia([PROXY_SIN_API(), json(201, { requestId: 'r', data: { id: 1 } })]);

    const { error } = await correr(request('/alta', { method: 'POST', body: { a: 1 } }));

    expect(error).toBeNull();
    expect(llamadas).toHaveLength(2);
  });

  it('…pero NO ante un corte de red, porque pudo haber llegado', async () => {
    secuencia([new TypeError('Network request failed'), json(201, { requestId: 'r', data: {} })]);

    const { error } = await correr(request('/alta', { method: 'POST', body: { a: 1 } }));

    expect(error).toMatchObject({ kind: 'network' });
    expect(llamadas).toHaveLength(1);
  });

  it('una operación idempotente repite la MISMA clave en cada intento', async () => {
    // Con una clave por intento, el backend no podría deduplicar el cobro que el primero quizá hizo.
    secuencia([new TypeError('Network request failed'), PROXY_SIN_API(), json(200, { requestId: 'r', data: {} })]);

    const { error } = await correr(request('/pagos', { method: 'POST', body: {}, idempotent: true }));

    expect(error).toBeNull();
    const claves = llamadas.map((l) => l.headers['x-idempotency-key']);
    expect(claves).toHaveLength(3);
    expect(claves[0]).toBeTruthy();
    expect(new Set(claves).size).toBe(1);
  });

  it('un refresco de sesión que cae en el hueco NO cierra la sesión', async () => {
    // 401 del backend → refresco; el refresco lo contesta la pasarela hasta agotar el presupuesto.
    secuencia([json(401, { requestId: 'r', error: { code: 'TOKEN_EXPIRED', message: 'TOKEN_EXPIRED' } }), PROXY_SIN_API()]);

    const { error } = await correr(request('/perfil'));

    expect(error).toMatchObject({ fromGateway: true, status: 500 });
    expect(limpiado).toBe(0);
    expect(expirado).toBe(0);
  });

  it('un refresco que el BACKEND rechaza sí cierra la sesión', async () => {
    secuencia([
      json(401, { requestId: 'r', error: { code: 'TOKEN_EXPIRED', message: 'TOKEN_EXPIRED' } }),
      json(401, { requestId: 'r2', error: { code: 'INVALID_REFRESH_TOKEN', message: 'INVALID_REFRESH_TOKEN' } }),
    ]);

    await correr(request('/perfil'));

    expect(limpiado).toBe(1);
    expect(expirado).toBe(1);
  });
});

describe('fetchRepetible · subidas al almacén', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  const secuencia = (respuestas: Response[]) => {
    let i = 0;
    const llamadas: number[] = [];
    globalThis.fetch = (async () => {
      llamadas.push(i);
      return respuestas[Math.min(i++, respuestas.length - 1)];
    }) as unknown as typeof fetch;
    return llamadas;
  };

  it('repite la subida mientras Traefik no tiene a MinIO detrás', async () => {
    const llamadas = secuencia([texto(404, '404 page not found'), texto(502, 'Bad Gateway'), texto(200, '')]);

    const promesa = fetchRepetible('https://almacen/firma', { method: 'PUT', body: 'x' });
    await jest.advanceTimersByTimeAsync(30_000);

    expect((await promesa).status).toBe(200);
    expect(llamadas).toHaveLength(3);
  });

  it('no repite un error del propio MinIO: la firma vencida hay que pedirla otra vez', async () => {
    const llamadas = secuencia([texto(403, '<Error><Code>AccessDenied</Code></Error>', 'application/xml')]);

    const respuesta = await fetchRepetible('https://almacen/firma', { method: 'PUT', body: 'x' });

    expect(respuesta.status).toBe(403);
    expect(llamadas).toHaveLength(1);
  });
});
