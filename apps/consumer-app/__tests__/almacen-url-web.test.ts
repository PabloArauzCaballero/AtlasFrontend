import { urlDeSubidaAlAlmacen } from '../src/api/almacen';

/**
 * En la web la subida al almacén va por el mismo origen (nginx la reenvía); en el teléfono, directa.
 * Lo que se fija es la forma exacta de la ruta, que tiene que casar con el `map` de `nginx.web.conf`.
 */
describe('URL de subida al almacén según la plataforma', () => {
  const firmada =
    'http://minio.161.97.85.216.sslip.io/atlas-evidence/1/customer-10/x.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc';

  it('en el teléfono se usa la URL firmada tal cual', () => {
    expect(urlDeSubidaAlAlmacen(firmada, 'ios')).toBe(firmada);
    expect(urlDeSubidaAlAlmacen(firmada, 'android')).toBe(firmada);
  });

  it('en la web va al mismo origen con esquema, host, ruta y firma intactos', () => {
    expect(urlDeSubidaAlAlmacen(firmada, 'web')).toBe(
      '/almacen/http/minio.161.97.85.216.sslip.io/atlas-evidence/1/customer-10/x.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
    );
    expect(urlDeSubidaAlAlmacen('https://minio.atlas.bo:9443/b/k?X-Amz-Signature=1', 'web')).toBe(
      '/almacen/https/minio.atlas.bo:9443/b/k?X-Amz-Signature=1',
    );
  });

  it('en la web, un almacén que no es minio.* (local, sin nginx delante) sigue directo', () => {
    const local = 'http://localhost:59000/atlas-evidence/x.jpg?X-Amz-Signature=abc';
    expect(urlDeSubidaAlAlmacen(local, 'web')).toBe(local);
    expect(urlDeSubidaAlAlmacen('no es una url', 'web')).toBe('no es una url');
  });
});
