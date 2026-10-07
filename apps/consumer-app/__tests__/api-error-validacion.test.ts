import { AtlasApiError } from '../src/api/errors';
import { configureClient, request } from '../src/api/client';

/**
 * El 400 de validación dice QUÉ campo falló.
 *
 * El backend manda `error.issues[{path, message}]` junto al genérico «Entrada inválida en body.».
 * La app sólo enseñaba el genérico, y el 400 del asistente (`clientMessageId` no era UUID) se vio
 * como «Entrada inválida» sin pista alguna.
 */
const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('cliente HTTP · errores de validación', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    configureClient({
      tokenStore: { read: async () => null, write: async () => undefined, clear: async () => undefined },
      onSessionExpired: () => undefined,
    });
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('un 400 con issues pone el campo y el motivo en el mensaje', async () => {
    globalThis.fetch = (async () =>
      json(400, {
        requestId: 'r',
        error: {
          code: 'BAD_REQUEST',
          message: 'Entrada inválida en body.',
          issues: [{ path: 'clientMessageId', message: 'clientMessageId debe ser un UUID.' }],
        },
      })) as unknown as typeof fetch;

    const error = await request('/mobile/assist/chat', { method: 'POST', body: {} }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AtlasApiError);
    expect((error as AtlasApiError).message).toBe('Entrada inválida en body: clientMessageId — clientMessageId debe ser un UUID.');
  });

  it('un 400 sin issues conserva el mensaje del servidor', async () => {
    globalThis.fetch = (async () =>
      json(400, { requestId: 'r', error: { code: 'BAD_REQUEST', message: 'Algo no cuadra.' } })) as unknown as typeof fetch;

    const error = await request('/x').catch((caught: unknown) => caught);

    expect((error as AtlasApiError).message).toBe('Algo no cuadra.');
  });
});
