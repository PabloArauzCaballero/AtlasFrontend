import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from '../src/api/client';
import { uploadProof, type ProofTicket } from '../src/api/endpoints/payment-claims';
import { leerBytes } from '../src/device/archivos';
import { subirComprobante } from '../src/features/comprobante-de-pago';

jest.mock('../src/api/client', () => ({ request: jest.fn() }));
jest.mock('../src/device/archivos', () => ({ leerBytes: jest.fn() }));

/**
 * Dos subidas por URL firmada que estaban rotas sin que ninguna prueba lo viera.
 *
 * 1. El comprobante de pago: la app mandaba `ticket.headers`, que el backend nunca devuelve (el campo
 *    real es `requiredHeaders`, con `content-type` y `content-length` firmados). El PUT salía sin las
 *    cabeceras firmadas y el almacén podía rechazarlo por firma.
 * 2. El extracto bancario: `file.bytes()` es asíncrono en expo-file-system 57 y se mandaba la Promise
 *    como cuerpo. La pantalla «Recalcular mi línea» prometía subir el PDF y no subía nada.
 */
describe('subidas por URL firmada', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const ticket: ProofTicket = {
    uploadUrl: 'https://almacen/atlas-evidence/1/customer-10/PAYMENT_PROOF/x.jpg?firma',
    storageKey: '1/customer-10/PAYMENT_PROOF/x.jpg',
    method: 'PUT',
    requiredHeaders: { 'content-type': 'image/jpeg', 'content-length': '3' },
    expiresAt: '2026-09-14T00:00:00.000Z',
  };

  it('el comprobante viaja con las cabeceras firmadas que devolvió el backend, y con los bytes medidos', async () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), init });
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' } as unknown as Response;
    }) as typeof fetch;

    const bytes = new Uint8Array([1, 2, 3]);
    await uploadProof(ticket, bytes);

    // Una sola petición: el archivo NO se vuelve a leer con `fetch(file://)` para subirlo.
    expect(llamadas).toHaveLength(1);
    const [llamada] = llamadas;
    expect(llamada?.url).toBe(ticket.uploadUrl);
    expect(llamada?.init.method).toBe('PUT');
    expect(llamada?.init.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '3' });
    expect(llamada?.init.body).toBe(bytes);
  });

  /*
   * El 403 del 2026-10-07 (TestFlight, build 38): las pantallas de pago leían el comprobante con
   * `fetch(file://).blob()` y declaraban `image/jpeg` a ciegas. El almacén firma tipo y tamaño.
   */
  describe('subirComprobante', () => {
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

    it('declara el tipo y el tamaño REALES del archivo y sube esos mismos bytes', async () => {
      (leerBytes as jest.Mock).mockResolvedValue(PNG);
      const puts: RequestInit[] = [];
      globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
        puts.push(init);
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' } as unknown as Response;
      }) as typeof fetch;
      (request as jest.Mock).mockResolvedValue({
        ...ticket,
        requiredHeaders: { 'content-type': 'image/png', 'content-length': String(PNG.length) },
      });

      const subido = await subirComprobante('60', 'file:///captura.png');

      expect(request).toHaveBeenCalledWith('/mobile/customers/60/payment-claims/proof-tickets', {
        method: 'POST',
        body: { contentType: 'image/png', sizeBytes: PNG.length },
      });
      expect(puts).toHaveLength(1);
      expect(puts[0]?.headers).toEqual({ 'content-type': 'image/png', 'content-length': String(PNG.length) });
      expect(puts[0]?.body).toBe(PNG);
      expect(subido).toEqual({ storageKey: ticket.storageKey, contentType: 'image/png' });
    });

    it('una imagen que no es JPEG ni PNG se rechaza antes de pedir el ticket', async () => {
      (leerBytes as jest.Mock).mockResolvedValue(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]));
      (request as jest.Mock).mockClear();
      await expect(subirComprobante('60', 'file:///raro.heic')).rejects.toThrow(/No pudimos leer esa imagen/);
      expect(request).not.toHaveBeenCalled();
    });

    it('ninguna pantalla de pago vuelve a subir por blob ni a fijar image/jpeg', () => {
      for (const ruta of [['app', '(app)', 'pagar', '[installmentId].tsx'], ['app', '(app)', 'pago', '[itemId].tsx']]) {
        const fuente = readFileSync(join(__dirname, '..', ...ruta), 'utf8');
        expect(fuente).not.toMatch(/fetch\(proofUri\)/);
        expect(fuente).not.toMatch(/contentType = 'image\/jpeg'/);
        expect(fuente).toMatch(/subirComprobante\(/);
      }
    });
  });

  it('el extracto lee los bytes con await (bytes() es asíncrono en expo-file-system 57)', () => {
    const fuente = readFileSync(join(__dirname, '..', 'src', 'features', 'onboarding', 'pantalla-extracto.tsx'), 'utf8');
    expect(fuente).toMatch(/const bytes = await leerBytes\(asset\.uri\);/);
    expect(fuente).not.toMatch(/const bytes = file\.bytes\(\);/);
  });
});
