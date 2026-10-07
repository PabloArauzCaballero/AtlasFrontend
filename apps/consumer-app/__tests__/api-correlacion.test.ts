import { configureClient, request } from '../src/api/client';

/**
 * AtlasBackend guarda `x-correlation-id` en `system_action_logs` y expone
 * `GET systems/action-logs/request/:requestId`. Sin esta cabecera, lo que hace la app es lo único
 * del ecosistema que no se puede atar a nada: ante un fallo reportado por un cliente no hay forma de
 * encontrar la fila que lo registró.
 *
 * Lo que se protege aquí es el matiz que hace útil la traza: un id por OPERACIÓN, no por intento.
 * Si el 401 dispara un refresco y se reintenta, las dos peticiones son un solo gesto del usuario, y
 * con un id por intento la traza se parte justo en el caso que más interesa mirar.
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

describe('cliente HTTP · correlación', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    llamadas.length = 0;
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
  });

  const capturar = (respuestas: Response[]) => {
    let i = 0;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      llamadas.push({ url: String(url), headers: (init.headers ?? {}) as Record<string, string> });
      return respuestas[Math.min(i++, respuestas.length - 1)];
    }) as unknown as typeof fetch;
  };

  it('toda petición lleva un identificador que el backend acepta', async () => {
    capturar([respuesta(200, { data: { ok: true } })]);

    await request('/algo');

    const id = llamadas[0]?.headers['x-correlation-id'];
    expect(id).toBeDefined();
    // El backend descarta lo que no cumpla este patrón y genera otro: la correlación se perdería
    // en silencio, que es peor que no mandarla.
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('el reintento tras refrescar el token comparte el id: es la MISMA operación', async () => {
    capturar([
      respuesta(401, { message: 'token vencido' }),
      respuesta(200, { data: { accessToken: 'nuevo', refreshToken: 'otro' } }),
      respuesta(200, { data: { ok: true } }),
    ]);

    await request('/algo');

    const ids = llamadas.map((llamada) => llamada.headers['x-correlation-id']);
    expect(ids).toHaveLength(3);
    // Incluido el `/auth/refresh` intermedio: sin esto, en el log aparece suelto y no se sabe de
    // dónde salió.
    expect(new Set(ids).size).toBe(1);
  });

  it('dos operaciones distintas NO comparten id', async () => {
    capturar([respuesta(200, { data: {} })]);

    await request('/una');
    await request('/otra');

    expect(llamadas[0]?.headers['x-correlation-id']).not.toBe(llamadas[1]?.headers['x-correlation-id']);
  });
});
