/**
 * Las evidencias de apoyo de la fase 3: elegir un archivo, subirlo y registrarlo.
 *
 * Son las tres cosas que la competencia hacia bien y que valia copiar: el QR de cobro SIN monto
 * como prueba de acceso bancario, la factura o preaviso de un servicio como prueba de domicilio, y
 * un audio corto contando a que se dedica la persona. Ninguna decide sola; las tres van a revision
 * humana. Con el QR no se cobra ni se deposita nada: lo dice la pantalla y lo cumple el servidor.
 *
 * El camino es el mismo que el del carnet (`evidence-upload.ts`): URL firmada, PUT directo al
 * almacen, y despues `POST supporting-evidence` con la clave y el SHA-256. Lo unico distinto es de
 * donde sale el archivo: de la galeria o de los documentos, no de la camara.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as onboardingApi from '../api/endpoints/onboarding';
import { uploadEvidence, type EvidenceKind } from './evidence-upload';
import { bitacora } from './bitacora';

export type EvidenciaDeApoyo = { evidenceId: string; kind: EvidenceKind; localUri: string };

/** Abre la galeria y devuelve el URI elegido, o `null` si la persona cancelo. */
export async function elegirImagen(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;
  const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: false });
  if (resultado.canceled) return null;
  return resultado.assets[0]?.uri ?? null;
}

/** Abre los documentos (PDF o imagen) y devuelve el URI elegido, o `null` si cancelo. */
export async function elegirDocumento(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false });
  if (resultado.canceled) return null;
  return resultado.assets[0]?.uri ?? null;
}

/** Sube y registra. La bitacora anota el envio como cualquier otro. */
export async function subirEvidenciaDeApoyo(input: {
  customerId: string;
  kind: 'bank_qr_proof' | 'proof_of_address' | 'occupation_audio';
  localUri: string;
  note?: string;
}): Promise<EvidenciaDeApoyo> {
  const preparada = await uploadEvidence({ customerId: input.customerId, kind: input.kind, localUri: input.localUri });
  const registro = await bitacora.medirEnvio(() =>
    onboardingApi.registerSupportingEvidence(input.customerId, {
      evidenceType: input.kind,
      storageKey: preparada.storageKey,
      mimeType: preparada.mimeType,
      sha256Hash: preparada.sha256Hash,
      fileSizeBytes: String(preparada.sizeBytes),
      note: input.note,
    }),
  );
  return { evidenceId: registro.evidenceId, kind: input.kind, localUri: input.localUri };
}
