import { configureClient } from '../src/api/client';
import { AtlasApiError } from '../src/api/errors';
import { avisoYaEnviado, submitDownPayment, submitPaymentClaim } from '../src/api/endpoints/payment-claims';

/**
 * APP-15: los dos avisos de pago llevan `x-idempotency-key` (R75), y el 409 «ya pendiente» que
 * provoca un reintento tras un plazo agotado se trata como lo que es: el aviso ya está.
 */
const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(body) }) as unknown as Response;

describe('avisos de pago idempotentes', () => {
  const originalFetch = globalThis.fetch;
  const cabeceras: Record<string, string>[] = [];

  beforeEach(() => {
    cabeceras.length = 0;
    configureClient({
      tokenStore: { read: async () => ({ accessToken: 'a', refreshToken: 'r' }), write: async () => undefined, clear: async () => undefined },
    });
    globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
      cabeceras.push(init.headers as Record<string, string>);
      return json(201, { requestId: 'r', data: {} });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const cuerpo = { amount: '60.00', storageKey: 'k', contentType: 'image/jpeg' };

  it('el pago inicial manda la clave', async () => {
    await submitDownPayment('7', '9', cuerpo);
    expect(cabeceras[0]?.['x-idempotency-key']).toBeTruthy();
  });

  it('el aviso de una cuota manda la clave', async () => {
    await submitPaymentClaim('7', { ...cuerpo, installmentId: '3' });
    expect(cabeceras[0]?.['x-idempotency-key']).toBeTruthy();
  });

  it('un 409 *_ALREADY_PENDING es éxito; los demás errores no', () => {
    const conflicto = (code: string) => new AtlasApiError({ kind: 'conflict', code, message: code, status: 409 });
    expect(avisoYaEnviado(conflicto('DOWN_PAYMENT_ALREADY_PENDING'))).toBe(true);
    expect(avisoYaEnviado(conflicto('PAYMENT_CLAIM_ALREADY_PENDING'))).toBe(true);
    expect(avisoYaEnviado(conflicto('DOWN_PAYMENT_ALREADY_CONFIRMED'))).toBe(false);
    expect(avisoYaEnviado(conflicto('DOWN_PAYMENT_NOT_ALLOWED_YET'))).toBe(false);
    expect(avisoYaEnviado(new Error('DOWN_PAYMENT_ALREADY_PENDING'))).toBe(false);
  });

  it('el código sale del mensaje del backend (ConflictException de Nest)', async () => {
    globalThis.fetch = (async () =>
      json(409, { requestId: 'r', error: { code: 'CONFLICT', message: 'DOWN_PAYMENT_ALREADY_PENDING' } })) as unknown as typeof fetch;
    const error = await submitDownPayment('7', '9', cuerpo).catch((e: unknown) => e);
    expect(avisoYaEnviado(error)).toBe(true);
  });
});
