/**
 * Los derechos del titular: que consiente y que pide sobre sus datos.
 *
 * ## El agujero que cierra
 *
 * Los consentimientos se aceptaban UNA vez, en el alta, y ahi se quedaban: la app no tenia pantalla
 * para revisarlos ni para retirar uno. Y los derechos ARCO/GDPR —acceso, rectificacion, borrado,
 * portabilidad, revocacion, limitacion— existian en el backend sin que nadie pudiera ejercerlos
 * desde el telefono, que es donde esta la persona.
 *
 * Un consentimiento que solo se puede dar y nunca retirar no es un consentimiento: es una casilla.
 *
 * ## Retirar no borra lo ya hecho
 *
 * Revocar corta el tratamiento a partir de ahi. Lo que ya se decidio con ese dato sigue en pie y con
 * su evidencia, porque una decision de credito tiene que poder explicarse despues. Para pedir el
 * borrado esta la solicitud de derechos, que es otro tramite y tiene otros plazos.
 */
import { request, type RequestOptions } from '../client';

export type ConsentDecision = 'granted' | 'declined' | 'revoked';

export type ConsentDecisionInput = {
  consentDocumentId: string;
  purposeCode: string;
  decision: ConsentDecision;
  decidedAt?: string;
};

/** Se mandan en lote: cambiar tres casillas es UNA decision de la persona, no tres. */
export const registrarDecisiones = (
  customerId: string,
  decisions: ConsentDecisionInput[],
  origen: Pick<RequestOptions, 'sinPantalla'> = {},
) =>
  request<Record<string, unknown>>(`/customers/${customerId}/privacy/consent-decisions`, {
    method: 'POST',
    idempotent: true,
    body: { decisions },
    ...origen,
  });

/**
 * Lo que Atlas OFRECE como solicitud: corregir un dato y borrar la cuenta. Llevarse los datos, limitar el
 * uso y retirar consentimientos no se ofrecen (decisión de producto, 2026-10-02) y «ver mis datos» es una
 * pantalla —siempre disponible, tras volver a pedir el PIN—, no una solicitud.
 */
export type DataSubjectRequestType = 'rectification' | 'deletion';

export const solicitarDerecho = (
  customerId: string,
  requestType: DataSubjectRequestType,
  description?: string,
) =>
  request<Record<string, unknown>>(`/customers/${customerId}/privacy/data-subject-requests`, {
    method: 'POST',
    idempotent: true,
    body: { requestType, ...(description ? { description } : {}) },
  });
