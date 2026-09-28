import { Platform } from 'react-native';
import { apiConfig } from './config';
import { fetchRepetible } from './reintentos';

/**
 * La subida al almacén (MinIO) con la URL firmada que emite AtlasBackend.
 *
 * ## Por qué en el navegador no va directo
 *
 * En el teléfono la URL firmada se usa tal cual. En la web no: la app se sirve por https
 * (`https://atlas.consumerweb.test.arauzsoftware.com`) y el almacén de TEST por
 * `http://minio.161.97.85.216.sslip.io`, así que el navegador bloquea el PUT por contenido mixto
 * —el 2026-09-26 pasó en el ERP y no se podía subir ningún documento— y, además, `*.sslip.io` lo
 * corta el filtro web de la red de Pablo.
 *
 * Por eso, en la web, la URL se reescribe a este mismo origen: `/almacen/<esquema>/<host>/<ruta>`,
 * y el nginx que sirve la web (`nginx.web.conf`) la reenvía al almacén con el `Host` original, que
 * es el que cubre la firma. Sólo se reescriben hosts `minio.*`, los mismos que nginx acepta: en
 * local (`localhost:59000`) no hay nginx delante y la subida sigue yendo directa.
 */
export function urlDeSubidaAlAlmacen(url: string, plataforma: string = Platform.OS, apiBase: string = apiConfig.baseUrl): string {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    return url;
  }
  if (!destino.hostname.startsWith('minio.')) return url;
  const esquema = destino.protocol.replace(':', '');
  const ruta = `/almacen/${esquema}/${destino.host}${destino.pathname}${destino.search}`;
  if (plataforma === 'web') return ruta;
  /*
    En el teléfono, un almacén por http con la API por https (TestFlight contra TEST, 2026-09-28):
    iOS bloquea el http plano (ATS) y la red de Pablo corta `*.sslip.io`. Se usa el mismo proxy que
    la web, en el ORIGEN de la API, que es https y sirve el mismo nginx. Con el almacén por https
    (DEV por Tailscale) la URL firmada sigue yendo directa.
  */
  if (destino.protocol !== 'http:') return url;
  let api: URL;
  try {
    api = new URL(apiBase);
  } catch {
    return url;
  }
  return api.protocol === 'https:' ? `${api.origin}${ruta}` : url;
}

/** `fetchRepetible` hacia el almacén: misma política de reintentos, URL adecuada a la plataforma. */
export function fetchAlAlmacen(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  return fetchRepetible(urlDeSubidaAlAlmacen(url), init, signal);
}
