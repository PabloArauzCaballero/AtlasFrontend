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

export type EvidenceKind = 'identity_front' | 'identity_back' | 'selfie';

export type PreparedEvidence = {
  kind: EvidenceKind;
  localUri: string;
  storageKey: string;
  sha256Hash: string;
  sizeBytes: number;
  mimeType: 'image/jpeg';
};

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
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

  const ticket = await onboardingApi.createUploadUrl(input.customerId, {
    documentType: input.kind,
    contentType: 'image/jpeg',
    sizeBytes: bytes.length,
  });

  const response = await fetch(ticket.uploadUrl, {
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
    mimeType: 'image/jpeg',
  };
}
