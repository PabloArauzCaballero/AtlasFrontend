import { urlDeSubidaAlAlmacen } from '../src/api/almacen';

/**
 * En la web la subida al almacén va por el mismo origen (nginx la reenvía); en el teléfono, directa.
 * Lo que se fija es la forma exacta de la ruta, que tiene que casar con el `map` de `nginx.web.conf`.
 */
describe('URL de subida al almacén según la plataforma', () => {
  const firmada =
    'http://minio.161.97.85.216.sslip.io/atlas-evidence/1/customer-10/x.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc';

  it('en el teléfono, con la API por http (local), la URL firmada va tal cual', () => {
    expect(urlDeSubidaAlAlmacen(firmada, 'ios', 'http://192.168.0.197:3105/api/v1')).toBe(firmada);
    expect(urlDeSubidaAlAlmacen(firmada, 'android', 'http://192.168.0.197:3105/api/v1')).toBe(firmada);
  });

  it('en el teléfono, almacén http con API https (TEST): por el proxy https del origen de la API', () => {
    // iOS bloquea el http plano y la red de Pablo corta sslip.io: sin esto la foto no sube.
    expect(urlDeSubidaAlAlmacen(firmada, 'ios', 'https://atlas.consumerweb.test.arauzsoftware.com/api/v1')).toBe(
      'https://atlas.consumerweb.test.arauzsoftware.com/almacen/http/minio.161.97.85.216.sslip.io/atlas-evidence/1/customer-10/x.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
    );
  });

  it('en el teléfono, un almacén ya https (DEV por Tailscale) va directo', () => {
    const segura = 'https://minio.atlas.bo/b/k?X-Amz-Signature=1';
    expect(urlDeSubidaAlAlmacen(segura, 'ios', 'https://pablo-h310.taila8f993.ts.net/api/v1')).toBe(segura);
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
