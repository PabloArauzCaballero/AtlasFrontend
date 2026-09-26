/**
 * Subida de evidencia documental.
 *
 * El flujo real del backend, en tres tiempos:
 *   1. `POST documents/upload-url` -> el servidor decide la ruta y firma una URL temporal;
 *   2. `PUT` directo al almacenamiento con las cabeceras exactas que devolvio;
 *   3. `POST identity-package` con la clave y el SHA-256 de lo subido.
 *
 * El hash se calcula sobre los BYTES del archivo, no sobre su base64: si se hashea la
 * representacion en texto, el valor no coincide con el que calcula cualquier otra herramienta y
 * deja de servir como control de integridad.
 */
import { sha256Hex } from '../lib/criptografia';
import { leerArchivoEnBase64, leerBytes } from '../device/archivos';
import * as onboardingApi from '../api/endpoints/onboarding';
import { AtlasApiError } from '../api/errors';
import { fetchAlAlmacen } from '../api/almacen';
import { PRESUPUESTO_REINTENTOS_MS } from '../api/reintentos';
import { campoCaptureSource, type OrigenCaptura } from './origen-de-captura';

/** Las tres capturas del paquete de identidad. */
export type IdentityEvidenceKind = 'identity_front' | 'identity_back' | 'selfie';

export type EvidenceKind = IdentityEvidenceKind | 'bank_qr_proof' | 'proof_of_address' | 'occupation_audio';

/** Los formatos que el backend verifica por firma: fotos, PDF (factura) y m4a (audio de ocupacion). */
export type EvidenceMimeType = 'image/jpeg' | 'image/png' | 'application/pdf' | 'audio/mp4';

export type PreparedEvidence = {
  kind: EvidenceKind;
  localUri: string;
  storageKey: string;
  sha256Hash: string;
  sizeBytes: number;
  mimeType: EvidenceMimeType;
  /** De donde salio la captura; solo en las del carnet y la selfie. Ver `origen-de-captura.ts`. */
  captureSource?: OrigenCaptura;
};

