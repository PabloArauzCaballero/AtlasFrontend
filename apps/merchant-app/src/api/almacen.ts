/**
 * Subida al almacenamiento con un permiso firmado (el QR de cobro del banco, por ahora).
 *
 * Igual que el portal web, la subida NO va directa al almacén: pasa por `/almacen/subida` del mismo
 * origen que sirve la API (`atlas.erp…`), con la URL firmada en `x-almacen-destino`. El almacén de
 * TEST va por http y un iPhone no habla http; el portal ya tiene ese puente por https.
 *
 * El cuerpo son BYTES, nunca un Blob: el `fetch` de Expo pisa el `Content-Type` con el tipo del Blob,
 * la firma cubre esa cabecera y MinIO responde 403 `SignatureDoesNotMatch` (memoria
 * «Subidas de la app: nunca un Blob», 2026-10-07). Tampoco lleva la sesión de Atlas: mandarla al
 * almacén sería filtrarla.
 */
import { File } from 'expo-file-system';
import { apiBaseUrl } from './config';
import { conReintentos } from './reintentos';

export const RUTA_SUBIDA_AL_ALMACEN = '/almacen/subida';
export const CABECERA_DESTINO = 'x-almacen-destino';

export interface PermisoDeSubida {
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
}

/** Un archivo elegido en el teléfono (cámara, fotos o documentos). */
export interface ArchivoLocal {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export function urlDeSubida(base: string = apiBaseUrl): string {
  return `${new URL(base).origin}${RUTA_SUBIDA_AL_ALMACEN}`;
}

export async function leerBytes(archivo: ArchivoLocal): Promise<Uint8Array> {
  return new File(archivo.uri).bytes();
}

export async function subirAlAlmacen(permiso: PermisoDeSubida, archivo: ArchivoLocal): Promise<void> {
  const cuerpo = await leerBytes(archivo);
  const response = await conReintentos(
    () =>
      fetch(urlDeSubida(), {
        method: permiso.method,
        headers: { ...permiso.requiredHeaders, [CABECERA_DESTINO]: permiso.uploadUrl },
        body: cuerpo as unknown as BodyInit,
      }),
    { repeticion: 'segura', esSinRespuesta: (error) => error instanceof TypeError },
  );
  if (!response.ok) {
    throw new Error(`El almacenamiento rechazó la subida del archivo (${response.status}).`);
  }
}
