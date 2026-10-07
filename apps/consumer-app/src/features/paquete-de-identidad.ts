/**
 * Los dos cuerpos que salen del paso del carnet, armados fuera de la pantalla.
 *
 * Viven aqui y no en `identidad.tsx` para poder probar lo unico que no puede cambiar sin avisar: que
 * con la bandera del escaner apagada el cuerpo sea exactamente el de siempre (mismos campos, mismo
 * orden), y que con ella encendida lleve el origen de cada captura. Ver `origen-de-captura.ts`.
 */
import { escanerDocumentoActivado } from '../api/config';
import type { IdentityEvidence } from '../api/endpoints/onboarding';
import type { StartIdentityVerificationInput } from '../api/endpoints/identity-engine';
import type { IdentityEvidenceKind, PreparedEvidence } from './evidence-upload';
import { campoCaptureSource, campoDocumentCaptureSource } from './origen-de-captura';

type Capturas = Partial<Record<IdentityEvidenceKind, PreparedEvidence>>;

/** Las evidencias del paquete de identidad, en el orden de los pasos. Todas tienen que existir. */
export function evidenciasDelPaquete(
  orden: readonly IdentityEvidenceKind[],
  capturas: Capturas,
  activado: boolean = escanerDocumentoActivado,
): IdentityEvidence[] {
  return orden.map((kind) => {
    const prepared = capturas[kind];
    if (!prepared) throw new Error(`Falta la captura ${kind}.`);
    return {
      evidenceType: kind,
      storageKey: prepared.storageKey,
      // Las capturas del carnet son siempre fotos; el tipo ancho es de las evidencias de apoyo.
      mimeType: prepared.mimeType as IdentityEvidence['mimeType'],
      sha256Hash: prepared.sha256Hash,
      fileSizeBytes: String(prepared.sizeBytes),
      ...campoCaptureSource(prepared.captureSource, activado),
    };
  });
}

/** El cuerpo de `POST /mobile/identity-verifications`, con las imagenes ya en base64. */
export function cuerpoDeVerificacion(
  imagenes: { documentFront: string; documentBack: string; selfie: string },
  customerId: string,
  capturas: Capturas,
  activado: boolean = escanerDocumentoActivado,
): StartIdentityVerificationInput {
  return {
    documentFront: imagenes.documentFront,
    documentBack: imagenes.documentBack,
    selfie: imagenes.selfie,
    customerId,
    ...campoDocumentCaptureSource(capturas.identity_front?.captureSource, capturas.identity_back?.captureSource, activado),
  };
}
