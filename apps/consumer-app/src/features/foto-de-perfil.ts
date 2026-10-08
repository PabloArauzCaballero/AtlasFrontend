/**
 * La foto de perfil, del teléfono a la cuenta (Pablo, 2026-10-08: «que se pueda subir y guardar la imagen del perfil»).
 *
 * Mismo camino que el comprobante (`comprobante-de-pago.ts`): se eligen los BYTES una vez, el tipo sale de su firma
 * binaria, se pide el permiso firmado con ese tipo y tamaño exactos, se sube al almacén y se confirma. El servidor
 * vuelve a mirar el objeto (que sea JPEG/PNG, el tamaño, el antivirus) antes de fijarlo como foto.
 *
 * La foto se LEE por la API (`GET customers/:id/profile-photo`) con el token: el teléfono nunca guarda una URL del
 * almacén, que caducaría y que en iOS podría ir por http.
 */
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchAlAlmacen } from '../api/almacen';
import { readAccessToken } from '../api/client';
import { apiConfig } from '../api/config';
import { confirmarFoto, pedirPermisoDeFoto, rutaDeFoto, type FotoTicket } from '../api/endpoints/customer';
import { leerBytes } from '../device/archivos';
import { detectMimeType } from './evidence-upload';

/** Lo mismo que acepta el servidor. La foto sale recortada y comprimida, así que en la práctica pesa ~200 KB. */
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;

export type Origen = 'galeria' | 'camara';

/** Abre la galería o la cámara con recorte cuadrado. `null` si la persona canceló. */
export async function elegirFoto(origen: Origen): Promise<string | null> {
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) throw new Error('Para tomar la foto, permite el uso de la cámara en los ajustes del teléfono.');
  }
  const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets?.[0]?.uri) return null;
  return r.assets[0].uri;
}

/** Comprueba los bytes ANTES de pedir nada al servidor: con la foto en la mano se explica mejor que después de un 422. */
export function validarFoto(bytes: Uint8Array): 'image/jpeg' | 'image/png' {
  const tipo = detectMimeType(bytes);
  if (tipo !== 'image/jpeg' && tipo !== 'image/png') throw new Error('Esa imagen no se puede usar. Elige una foto JPG o PNG.');
  if (bytes.length > MAX_FOTO_BYTES) throw new Error('La foto es muy pesada. Elige otra o tómala de nuevo.');
  return tipo;
}

async function subirAlAlmacen(ticket: FotoTicket, bytes: Uint8Array): Promise<void> {
  // Bytes y NUNCA un Blob: el fetch de Expo pisa el Content-Type firmado con el del blob (403 de firma).
  const respuesta = await fetchAlAlmacen(ticket.uploadUrl, { method: ticket.method ?? 'PUT', headers: ticket.requiredHeaders, body: bytes as unknown as BodyInit });
  if (!respuesta.ok) throw new Error(`No se pudo subir la foto (HTTP ${respuesta.status}).`);
}

/** De la imagen elegida a la foto de la cuenta. Devuelve cuándo quedó fijada. */
export async function subirFotoDePerfil(customerId: string, uri: string): Promise<string> {
  const bytes = await leerBytes(uri);
  const contentType = validarFoto(bytes);
  const ticket = await pedirPermisoDeFoto(customerId, { contentType, sizeBytes: bytes.length });
  await subirAlAlmacen(ticket, bytes);
  const { updatedAt } = await confirmarFoto(customerId, ticket.storageKey);
  return updatedAt;
}

export type FuenteDeFoto = { uri: string; headers: Record<string, string> };

/**
 * La fuente de `<Image>` para la foto: la ruta de la API con el token. `null` si no hay foto (o aún no se leyó el
 * token). El `?v=` de la ruta cambia con cada foto, así que la caché de imágenes nunca enseña la anterior.
 */
export function useFuenteDeFoto(customerId: string | null | undefined, actualizada: string | null | undefined): FuenteDeFoto | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!customerId || !actualizada) return;
    void readAccessToken().then((t) => {
      if (vivo) setToken(t);
    });
    return () => {
      vivo = false;
    };
  }, [customerId, actualizada]);
  if (!customerId || !actualizada || !token) return null;
  return {
    uri: `${apiConfig.baseUrl}${rutaDeFoto(customerId, actualizada)}`,
    headers: { authorization: `Bearer ${token}`, 'x-tenant-id': apiConfig.tenantId },
  };
}
