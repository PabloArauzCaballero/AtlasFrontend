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

/*
  Donde los modulos nativos dejan copias que son NUESTRAS y se pueden borrar:
  - la cache de la app: la camara (`Camera/`), el selector de imagenes (`ImagePicker/`), el de
    documentos (`DocumentPicker/`), el escaner en Android (`<uuid>.jpg` suelto) y nuestras descargas;
  - en iOS, ademas, `tmp/`: el escaner de documentos escribe el carnet en `NSTemporaryDirectory()`
    (`DocumentScanner.mm`, `processImage`), fuera de la cache, y ahi se quedaba.
  Se comparan sin `file://` ni el `/private` que iOS antepone a veces: `NSTemporaryDirectory` llega
  normalizado (`stringByStandardizingPath` quita `/private`) y `Paths` puede no hacerlo.
*/
function sinEsquema(uri: string): string {
  return uri.replace(/^file:\/\//, '').replace(/^\/private(?=\/)/, '');
}

function conBarra(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

/** La cache de la app y, en iOS, `tmp/`. Nunca `Documents/` ni nada que la persona haya elegido. */
export function directoriosTemporales(): string[] {
  const salida: string[] = [];
  try {
    salida.push(conBarra(Paths.cache.uri));
  } catch {
    /* sin cache conocida: no se borra nada */
  }
  if (Platform.OS === 'ios') {
    try {
      const documentos = Paths.document?.uri;
      // `<contenedor>/Documents/` → `<contenedor>/tmp/`, que es lo que devuelve `NSTemporaryDirectory()`.
      if (documentos && /\/Documents\/?$/.test(documentos)) salida.push(documentos.replace(/Documents\/?$/, 'tmp/'));
    } catch {
      /* sin documentos no hay tmp que deducir */
    }
  }
  return salida;
}

function dentroDeTemporales(uri: string): boolean {
  const ruta = sinEsquema(uri);
  return directoriosTemporales().some((dir) => ruta.startsWith(sinEsquema(dir)));
}

/**
 * Borra la copia temporal que el selector de documentos, la camara o el escaner dejaron en el telefono.
 *
 * `DocumentPicker` con `copyToCacheDirectory: true` copia el archivo elegido a la cache de la app, y
 * ahi se quedaba despues de subirlo: el extracto bancario «no queda en tu telefono» era falso. Lo
 * mismo con las fotos del carnet y las selfies (APP-10). Solo se borra si la ruta esta DENTRO de la
 * cache o del `tmp/` de iOS: nunca el original que la persona eligio en sus archivos. Nunca lanza:
 * limpiar es un extra y no puede romper una subida que ya salio bien. En web suelta la URL `blob:`.
 */
export function borrarCopiaLocal(uri: string): boolean {
  try {
    if (Platform.OS === 'web') {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
      return true;
    }
    if (!dentroDeTemporales(uri)) return false;
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
    return true;
  } catch {
    return false;
  }
}

/** Donde guarda `descargarConSesion`: una carpeta propia, para poder vaciarla entera al salir. */
const CARPETA_DE_DESCARGAS = 'atlas-descargas';

/** Carpetas de la cache que solo llenan capturas y copias de esta app. */
const CARPETAS_DE_CAPTURAS = ['Camera', 'ImagePicker', 'ImageManipulator', 'DocumentPicker', CARPETA_DE_DESCARGAS];

/** Lo que el escaner deja suelto: `<uuid>.jpg` (Android, en la cache; iOS, en `tmp/`). */
const SUELTO_DEL_ESCANER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|pdf)$/i;

/**
 * Vacia las copias locales al cerrar sesion (APP-09/APP-10): fotos del carnet, selfies, fotogramas,
 * comprobantes, extractos y descargas. Solo carpetas y archivos que escribe esta app; nada de
 * `Documents/` ni de las preferencias. Nunca lanza.
 */
export function vaciarCopiasLocales(): void {
  if (Platform.OS === 'web') return;
  for (const dir of directoriosTemporales()) {
    let entradas: (Directory | File)[] = [];
    try {
      entradas = new Directory(dir).list();
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      try {
        const nombre = entrada.name;
        const esCarpeta = entrada instanceof Directory;
        if ((esCarpeta && CARPETAS_DE_CAPTURAS.includes(nombre)) || (!esCarpeta && SUELTO_DEL_ESCANER.test(nombre))) entrada.delete();
      } catch {
        /* una entrada que no se deja borrar no impide borrar las demas */
      }
    }
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
  const carpeta = new Directory(Paths.cache, CARPETA_DE_DESCARGAS);
  carpeta.create({ intermediates: true, idempotent: true });
  const destino = new File(carpeta, input.nombre);
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
