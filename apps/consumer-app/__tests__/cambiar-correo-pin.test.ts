import { configureClient } from '../src/api/client';
import { reauthenticate } from '../src/api/endpoints/auth';
import { addContactMethod } from '../src/api/endpoints/onboarding';
import { AtlasApiError } from '../src/api/errors';
import { changeEmailFailure } from '../src/features/change-email';

/**
 * Cambiar el correo exige repetir el PIN. El servidor no cree un «sí» del cliente: pide una PRUEBA
 * (`x-reauth-token`) que él mismo emitió. Estos tests fijan que la prueba sale del PIN y viaja con la
 * declaración del correo, sin poder pisar las cabeceras del cliente (autorización, tenant).
 */
type Llamada = { url: string; method: string; headers: Record<string, string>; body: unknown };

function respuesta(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('cambiar el correo · el PIN antes', () => {
  const llamadas: Llamada[] = [];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    llamadas.length = 0;
    configureClient({
      tokenStore: {
        read: async () => ({ accessToken: 'sesion', refreshToken: 'refresco' }),
        write: async () => undefined,
        clear: async () => undefined,
      },
    });
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      llamadas.push({
        url: String(url),
        method: String(init.method),
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return respuesta(200, { data: { reauthToken: 'prueba', expiresInSeconds: 300, expiresAt: 'x', contactMethodId: '7' } });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('el PIN va a /auth/reauthenticate como la credencial de la cuenta', async () => {
    await expect(reauthenticate('1234')).resolves.toEqual(expect.objectContaining({ reauthToken: 'prueba' }));

    expect(llamadas[0]?.url).toMatch(/\/auth\/reauthenticate$/);
    expect(llamadas[0]?.method).toBe('POST');
    expect(llamadas[0]?.body).toEqual({ password: '1234' });
  });

  it('la prueba viaja en x-reauth-token al declarar el correo, sin pisar la sesión', async () => {
    await addContactMethod('42', { contactType: 'email', value: 'nuevo@ejemplo.bo' }, 'prueba');

    const cabeceras = llamadas[0]?.headers ?? {};
    expect(llamadas[0]?.url).toMatch(/\/customer-onboarding\/42\/contact-methods$/);
    expect(cabeceras['x-reauth-token']).toBe('prueba');
    expect(cabeceras.authorization).toBe('Bearer sesion');
  });

  it('sin prueba no se inventa ninguna cabecera', async () => {
    await addContactMethod('42', { contactType: 'phone', value: '+59170000000' });

    expect(llamadas[0]?.headers['x-reauth-token']).toBeUndefined();
  });

  it('una prueba vencida se explica como «confirma tu PIN otra vez», no como un error genérico', () => {
    const vencida = new AtlasApiError({ kind: 'permission', code: 'REAUTH_REQUIRED', message: 'x', status: 403 });

    expect(changeEmailFailure(vencida, 'email')).toEqual(expect.objectContaining({ kind: 'banner', title: 'Confirma tu PIN otra vez' }));
  });
});
