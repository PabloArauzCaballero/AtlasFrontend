/**
 * Elegir archivos en el teléfono: la imagen del QR del banco, el poder notarial y el Excel.
 *
 * En la web todo es un `<input type="file">` (`FileDropField`). En el teléfono son tres caminos
 * nativos —la fototeca, la cámara y el selector de documentos—, y los tres devuelven un archivo en
 * la caché de la app que luego se sube como BYTES (`api/almacen.ts`), nunca como Blob.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { ArchivoLocal } from '@/api/almacen';

/** El peso de un archivo si el selector no lo dijo. */
function pesoDe(uri: string, dicho: number | null | undefined): number | undefined {
  if (typeof dicho === 'number' && dicho > 0) return dicho;
  try {
    return new File(uri).size ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Una imagen de la fototeca o de la cámara. `null` = la persona canceló o negó el permiso (y se
 * devuelve por qué, para decirlo en vez de no hacer nada).
 */
export async function elegirImagen(origen: 'fotos' | 'camara'): Promise<{ archivo: ArchivoLocal | null; permisoNegado: boolean }> {
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return { archivo: null, permisoNegado: true };
  }
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
  const resultado = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  const elegido = resultado.canceled ? undefined : resultado.assets[0];
  if (!elegido) return { archivo: null, permisoNegado: false };
  const type = elegido.mimeType ?? (elegido.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return {
    archivo: {
      uri: elegido.uri,
      name: elegido.fileName ?? (type === 'image/png' ? 'qr.png' : 'qr.jpg'),
      type,
      size: pesoDe(elegido.uri, elegido.fileSize),
    },
    permisoNegado: false,
  };
}

/** Un documento (PDF, imagen, Excel). `null` = cancelado. */
export async function elegirDocumento(tipos: string[]): Promise<ArchivoLocal | null> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: tipos, copyToCacheDirectory: true, multiple: false });
  const elegido = resultado.canceled ? undefined : resultado.assets[0];
  if (!elegido) return null;
  return { uri: elegido.uri, name: elegido.name, type: elegido.mimeType ?? 'application/octet-stream', size: pesoDe(elegido.uri, elegido.size) };
}

/** «10 MB», «1.2 MB», «340 KB»: el peso como lo enseña la ficha de archivo de la web (`FilePreview`). */
export function tamanoLegible(bytes: number | undefined): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const megas = bytes / (1024 * 1024);
  return `${Number.isInteger(megas) ? megas : megas.toFixed(1)} MB`;
}

/** El aviso de la web cuando un archivo pasa del máximo del campo. */
export function avisoDePeso(nombre: string, bytes: number | undefined, maximo: number): string | null {
  if (!bytes || bytes <= maximo) return null;
  return `«${nombre}» pesa ${tamanoLegible(bytes)}; el máximo es ${tamanoLegible(maximo)}.`;
}
