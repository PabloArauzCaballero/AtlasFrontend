/**
 * Las dos señales que el telefono entrega con permiso explicito: la AGENDA y la UBICACION.
 *
 * Espeja `AtlasBackend/src/modules/customer-device-signals`.
 *
 * ## En que se diferencia de `onboarding.submitContactsSnapshot`
 *
 * Aquel manda cuentas y hashes de un solo uso que el servidor cruza y descarta; este manda la FICHA
 * de cada contacto para que el servidor la guarde cifrada. Los dos siguen existiendo: el resumen
 * viaja siempre, y la sincronizacion completa solo cuando hay consentimiento vigente para la
 * finalidad `device_address_book`. Sin el, el servidor contesta 422 `CONSENT_NOT_GRANTED` — y eso es
 * el sistema funcionando, no un error que haya que arreglar en el cliente.
 *
 * ## Ninguno de los dos devuelve analisis
 *
 * Quien sube estos datos es el telefono de la persona analizada. Devolverle cuantos de sus contactos
 * coinciden con otros expedientes, o a que distancia esta de su domicilio declarado, le enseña
 * exactamente que mover para que la proxima medida salga mejor.
 */
import { request } from '../client';
import type { ContactoParaEnviar, PosicionParaEnviar } from '../../features/rastreo';

export type SincronizacionDeAgenda = {
  deviceId: string;
  sessionId?: string | null;
  algorithmVersion: string;
  capturedAt: string;
  /** Solo el ULTIMO lote lo lleva en cierto: es lo que marca la ejecucion como completa. */
  isFinalBatch: boolean;
  /** Cuantos contactos tiene la agenda ENTERA, no este lote. */
  totalContactsInDevice: number;
  /**
   * Si el sistema dejo ver la agenda entera o solo los contactos elegidos (iOS 18+).
   *
   * Sin esto, una agenda «de 6 contactos» seria indistinguible de una persona con 6 contactos, y el
   * motor leeria como señal sobre la persona lo que es una decision sobre el permiso.
   */
  accessScope: 'all' | 'limited';
  contacts: ContactoParaEnviar[];
};

export const sincronizarAgenda = (customerId: string, body: SincronizacionDeAgenda) =>
  request<{
    customerId: string;
    computationRunId: string;
    received: number;
    created: number;
    updated: number;
    totalStored: number;
    receivedAt: string;
  }>(`/customers/${customerId}/address-book`, { method: 'POST', body, sinPantalla: true });

/**
 * Borra la agenda guardada en el servidor.
 *
 * Es lo que promete el texto del consentimiento al retirarlo, y el borrado es FISICO: no queda una
 * fila marcada como borrada con el nombre y el telefono de cada contacto dentro.
 */
export const borrarAgenda = (customerId: string) =>
  request<{ customerId: string; deleted: number; purgedAt: string }>(`/customers/${customerId}/address-book`, {
    method: 'DELETE',
  });

export type LoteDePosiciones = {
  deviceId: string;
  sessionId?: string | null;
  pings: PosicionParaEnviar[];
};

/**
 * Manda un lote de posiciones.
 *
 * Sin `idempotent`: el servidor ya identifica cada posicion por `(cliente, capturedAt, modo)` y
 * descarta las repetidas con `ON CONFLICT DO NOTHING`. Una clave de idempotencia por peticion
 * ademas de eso no añadiria nada y solo taparia el caso que interesa ver — un lote reenviado entero,
 * que el servidor contesta con `duplicated`.
 */
export const enviarPosiciones = (customerId: string, body: LoteDePosiciones) =>
  request<{ customerId: string; received: number; stored: number; duplicated: number; receivedAt: string }>(
    `/customers/${customerId}/location-pings`,
    // La manda la tarea de ubicacion o el temporizador de primer plano, no una pantalla.
    { method: 'POST', body, sinPantalla: true },
  );
