/**
 * Leer y bajar archivos, en el teléfono y en el navegador.
 *
 * `expo-file-system` NO existe en web: su implementación web es una cáscara que escribe «not
 * supported» en consola y devuelve vacío. Las cuatro pantallas que leen un archivo elegido —el
 * carnet y la selfie, el extracto en PDF, la foto para soporte— hacían `new File(uri).bytes()` y en
 * el navegador subían cero bytes sin error. Aquí está la única bifurcación, para que ninguna
 * pantalla tenga que saber en qué plataforma corre.
 *
 * En web, lo que devuelven el selector de imágenes, el de documentos y la cámara es una URL
 * `blob:` o `data:`, y las dos se leen con `fetch`. En el teléfono es un `file://` y lo lee
 * `expo-file-system`.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export async function leerBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const respuesta = await fetch(uri);
    if (!respuesta.ok) throw new Error(`No se pudo leer el archivo (${respuesta.status}).`);
    return new Uint8Array(await respuesta.arrayBuffer());
  }
  return new File(uri).bytes();
}

/**
 * Borra la copia temporal que el selector de documentos dejo en la cache del telefono.
 *
 * `DocumentPicker` con `copyToCacheDirectory: true` copia el archivo elegido a la cache de la app, y
 * ahi se quedaba despues de subirlo: el extracto bancario «no queda en tu telefono» era falso. Solo
 * se borra si la ruta esta DENTRO de la cache: nunca el original que la persona eligio en sus
 * archivos. Nunca lanza: limpiar es un extra y no puede romper una subida que ya salio bien. En web
 * suelta la URL `blob:`.
 */
export function borrarCopiaLocal(uri: string): boolean {
  try {
    if (Platform.OS === 'web') {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      return true;
    }
    if (!uri.startsWith(Paths.cache.uri)) return false;
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
    return true;
  } catch {
    return false;
  }
}

/** El contenido en base64 puro, sin cabecera `data:`. */
export async function leerArchivoEnBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return new File(uri).base64();
  const bytes = await leerBytes(uri);
  // `btoa` trabaja sobre una cadena de bytes; se arma por tramos para no desbordar la pila con una foto grande.
  let binario = '';
  const TRAMO = 0x8000;
  for (let i = 0; i < bytes.length; i += TRAMO) binario += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  return btoa(binario);
}

/**
 * Baja un archivo del backend CON la sesión y devuelve una URI local que se puede abrir o reproducir.
 *
 * En el teléfono se guarda en la caché (un documento derivado que se puede volver a pedir); en el
 * navegador se convierte en una URL `blob:` del propio origen, que vive mientras la pestaña viva.
 */
export async function descargarConSesion(input: {
  url: string;
  headers: Record<string, string>;
  nombre: string;
  /** Si ya existe en caché no se vuelve a pedir. Sólo tiene sentido en el teléfono. */
  reutilizar?: boolean;
}): Promise<string> {
  if (Platform.OS === 'web') {
    const respuesta = await fetch(input.url, { headers: input.headers });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`);
    return URL.createObjectURL(await respuesta.blob());
  }
  const destino = new File(new Directory(Paths.cache), input.nombre);
  if (input.reutilizar && destino.exists) return destino.uri;
  const archivo = await File.downloadFileAsync(input.url, destino, { headers: input.headers, idempotent: true });
  return archivo.uri;
}

/**
 * En el navegador «compartir» es guardar: se crea un enlace con `download` y se pulsa. Devuelve
 * `false` fuera de web, donde el camino es `expo-sharing`.
 */
export function guardarEnNavegador(uri: string, nombre: string): boolean {
  if (Platform.OS !== 'web') return false;
  const documento = (globalThis as { document?: Document }).document;
  if (!documento) return false;
  const enlace = documento.createElement('a');
  enlace.href = uri;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  documento.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  return true;
}
