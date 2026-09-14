import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uploadProof, type ProofTicket } from '../src/api/endpoints/payment-claims';

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

  it('el comprobante viaja con las cabeceras firmadas que devolvió el backend', async () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      if (url === 'file:///comprobante.jpg') return { blob: async () => blob } as unknown as Response;
      llamadas.push({ url: String(url), init });
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => '' } as unknown as Response;
    }) as typeof fetch;

    const ticket: ProofTicket = {
      uploadUrl: 'https://almacen/atlas-evidence/1/customer-10/PAYMENT_PROOF/x.jpg?firma',
      storageKey: '1/customer-10/PAYMENT_PROOF/x.jpg',
      method: 'PUT',
      requiredHeaders: { 'content-type': 'image/jpeg', 'content-length': '3' },
      expiresAt: '2026-09-14T00:00:00.000Z',
    };
    await uploadProof(ticket, 'file:///comprobante.jpg', 'image/jpeg');

    expect(llamadas).toHaveLength(1);
    const [llamada] = llamadas;
    expect(llamada?.url).toBe(ticket.uploadUrl);
    expect(llamada?.init.method).toBe('PUT');
    expect(llamada?.init.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '3' });
  });

  it('el extracto lee los bytes con await (bytes() es asíncrono en expo-file-system 57)', () => {
    const fuente = readFileSync(join(__dirname, '..', 'app', '(app)', 'extracto-bancario.tsx'), 'utf8');
    expect(fuente).toMatch(/const bytes = await file\.bytes\(\);/);
    expect(fuente).not.toMatch(/const bytes = file\.bytes\(\);/);
  });
});
