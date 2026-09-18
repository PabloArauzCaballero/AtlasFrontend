/**
 * Verificacion de identidad por el MOTOR DE DECISION.
 *
 * ## Por que existe, si ya se sube el carnet
 *
 * Son dos cosas distintas y las dos hacen falta:
 *
 * - `POST /customer-onboarding/:id/identity-package` guarda la EVIDENCIA en el expediente —las
 *   fotos, el hash, el numero— y deja el documento en revision. Es el registro.
 * - `POST /mobile/identity-verifications` hace la PREGUNTA: ¿es esta persona quien dice ser? La
 *   contesta un artefacto del motor (`IDENTIDAD_CARNET_MOVIL`) con su version, su aprobacion y su
 *   traza, y devuelve `VERIFIED`, `REJECTED` o `IN_REVIEW`.
 *
 * Hasta ahora la app solo hacia la primera, asi que el carnet quedaba esperando a que un operador
 * lo mirase aunque la politica automatica existiera y estuviera desplegada. Lo que decide no es
 * este codigo: es un artefacto que se puede cambiar sin tocar la app, y ahi esta el sentido.
 *
 * ## Por que las fotos van en base64 y no por su clave de almacenamiento
 *
 * Porque el motor **no guarda ninguna imagen**: las recibe, decide y solo conserva el veredicto y
 * sus puntajes. Pasarle una referencia al bucket le obligaria a leer de el —y a tener permiso— para
 * acabar guardando lo mismo. Un carnet almacenado «por si acaso» en dos sitios es exactamente el
 * dato que una fuga convierte en suplantacion.
 *
 * ## Por que se pregunta en bucle
 *
 * Verificar de verdad tarda segundos, y un caso derivado a una persona tarda horas. El endpoint
 * responde `202` con un identificador y el estado se consulta despues; ver el porque en
 * `mobile-identity.service.ts` del backend.
 */
import { request } from '../client';

export type IdentityVerificationState = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'IN_REVIEW' | 'UNAVAILABLE';

/** Un campo leido del carnet, con su procedencia. `MODEL` nunca llega: el servidor lo filtra. */
export type CampoLeido = { value: string; confidence: number | null; source: string };

export type LecturaDelDocumento = Partial<
  Record<'documentNumber' | 'firstNames' | 'lastNames' | 'dateOfBirth' | 'expirationDate' | 'documentComplement', CampoLeido>
>;

export type IdentityVerificationView = {
  /** Lo leido del documento para prellenar, o `null` si no hubo lectura utilizable. */
  extracted?: LecturaDelDocumento | null;
  verificationId: string;
  status: IdentityVerificationState;
  reason: string | null;
  similarity: number | null;
  requestedAt: string | null;
  completedAt: string | null;
};

export type StartIdentityVerificationInput = {
  documentFront: string;
  documentBack?: string;
  selfie: string;
  customerId?: string;
};

export const startIdentityVerification = (body: StartIdentityVerificationInput) =>
  request<IdentityVerificationView>('/mobile/identity-verifications', { method: 'POST', idempotent: true, body });

export const getIdentityVerification = (verificationId: string) =>
  request<IdentityVerificationView>(`/mobile/identity-verifications/${verificationId}`);

/** Estados en los que el tramite ya termino y no tiene sentido volver a preguntar. */
export function esFinal(estado: IdentityVerificationState): boolean {
  return estado !== 'PENDING';
}
