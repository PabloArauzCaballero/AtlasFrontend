/**
 * El cliente del comercio tiene que comportarse como el de la web (`AtlasERPFrontend/lib/apiClient.ts`):
 * sobre `{ success, data }`, renovación contra `auth/merchant/refresh` en un 401, y las cookies de la
 * sesión en TODA petición (`credentials: 'include'`), que es de lo que vive la sesión en el teléfono.
 */
import {
  ApiError,
  alCerrarseLaSesion,
  apiBlobUrl,
  apiRequest,
  bootstrapSession,
  clearAccessToken,
  fijarPantallaActual,
  getAccessToken,
  setAccessToken,
} from '../../src/api/client';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-de-prueba' }));

type Llamada = { url: string; init: RequestInit };

function respuesta(status: number, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Response {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  return new Response(texto, { status, headers: { 'content-type': 'application/json', ...cabeceras } });
}

let llamadas: Llamada[];
function simular(...respuestas: Response[]) {
  llamadas = [];
  const cola = [...respuestas];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    const siguiente = cola.shift();
    if (!siguiente) throw new Error('fetch sin respuesta preparada');
    return siguiente;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  clearAccessToken();
  fijarPantallaActual(null);
});

test('desenvuelve el sobre y manda cookies, producto y pantalla', async () => {
  setAccessToken('token-1');
  fijarPantallaActual('/gestion-pos');
  simular(respuesta(200, { success: true, data: { ok: 1 } }));

  await expect(apiRequest('/partner-onboarding/mine')).resolves.toEqual({ ok: 1 });

  const { url, init } = llamadas[0]!;
  expect(url).toBe('https://api.atlas.invalid/api/v1/partner-onboarding/mine');
  expect(init.credentials).toBe('include');
  const cabeceras = init.headers as Record<string, string>;
  expect(cabeceras.Authorization).toBe('Bearer token-1');
  expect(cabeceras['x-atlas-product']).toBe('merchant-app');
  expect(cabeceras['x-atlas-flow']).toBe('/gestion-pos');
});

test('un sobre con success:false es un error con su código, aunque llegue en 200', async () => {
  simular(respuesta(200, { success: false, error: { message: 'No se puede', code: 'NOPE' } }));
  const fallo = await apiRequest('/x').catch((e: unknown) => e);
  expect(fallo).toBeInstanceOf(ApiError);
  expect((fallo as ApiError).code).toBe('NOPE');
  expect((fallo as ApiError).message).toBe('No se puede');
});

test('en un 401 renueva contra auth/merchant/refresh y repite la petición', async () => {
  setAccessToken('viejo');
  simular(
    respuesta(401, { success: false, error: { message: 'caducó' } }),
    respuesta(200, { success: true, data: { accessToken: 'nuevo' } }),
    respuesta(200, { success: true, data: [1, 2] }),
  );

  await expect(apiRequest('/merchant-credit/1/applications')).resolves.toEqual([1, 2]);
  expect(llamadas[1]!.url).toMatch(/\/auth\/merchant\/refresh$/);
  expect(getAccessToken()).toBe('nuevo');
  expect((llamadas[2]!.init.headers as Record<string, string>).Authorization).toBe('Bearer nuevo');
});

test('si el refresh es rechazado, se cierra la sesión y se avisa', async () => {
  setAccessToken('viejo');
  const oyente = jest.fn();
  const quitar = alCerrarseLaSesion(oyente);
  simular(respuesta(401, { success: false, error: { message: 'caducó' } }), respuesta(401, { success: false, error: { message: 'no' } }));

  await expect(apiRequest('/x')).rejects.toBeInstanceOf(ApiError);
  expect(getAccessToken()).toBeNull();
  expect(oyente).toHaveBeenCalledTimes(1);
  quitar();
});

test('al abrir la app recupera la sesión con la cookie de refresco', async () => {
  simular(respuesta(200, { success: true, data: { accessToken: 'desde-cookie' } }));
  await expect(bootstrapSession()).resolves.toBe(true);
  expect(getAccessToken()).toBe('desde-cookie');
  expect(llamadas[0]!.init.credentials).toBe('include');
});

test('una mutación sin respuesta no se repite y dice que no se sabe si se guardó', async () => {
  llamadas = [];
  global.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;

  const fallo = await apiRequest('/x', { method: 'POST', body: {} }).catch((e: unknown) => e);
  expect((fallo as ApiError).resultadoDesconocido).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('una imagen autenticada vuelve como data URI con su tipo', async () => {
  llamadas = [];
  global.fetch = jest.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;
  await expect(apiBlobUrl('/merchant-credit/1/payment-claims/2/proof')).resolves.toBe('data:image/png;base64,AQID');
});
