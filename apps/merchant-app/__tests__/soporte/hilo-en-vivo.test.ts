/**
 * El hilo en vivo del chat (`suscribirseAlChat`) contra un `fetch` simulado que devuelve el cuerpo a
 * trozos, como hace `expo/fetch` en el teléfono.
 *
 * Lo que se comprueba es lo que en el dispositivo no se ve hasta que falla: que lleva la sesión
 * (Bearer, cookies, origen), que un evento partido entre dos trozos llega entero, que tras un corte
 * reconecta con espera, que un 401 renueva la sesión antes de reintentar y que, una vez cerrado, no
 * vuelve a abrir nada.
 */
import { clearAccessToken, setAccessToken } from '@/api/client';
import { ESPERA_RECONEXION_MS, suscribirseAlChat, type EntornoDelHilo, type EventoEnVivo } from '@/api/servicios/supportService';

const codificar = (texto: string) => new TextEncoder().encode(texto);

/** Un cuerpo que entrega los trozos dados y luego termina (o se queda colgado, si `abierto`). */
function cuerpo(trozos: string[], abierto = false) {
  const cola = [...trozos];
  let cancelado = false;
  return {
    getReader: () => ({
      read: () => {
        if (cancelado) return Promise.resolve({ done: true, value: undefined });
        const siguiente = cola.shift();
        if (siguiente !== undefined) return Promise.resolve({ done: false, value: codificar(siguiente) });
        return abierto ? new Promise<never>(() => undefined) : Promise.resolve({ done: true, value: undefined });
      },
      cancel: () => {
        cancelado = true;
        return Promise.resolve();
      },
    }),
  };
}

function respuesta(status: number, body: unknown = null): Response {
  return { ok: status >= 200 && status < 300, status, body } as unknown as Response;
}

const esperarVueltas = () => new Promise((resolver) => setTimeout(resolver, 0));

function entorno(respuestas: Response[]) {
  const esperas: (() => void)[] = [];
  const llamadas: { url: string; init: RequestInit }[] = [];
  const e: EntornoDelHilo & { esperas: typeof esperas; llamadas: typeof llamadas } = {
    esperas,
    llamadas,
    fetch: jest.fn((url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      const siguiente = respuestas.shift();
      return siguiente ? Promise.resolve(siguiente) : new Promise<Response>(() => undefined);
    }),
    esperar: jest.fn((ms: number, accion: () => void) => {
      expect(ms).toBe(ESPERA_RECONEXION_MS);
      esperas.push(accion);
      return () => {
        const i = esperas.indexOf(accion);
        if (i >= 0) esperas.splice(i, 1);
      };
    }),
    renovar: jest.fn().mockResolvedValue(undefined),
  };
  return e;
}

beforeEach(() => setAccessToken('token-de-prueba'));
afterEach(() => clearAccessToken());

it('abre el stream con la sesión y entrega los eventos aunque vengan partidos', async () => {
  const evento = 'data: {"type":"message.created","data":{"sequence":"3","body":"hola"}}\n\n';
  const env = entorno([respuesta(200, cuerpo([evento.slice(0, 20), evento.slice(20), ': ping\n\n'], true))]);
  const recibidos: EventoEnVivo[] = [];
  const conexion: boolean[] = [];

  const cerrar = suscribirseAlChat('canal 1', (e) => recibidos.push(e), (c) => conexion.push(c), env);
  await esperarVueltas();
  await esperarVueltas();

  expect(env.llamadas).toHaveLength(1);
  const { url, init } = env.llamadas[0]!;
  expect(url).toBe('https://api.atlas.invalid/api/v1/support/channels/canal%201/stream');
  expect(init.credentials).toBe('include');
  expect(init.headers).toMatchObject({ Authorization: 'Bearer token-de-prueba', Accept: 'text/event-stream', 'x-atlas-product': 'merchant-app' });
  // El valor lo da `expo-crypto`, que en jest es un doble sin implementación: basta con que viaje.
  expect(init.headers).toHaveProperty('x-correlation-id');
  expect(recibidos).toEqual([{ type: 'message.created', data: { sequence: '3', body: 'hola' } }]);
  expect(conexion).toEqual([true]);

  cerrar();
  expect((init.signal as AbortSignal).aborted).toBe(true);
  expect(conexion).toEqual([true, false]);
});

it('si el stream se corta, reconecta tras la espera', async () => {
  const env = entorno([respuesta(200, cuerpo([])), respuesta(200, cuerpo([], true))]);
  const cerrar = suscribirseAlChat('c', () => undefined, undefined, env);
  await esperarVueltas();
  await esperarVueltas();

  expect(env.llamadas).toHaveLength(1);
  expect(env.esperas).toHaveLength(1);
  env.esperas.shift()!();
  await esperarVueltas();
  expect(env.llamadas).toHaveLength(2);
  cerrar();
});

it('un 401 renueva la sesión antes de reintentar', async () => {
  const env = entorno([respuesta(401)]);
  const cerrar = suscribirseAlChat('c', () => undefined, undefined, env);
  await esperarVueltas();
  await esperarVueltas();
  expect(env.renovar).toHaveBeenCalledTimes(1);
  expect(env.esperas).toHaveLength(1);
  cerrar();
});

it('sin token no pide nada, pero lo vuelve a intentar', async () => {
  clearAccessToken();
  const env = entorno([]);
  const cerrar = suscribirseAlChat('c', () => undefined, undefined, env);
  await esperarVueltas();
  expect(env.fetch).not.toHaveBeenCalled();
  expect(env.esperas).toHaveLength(1);
  cerrar();
  // Cerrar cancela la espera pendiente: nada vuelve a abrirse.
  expect(env.esperas).toHaveLength(0);
});

it('un evento que pasa del tope corta la conexión y reconecta', async () => {
  const enorme = `data: {"type":"x","data":{"t":"${'a'.repeat(70_000)}"}}`;
  const env = entorno([respuesta(200, cuerpo([enorme.slice(0, 66_000)], true))]);
  const recibidos: EventoEnVivo[] = [];
  const cerrar = suscribirseAlChat('c', (e) => recibidos.push(e), undefined, env);
  await esperarVueltas();
  await esperarVueltas();
  await esperarVueltas();
  expect(recibidos).toHaveLength(0);
  expect(env.esperas).toHaveLength(1);
  cerrar();
});

it('cerrado, un corte posterior no reabre', async () => {
  const env = entorno([respuesta(503)]);
  const cerrar = suscribirseAlChat('c', () => undefined, undefined, env);
  cerrar();
  await esperarVueltas();
  await esperarVueltas();
  expect(env.esperas).toHaveLength(0);
});
