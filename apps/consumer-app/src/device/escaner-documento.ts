/**
 * El escaner de documentos DEL SISTEMA para el carnet: VisionKit en iPhone y ML Kit en Android.
 *
 * Es el recuadro azul que sigue al documento, dispara solo y devuelve el carnet ya recortado y con
 * la perspectiva corregida. Lo pinta el sistema, no la app: por eso se ve igual que el escaner de
 * Notas en iPhone y que el de Google en Android.
 *
 * ## Por que una interfaz propia y no la libreria en la pantalla
 *
 * La pantalla de identidad llama a `escanearDocumento()` y no sabe que libreria hay debajo. Si el
 * forense del Motor no se lleva bien con la imagen procesada (plan del 2026-09-26, opcion B), se
 * cambia el motor de captura aqui y la pantalla no se toca.
 *
 * ## Por que la libreria se carga con `require` dentro de la funcion
 *
 * Es el mismo motivo que `avisos-modulo.ts`: un modulo nativo que no viaja dentro de Expo Go no
 * puede importarse arriba del todo. `@dariyd/react-native-document-scanner` resuelve su modulo al
 * evaluarse (`TurboModuleRegistry.get('DocumentScanner')`), y expo-router carga todas las rutas al
 * arrancar: un `import` estatico convertiria un escaner que falta en una app que no abre.
 * `__tests__/escaner-documento.test.ts` lo comprueba sobre el TEXTO del fichero.
 *
 * ## Lo que la libreria NO hace y aqui se suple
 *
 * - **No comprueba `VNDocumentCameraViewController.isSupported`.** En el simulador de iOS lo
 *   presentaria igual, sin camara. Se detecta antes con `Device.isDevice`.
 * - **No protege contra dos llamadas a la vez**: guarda UN callback y la segunda pisa a la primera,
 *   que se quedaria esperando para siempre. Aqui la segunda recibe la promesa de la primera.
 * - **En iOS ignora `pageLimit`**: VisionKit deja escanear varias paginas. Se usa la primera.
 *
 * ## Opciones, y por que cada una
 *
 * Ver `OPCIONES_ESCANER`. Galeria CERRADA: abrirla dejaria subir la foto de una foto del carnet.
 */
import * as Device from 'expo-device';
import { Image, Platform } from 'react-native';

import type { ScanOptions, ScanResult } from '@dariyd/react-native-document-scanner';

import { escanerDocumentoActivado } from '../api/config';
import { esExpoGo } from './entorno';
import type { MotivoSinEscaner, ResultadoEscaneo } from './escaner-documento-tipos';

export type { MotivoSinEscaner, ResultadoEscaneo } from './escaner-documento-tipos';

/**
 * Lo que se le pide al escaner. Se exporta para que las pruebas fijen cada valor.
 *
 * - `scannerMode: 'base'` (Android): recorte y giro, SIN filtros y SIN la «limpieza» de manchas y
 *   dedos del modo `full`, que borraria justo lo que busca el forense del Motor. En iOS no hay
 *   equivalente: VisionKit no deja fijar el filtro.
 * - `pageLimit: 1` (Android): un carnet es una cara por vez.
 * - `galleryImportAllowed: false` (Android): nada de importar de la galeria.
 * - `maxWidth` y `maxHeight` a 2400: la libreria SOLO reduce si vienen los DOS (con uno a 0 no hace
 *   nada, medido en su codigo nativo). Con los dos iguales, el lado largo queda en 2400 px sea el
 *   carnet horizontal o vertical: sobra para el Motor y deja la imagen lejos del tope de 8 MB en
 *   base64 de `POST /mobile/identity-verifications`.
 * - `quality: 0.9`: en iOS, con `quality` 1 la libreria guarda PNG (varios MB para un carnet); por
 *   debajo de 1, JPEG. En Android siempre es JPEG. 0,9 es JPEG en los dos y conserva el detalle.
 * - Sin EXIF, sin ubicacion y sin PDF: nada de eso le sirve al Motor, y `includeLocationExif`
 *   pediria la ubicacion por su cuenta.
 */
export const OPCIONES_ESCANER = {
  scannerMode: 'base',
  pageLimit: 1,
  galleryImportAllowed: false,
  maxWidth: 2400,
  maxHeight: 2400,
  quality: 0.9,
  includeBase64: false,
  includeExif: false,
  includeLocationExif: false,
  includePdf: false,
} as const satisfies ScanOptions;

type ModuloEscaner = typeof import('@dariyd/react-native-document-scanner');

/** `undefined`: todavia no se intento. `null`: aqui no hay escaner. Igual que `avisos-modulo.ts`. */
let modulo: ModuloEscaner | null | undefined;
let enCurso: Promise<ResultadoEscaneo> | null = null;

/** Solo para pruebas: olvida lo ya resuelto. */
export function olvidarEscaner(): void {
  modulo = undefined;
  enCurso = null;
}

