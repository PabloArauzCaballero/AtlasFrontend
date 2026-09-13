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
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as onboardingApi from '../api/endpoints/onboarding';
import { AtlasApiError } from '../api/errors';
import { fetchRepetible } from '../api/reintentos';

export type EvidenceKind = 'identity_front' | 'identity_back' | 'selfie';

/** Los unicos formatos que el backend verifica por firma para una evidencia fotografica. */
export type EvidenceMimeType = 'image/jpeg' | 'image/png';

export type PreparedEvidence = {
  kind: EvidenceKind;
  localUri: string;
  storageKey: string;
  sha256Hash: string;
  sizeBytes: number;
  mimeType: EvidenceMimeType;
};

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

const MAGIC_BYTES: readonly { mimeType: EvidenceMimeType; signature: readonly number[] }[] = [
  { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
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
function detectMimeType(bytes: Uint8Array): EvidenceMimeType | null {
  for (const candidate of MAGIC_BYTES) {
    if (candidate.signature.every((byte, index) => bytes[index] === byte)) return candidate.mimeType;
  }
  return null;
}

/** Sube una foto ya capturada y devuelve lo que el paquete de identidad necesita declarar. */
export async function uploadEvidence(input: {
  customerId: string;
  kind: EvidenceKind;
  localUri: string;
}): Promise<PreparedEvidence> {
  const file = new File(input.localUri);
  const bytes = await file.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
  const sha256Hash = toHex(new Uint8Array(digest));

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

  const ticket = await onboardingApi.createUploadUrl(input.customerId, {
    documentType: input.kind,
    contentType: mimeType,
    sizeBytes: bytes.length,
  });

  // Repetible: el almacén se despliega con el backend y puede no estar unos segundos.
  const response = await fetchRepetible(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.requiredHeaders,
    body: bytes as unknown as BodyInit,
  });

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
  const file = new File(localUri);
  return file.base64();
}
