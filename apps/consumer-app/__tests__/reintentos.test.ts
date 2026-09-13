import { AtlasApiError } from '../src/api/errors';
import { conReintentos, esperaAntesDelIntento, merecePrueba, repeticionDe } from '../src/api/reintentos';

/**
 * La política de reintentos.
 *
 * El riesgo de un reintento no es que falte: es que sobre. Repetir un POST que sí llegó cobra dos
 * veces, y repetir un error de negocio hace esperar 45 s a alguien para enseñarle lo mismo. Estas
 * pruebas fijan las dos fronteras: qué es un fallo de infraestructura, y qué operación se puede
 * repetir sin hacer dos veces lo mismo.
 */

const proxy = (status: number) =>
  new AtlasApiError({ kind: status === 503 ? 'unavailable' : 'server', code: 'UNKNOWN_ERROR', message: 'x', status, fromGateway: true });
const backend = (status: number, code = 'X') =>
  new AtlasApiError({ kind: 'server', code, message: 'x', status, requestId: 'req-1', fromGateway: false });
const red = () => new AtlasApiError({ kind: 'network', code: 'NETWORK_UNREACHABLE', message: 'x' });
const plazo = () => new AtlasApiError({ kind: 'timeout', code: 'REQUEST_TIMEOUT', message: 'x' });

describe('qué operación se puede repetir', () => {
  it('GET y operaciones con clave de idempotencia se repiten con seguridad', () => {
    expect(repeticionDe(undefined, undefined)).toBe('segura');
    expect(repeticionDe('GET', false)).toBe('segura');
    expect(repeticionDe('POST', true)).toBe('segura');
  });

  it('un POST sin clave sólo se repite si no llegó', () => {
    expect(repeticionDe('POST', false)).toBe('solo-si-no-llego');
    expect(repeticionDe('PATCH', undefined)).toBe('solo-si-no-llego');
  });
});

describe('qué fallo merece otro intento', () => {
  it('el 500 del proxy de Next, sin sobre del backend, se repite siempre', () => {
    expect(merecePrueba(proxy(500), 'segura')).toBe(true);
    expect(merecePrueba(proxy(500), 'solo-si-no-llego')).toBe(true);
  });

  it('el 404 de Traefik sin contenedor detrás se repite siempre', () => {
    expect(merecePrueba(proxy(404), 'solo-si-no-llego')).toBe(true);
  });

  it('un error que escribió el backend NO se repite, aunque sea 500 o 503', () => {
    // Un 503 de negocio —p. ej. VERIFICATION_CHANNEL_UNAVAILABLE— repetido 45 s sólo retrasaría el
    // mismo mensaje.
    expect(merecePrueba(backend(500), 'segura')).toBe(false);
    expect(merecePrueba(backend(503, 'VERIFICATION_CHANNEL_UNAVAILABLE'), 'segura')).toBe(false);
    expect(merecePrueba(backend(404), 'segura')).toBe(false);
  });

  it('timeout, corte de red y 504 sólo se repiten si la operación es segura', () => {
    // Ahí la petición pudo llegar y ejecutarse sin que volviera la respuesta.
    for (const error of [red(), plazo(), proxy(504)]) {
      expect(merecePrueba(error, 'segura')).toBe(true);
      expect(merecePrueba(error, 'solo-si-no-llego')).toBe(false);
    }
  });

  it('lo que no es un AtlasApiError no se repite', () => {
    expect(merecePrueba(new Error('boom'), 'segura')).toBe(false);
  });
});

describe('esperas', () => {
  it('crecen y se estancan en el tope', () => {
    const centro = () => 0.5;
    expect([1, 2, 3, 4, 5, 6, 40].map((n) => esperaAntesDelIntento(n, centro))).toEqual([
      1000, 2000, 3000, 5000, 8000, 8000, 8000,
    ]);
  });

  it('se dispersan un 25 % a cada lado para que los teléfonos no vuelvan sincronizados', () => {
    expect(esperaAntesDelIntento(1, () => 0)).toBe(750);
    expect(esperaAntesDelIntento(1, () => 1)).toBe(1250);
  });
});

describe('conReintentos', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devuelve el resultado en cuanto un intento sale bien', async () => {
    const intento = jest.fn().mockRejectedValueOnce(proxy(500)).mockRejectedValueOnce(proxy(404)).mockResolvedValue('ok');

    const resultado = conReintentos(intento, { repeticion: 'solo-si-no-llego' });
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(resultado).resolves.toBe('ok');
    expect(intento).toHaveBeenCalledTimes(3);
  });

  it('no repite lo que no lo merece', async () => {
    const error = backend(500);
    const intento = jest.fn().mockRejectedValue(error);

    await expect(conReintentos(intento, { repeticion: 'segura' })).rejects.toBe(error);
    expect(intento).toHaveBeenCalledTimes(1);
  });

  it('se rinde al agotar el presupuesto y lanza el ÚLTIMO error', async () => {
    const errores = Array.from({ length: 50 }, () => proxy(500));
    let i = 0;
    const intento = jest.fn(async () => {
      throw errores[i++];
    });

    const resultado = conReintentos(intento, { repeticion: 'segura', presupuestoMs: 20_000 }).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(60_000);

    const lanzado = await resultado;
    expect(lanzado).toBe(errores[intento.mock.calls.length - 1]);
    // 1 + esperas de ~1, 2, 3, 5, 8 s: el sexto intento ya no cabe en 20 s.
    expect(intento.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(intento.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('para en cuanto la pantalla cancela', async () => {
    const control = new AbortController();
    const intento = jest.fn().mockRejectedValue(proxy(500));

    const resultado = conReintentos(intento, { repeticion: 'segura', signal: control.signal }).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(100);
    control.abort();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(await resultado).toBeInstanceOf(AtlasApiError);
    expect(intento).toHaveBeenCalledTimes(1);
  });
});
