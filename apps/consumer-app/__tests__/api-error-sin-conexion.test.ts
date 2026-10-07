/**
 * Cuando no se puede hablar con el servicio, la persona lee «Sin conexión», sea cual sea la causa.
 *
 * El 2026-10-06 la app de TestFlight se quedó sin API ~2 min durante un redespliegue y mostró
 * mensajes distintos según qué contestara (red, 500 de la pasarela, 503): «Servicio no disponible»,
 * «Tuvimos un problema de nuestro lado»… ninguno le decía que bastaba con reintentar. Los errores de
 * NEGOCIO, en cambio, siguen diciendo lo que pasó.
 */
import { AtlasApiError, describeError, esFalloDeServicio } from '../src/api/errors';

const error = (kind: ConstructorParameters<typeof AtlasApiError>[0]['kind'], code: string, extra: { status?: number; fromGateway?: boolean } = {}) =>
  new AtlasApiError({ kind, code, message: code, ...extra });

describe('fallos del servicio → «Sin conexión»', () => {
  const casos: [string, AtlasApiError][] = [
    ['sin red', error('network', 'NETWORK_UNREACHABLE')],
    ['plazo vencido', error('timeout', 'REQUEST_TIMEOUT')],
    ['503', error('unavailable', 'UNKNOWN_ERROR', { status: 503 })],
    ['500 del servidor', error('server', 'UNKNOWN_ERROR', { status: 500 })],
    ['500 de la pasarela (texto plano)', error('server', 'UNKNOWN_ERROR', { status: 500, fromGateway: true })],
    ['404 de Traefik sin contenedor detrás', error('not_found', 'UNKNOWN_ERROR', { status: 404, fromGateway: true })],
  ];

  it.each(casos)('%s', (_nombre, e) => {
    expect(esFalloDeServicio(e)).toBe(true);
    const d = describeError(e);
    expect(d.title).toBe('Sin conexión');
    expect(d.detail).toMatch(/^Sin conexión/);
    expect(d.canRetry).toBe(true);
  });
});

describe('los errores de negocio NO se disfrazan de «Sin conexión»', () => {
  it.each([
    ['sesión vencida', error('auth', 'UNAUTHORIZED', { status: 401 }), 'Sesión expirada'],
    ['datos inválidos', error('validation', 'VALIDATION_ERROR', { status: 400 }), 'Revisa los datos'],
    ['no encontrado del API', error('not_found', 'NOT_FOUND', { status: 404 }), 'No encontrado'],
    ['cuenta bloqueada', error('rate_limited', 'ACCOUNT_LOCKED', { status: 429 }), 'Cuenta bloqueada temporalmente'],
  ])('%s', (_nombre, e, titulo) => {
    expect(esFalloDeServicio(e)).toBe(false);
    expect(describeError(e).title).toBe(titulo);
  });
});