function cargarEscaner(): ModuloEscaner | null {
  if (modulo !== undefined) return modulo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cargado = require('@dariyd/react-native-document-scanner') as ModuloEscaner;
    /*
      `default` es el modulo nativo. Si el binario se compilo sin el (una build vieja con el JS
      nuevo por EAS Update), la libreria no lanza: lo deja en `undefined` y `launchScanner` rechaza.
      Se detecta aqui para contestar «sin soporte» y no «error».
    */
    modulo = cargado && typeof cargado.launchScanner === 'function' && cargado.default ? cargado : null;
  } catch {
    modulo = null;
  }
  return modulo;
}

/**
 * La bandera `EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO`.
 *
 * Dice si la app DEBE usar el escaner (y mandar al backend el origen de la captura), no si el
 * escaner EXISTE en este telefono: eso lo contesta `escanearDocumento()` con `no_disponible`.
 */
export function escanerHabilitado(): boolean {
  return escanerDocumentoActivado;
}

/**
 * Abre el escaner del sistema y devuelve el carnet recortado, o por que no se pudo.
 *
 * Nunca lanza: todo lo que falla vuelve como `no_disponible` para que la pantalla caiga a la camara.
 */
export function escanearDocumento(): Promise<ResultadoEscaneo> {
  if (enCurso) return enCurso;
  const actual = escanear().finally(() => {
    if (enCurso === actual) enCurso = null;
  });
  enCurso = actual;
  return actual;
}

async function escanear(): Promise<ResultadoEscaneo> {
  if (esExpoGo) return sinEscaner('expo_go');
  if (Platform.OS === 'web') return sinEscaner('web');
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return sinEscaner('sin_soporte', Platform.OS);
  // `VNDocumentCameraViewController.isSupported` es falso en el simulador, y la libreria no lo mira.
  if (Platform.OS === 'ios' && !Device.isDevice) return sinEscaner('sin_soporte', 'simulador_ios');

  const escaner = cargarEscaner();
  if (!escaner) return sinEscaner('sin_soporte', 'modulo_nativo_ausente');

  let resultado: ScanResult;
  try {
    resultado = await escaner.launchScanner({ ...OPCIONES_ESCANER });
  } catch (error) {
    // La libreria rechaza con la MISMA forma que resuelve (`{ error, errorMessage }`).
    resultado = esResultado(error) ? error : { error: true, errorMessage: mensajeDe(error) };
  }

  if (!resultado || typeof resultado !== 'object') return sinEscaner('error', 'respuesta_vacia');
  if (resultado.didCancel) return { tipo: 'cancelado' };
  if (resultado.error) return clasificarError(resultado.errorMessage);

  const pagina = resultado.images?.[0];
  // Android deja la lista vacia si no pudo leer la pagina que devolvio ML Kit.
  if (!pagina || typeof pagina.uri !== 'string' || pagina.uri.length === 0) {
    return sinEscaner('error', 'sin_imagen');
  }

  const medidas = esMedida(pagina.width) && esMedida(pagina.height)
    ? { ancho: pagina.width, alto: pagina.height }
    : await medir(pagina.uri);
  if (!medidas) return sinEscaner('error', 'sin_dimensiones');

  return { tipo: 'imagen', uri: pagina.uri, ancho: medidas.ancho, alto: medidas.alto, origen: 'escaner_sistema' };
}

/**
 * Traduce el `errorMessage` de la libreria, que es texto libre del sistema.
 *
 * Los patrones de Play Services salen de los mensajes de ML Kit (`MlKitException`, `ApiException`
 * de `ModuleInstall`) y NO se han medido en un Android sin Play Store: si alguno no casa, cae en
 * `error`, que tambien lleva a la camara. Lo unico que cambia es la etiqueta en la bitacora.
 */
export function clasificarError(mensaje: string | undefined): ResultadoEscaneo {
  const texto = mensaje ?? '';
  if (/cancel/i.test(texto)) return { tipo: 'cancelado' };
  if (
    /play.?services|google play|\bgms\b|moduleinstall|module install|download|service_missing|service_version_update|API: .* is not available/i.test(
      texto,
    )
  ) {
    return sinEscaner('sin_play_services', texto || undefined);
  }
  if (/not supported|unsupported|issupported|module is not available/i.test(texto)) {
    return sinEscaner('sin_soporte', texto || undefined);
  }
  return sinEscaner('error', texto || undefined);
}

function sinEscaner(motivo: MotivoSinEscaner, detalle?: string): ResultadoEscaneo {
  return detalle === undefined ? { tipo: 'no_disponible', motivo } : { tipo: 'no_disponible', motivo, detalle };
}

function esMedida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

function medir(uri: string): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolver) => {
    try {
      Image.getSize(
        uri,
        (ancho, alto) => resolver(esMedida(ancho) && esMedida(alto) ? { ancho, alto } : null),
        () => resolver(null),
      );
    } catch {
      resolver(null);
    }
  });
}

function esResultado(valor: unknown): valor is ScanResult {
  return typeof valor === 'object' && valor !== null && ('error' in valor || 'didCancel' in valor || 'images' in valor);
}

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'error_desconocido';
}
