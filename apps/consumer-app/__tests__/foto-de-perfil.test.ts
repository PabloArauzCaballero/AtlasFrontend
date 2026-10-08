import { request } from '../src/api/client';
import { rutaDeFoto } from '../src/api/endpoints/customer';
import { leerBytes } from '../src/device/archivos';
import { MAX_FOTO_BYTES, subirFotoDePerfil, validarFoto } from '../src/features/foto-de-perfil';

jest.mock('../src/api/client', () => ({ request: jest.fn(), readAccessToken: jest.fn(async () => 'tok') }));
jest.mock('../src/device/archivos', () => ({ leerBytes: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));

/** La foto de perfil (Pablo, 2026-10-08): bytes medidos, permiso firmado, subida y confirmación en el servidor. */
describe('foto de perfil', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.mocked(request).mockReset();
  });
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

  it('sólo acepta JPEG o PNG de hasta 5 MB, mirando los bytes', () => {
    expect(validarFoto(JPEG)).toBe('image/jpeg');
    expect(() => validarFoto(new TextEncoder().encode('%PDF-1.7 hola mundo'))).toThrow('JPG o PNG');
    const enorme = new Uint8Array(MAX_FOTO_BYTES + 1);
    enorme.set(JPEG);
    expect(() => validarFoto(enorme)).toThrow('muy pesada');
  });

  it('pide el permiso con el tipo y tamaño reales, sube esos bytes con las cabeceras firmadas y confirma la clave', async () => {
    jest.mocked(leerBytes).mockResolvedValue(JPEG);
    const ticket = {
      storageKey: '1/10/profile-photo/a.jpg',
      uploadUrl: 'https://almacen/a.jpg?firma',
      method: 'PUT',
      requiredHeaders: { 'content-type': 'image/jpeg', 'content-length': String(JPEG.length) },
      expiresAt: '2026-10-08T00:00:00Z',
    };
    jest.mocked(request).mockImplementation((async (ruta: string) =>
      ruta.endsWith('/upload-url') ? ticket : { hasPhoto: true, updatedAt: '2026-10-08T22:00:00.000Z' }) as never);
    const subidas: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      subidas.push({ url: String(url), init });
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    expect(await subirFotoDePerfil('10', 'file:///foto.jpg')).toBe('2026-10-08T22:00:00.000Z');
    expect(request).toHaveBeenNthCalledWith(1, '/customers/10/profile-photo/upload-url', {
      method: 'POST',
      body: { contentType: 'image/jpeg', sizeBytes: JPEG.length },
    });
    expect(subidas).toHaveLength(1);
    expect(subidas[0]?.init.headers).toEqual(ticket.requiredHeaders);
    expect(subidas[0]?.init.body).toBe(JPEG);
    expect(request).toHaveBeenNthCalledWith(2, '/customers/10/profile-photo', { method: 'PUT', body: { storageKey: ticket.storageKey } });
  });

  it('si el almacén rechaza la subida, no confirma nada', async () => {
    jest.mocked(leerBytes).mockResolvedValue(JPEG);
    jest.mocked(request).mockResolvedValueOnce({ storageKey: 'k', uploadUrl: 'https://a', method: 'PUT', requiredHeaders: {}, expiresAt: '' } as never);
    globalThis.fetch = (async () => ({ ok: false, status: 403 }) as Response) as typeof fetch;
    await expect(subirFotoDePerfil('10', 'file:///x.jpg')).rejects.toThrow('HTTP 403');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('la ruta de lectura cambia con cada foto (la caché nunca enseña la anterior)', () => {
    expect(rutaDeFoto('10', '2026-10-08T22:00:00.000Z')).not.toBe(rutaDeFoto('10', '2026-10-09T10:00:00.000Z'));
  });
});