const MAGIC_BYTES: readonly { mimeType: EvidenceMimeType; signature: readonly number[]; offset?: number }[] = [
  { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
  // M4A/MP4: los 4 primeros bytes son el tamaño de la caja; «ftyp» va en 4..7. Misma regla que el servidor.
  { mimeType: 'audio/mp4', signature: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

/**
 * Deduce el tipo real de la foto por su firma binaria.
 *
 * El formato lo elige la camara, no nosotros: `takePictureAsync` devuelve JPEG en la mayoria de
 * dispositivos, pero con `skipProcessing` hay camaras —el emulador de Android entre ellas— que
 * entregan PNG. Declarar `image/jpeg` a ciegas hacia que el backend comparara la firma contra lo
 * declarado, encontrara un PNG y devolviera 422 `EVIDENCE_CONTENT_TYPE_MISMATCH`: el registro se
 * quedaba clavado en el paso del carnet sin que el cliente pudiera hacer nada al respecto.
 *
 * Se lee la firma en vez de fiarse de la extension del URI porque la extension es un nombre y la
 * firma es el archivo.
 */
export function detectMimeType(bytes: Uint8Array): EvidenceMimeType | null {
  for (const candidate of MAGIC_BYTES) {
    const desde = candidate.offset ?? 0;
    if (candidate.signature.every((byte, index) => bytes[desde + index] === byte)) return candidate.mimeType;
  }
  return null;
}

/** La subida mala que se da por buena al calcular el plazo: ~0,8 Mbit/s. */
const BYTES_POR_SEGUNDO_MINIMO = 100 * 1024;

/**
 * Cuanto se le deja a una subida antes de darla por perdida.
 *
 * ## El numero
 *
 * `PRESUPUESTO_REINTENTOS_MS` (45 s) fijos mas el tiempo de mandar los bytes a 100 KB/s:
 *
 * - Los 45 s fijos son el presupuesto de reintentos que ya existe para cruzar el hueco de un
 *   despliegue (el almacen se recrea con el backend, ~35 s medidos). Cortar antes convertiria cada
 *   despliegue en un «no se pudo subir».
 * - 100 KB/s (~0,8 Mbit/s) es una subida mala de verdad —3G, o 4G con una raya—, no la media. Con
 *   ella, la foto tipica de la camara o del escaner (1-3 MB) tiene ~55-75 s, y el maximo que acepta
 *   el backend (15 MB) ~3 min 15 s.
 *
 * ## Por que tan largo no es una trampa
 *
 * Porque la persona no tiene que esperarlo: la pantalla dice que la foto se esta subiendo, avisa
 * cuando tarda mas de lo normal y deja cancelar desde el primer segundo. El plazo solo decide cuando
 * se rinde la APP sola; hoy no se rendia nunca de forma limpia (el boton giraba ~60 s y acababa en
 * «Sin conexion», sin salida). Al vencer, la foto sigue en el telefono y se puede reintentar sin
 * repetirla.
 */
export function plazoDeSubidaMs(bytes: number): number {
  return PRESUPUESTO_REINTENTOS_MS + Math.ceil(Math.max(0, bytes) / BYTES_POR_SEGUNDO_MINIMO) * 1000;
}

/** Codigos de los dos finales de una subida que no son un fallo del servidor. */
export const SUBIDA_VENCIDA = 'UPLOAD_TIMEOUT';
export const SUBIDA_CANCELADA = 'UPLOAD_CANCELLED';

export function esSubidaCancelada(error: unknown): boolean {
  return error instanceof AtlasApiError && error.code === SUBIDA_CANCELADA;
}

/** Sube una foto ya capturada y devuelve lo que el paquete de identidad necesita declarar. */
export async function uploadEvidence(input: {
  customerId: string;
  kind: EvidenceKind;
  localUri: string;
  /**
   * De donde salio la captura. Solo viaja con la bandera del escaner encendida (ver
   * `origen-de-captura.ts`); se guarda igual en lo devuelto para que el paquete lo repita.
   */
  captureSource?: OrigenCaptura;
  /** Para que la pantalla pueda cancelar la subida. */
  signal?: AbortSignal;
  /**
   * El plazo en funcion del tamaño, o nada para no poner ninguno (lo de siempre). Ver
   * `plazoDeSubidaMs`.
   */
  plazo?: (bytes: number) => number;
}): Promise<PreparedEvidence> {
  const bytes = await leerBytes(input.localUri);
  const sha256Hash = await sha256Hex(bytes);

  const mimeType = detectMimeType(bytes);
  if (!mimeType) {
    // Preferimos fallar aqui, con la foto todavia en la mano, a subir un objeto y que el backend lo
    // rechace despues: el mensaje util es "repite la foto", y solo se puede dar antes de subirla.
    throw new AtlasApiError({
      kind: 'validation',
      code: 'EVIDENCE_FORMAT_UNSUPPORTED',
      message: 'No pudimos leer la foto. Vuelve a tomarla.',
      status: 422,
    });
  }

  const control = senalConPlazo(input.signal, input.plazo?.(bytes.length));
  try {
    if (input.signal?.aborted) throw cancelada();

    const ticket = await onboardingApi.createUploadUrl(
      input.customerId,
      {
        documentType: input.kind,
        contentType: mimeType,
        sizeBytes: bytes.length,
        ...campoCaptureSource(input.captureSource),
      },
      control.signal ? { signal: control.signal } : {},
    );

    // Repetible: el almacén se despliega con el backend y puede no estar unos segundos.
    const response = await fetchAlAlmacen(
      ticket.uploadUrl,
      {
        method: ticket.method,
        headers: ticket.requiredHeaders,
        body: bytes as unknown as BodyInit,
      },
      control.signal,
    );

    if (!response.ok) {
      // La URL firmada vence: distinguir "expiro" de "fallo la red" cambia lo que hay que hacer.
      throw new AtlasApiError({
        kind: response.status === 403 ? 'validation' : 'server',
        code: response.status === 403 ? 'UPLOAD_URL_EXPIRED' : 'UPLOAD_FAILED',
        message: `El almacenamiento respondio HTTP ${response.status}.`,
        status: response.status,
      });
    }

    return {
      kind: input.kind,
      localUri: input.localUri,
      storageKey: ticket.storageKey,
      sha256Hash,
      sizeBytes: bytes.length,
      mimeType,
      ...(input.captureSource ? { captureSource: input.captureSource } : {}),
    };
  } catch (error) {
    // Lo que corto la subida decide el mensaje: la persona que cancelo no tiene que ver un error, y
    // la que espero el plazo entero necesita saber que su foto sigue aqui.
    if (input.signal?.aborted) throw cancelada();
    if (control.vencida()) {
      throw new AtlasApiError({
        kind: 'timeout',
        code: SUBIDA_VENCIDA,
        message: 'La foto no terminó de subirse a tiempo.',
      });
    }
    throw error;
  } finally {
    control.soltar();
  }
}

function cancelada(): AtlasApiError {
  return new AtlasApiError({ kind: 'timeout', code: SUBIDA_CANCELADA, message: 'La subida se canceló.' });
}

/**
 * Una señal que se dispara si la pantalla cancela O si vence el plazo, y que sabe cual de las dos.
 * Sin plazo y sin señal de fuera no crea nada: la subida va exactamente como antes.
 */
function senalConPlazo(
  deFuera: AbortSignal | undefined,
  plazoMs: number | undefined,
): { signal: AbortSignal | undefined; vencida: () => boolean; soltar: () => void } {
  if (plazoMs === undefined) return { signal: deFuera, vencida: () => false, soltar: () => {} };
  const controlador = new AbortController();
  let vencio = false;
  const temporizador = setTimeout(() => {
    vencio = true;
    controlador.abort();
  }, plazoMs);
  const alCancelar = () => controlador.abort();
  if (deFuera?.aborted) controlador.abort();
  else deFuera?.addEventListener('abort', alCancelar, { once: true });
  return {
    signal: controlador.signal,
    vencida: () => vencio,
    soltar: () => {
      clearTimeout(temporizador);
      deFuera?.removeEventListener('abort', alCancelar);
    },
  };
}

/**
 * El contenido de una foto en base64, para lo que no se sube a ningun sitio.
 *
 * Lo usa la verificacion por el motor: alli las imagenes viajan en el cuerpo de la peticion y no se
 * guardan en ninguna parte, asi que no hay clave de almacenamiento que pasar —hay que mandar la
 * imagen—. Sin cabecera `data:`: el backend valida que sea base64 puro y una cadena con prefijo se
 * lee como imagen corrupta.
 */
export async function leerBase64(localUri: string): Promise<string> {
  return leerArchivoEnBase64(localUri);
}
