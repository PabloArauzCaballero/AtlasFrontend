/**
 * El comprobante de un pago, del teléfono al almacén.
 *
 * Un solo camino para las tres pantallas que lo suben (la cuota, el pago inicial y el aviso desde
 * la compra). Cada una leía el archivo con `fetch(file://).blob()` y declaraba `image/jpeg` a
 * ciegas; eran las únicas subidas de la app que no pasaban por `leerBytes`, y las únicas que el
 * almacén rechazaba en el iPhone con 403: la firma cubre el tipo y el tamaño declarados, y el
 * `fetch` de Expo cambia el `Content-Type` por el del blob (ver `uploadProof`).
 *
 * Aquí se leen los bytes UNA vez, el tipo sale de su firma binaria —una captura de pantalla del
 * banco es PNG, no JPEG— y con ese tipo y ese tamaño exactos se pide el ticket y se sube.
 */
import { requestProofTicket, uploadProof } from '../api/endpoints/payment-claims';
import { leerBytes } from '../device/archivos';
import { detectMimeType } from './evidence-upload';

export type ComprobanteSubido = { storageKey: string; contentType: 'image/jpeg' | 'image/png' };

export async function subirComprobante(customerId: string, uri: string): Promise<ComprobanteSubido> {
  const bytes = await leerBytes(uri);
  const contentType = detectMimeType(bytes);
  if (contentType !== 'image/jpeg' && contentType !== 'image/png') {
    // Con la imagen todavía en la mano: después de subirla sólo quedaría un rechazo del servidor.
    throw new Error('No pudimos leer esa imagen. Elige una foto o una captura de pantalla del comprobante.');
  }
  const ticket = await requestProofTicket(customerId, { contentType, sizeBytes: bytes.length });
  await uploadProof(ticket, bytes);
  return { storageKey: ticket.storageKey, contentType };
}
