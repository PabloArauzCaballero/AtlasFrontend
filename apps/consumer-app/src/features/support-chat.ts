/**
 * La conversacion con soporte, del lado de la app.
 *
 * Reune lo que la pantalla no deberia tener que saber: como se sube una foto al chat, cada cuanto
 * se pregunta por lo nuevo y como se mezcla lo que llega con lo que ya estaba en pantalla.
 *
 * ## Por que preguntar y no un socket
 *
 * El backend publica el hilo en vivo por SSE y el portal del comercio lo consume asi. En el telefono
 * no: React Native no trae `EventSource` y el sistema operativo corta cualquier conexion abierta en
 * cuanto la app pasa a segundo plano. Preguntar cada pocos segundos MIENTRAS la pantalla esta
 * abierta da el mismo resultado visible sin una dependencia nativa que sostener.
 *
 * `afterSequence` hace que preguntar sea barato: devuelve solo lo posterior al ultimo mensaje que ya
 * se tiene, no la conversacion entera.
 */
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as supportApi from '../api/endpoints/support';
import { AtlasApiError } from '../api/errors';

/** Cada cuanto se pregunta por lo nuevo con la pantalla abierta. */
export const CHAT_POLL_MS = 4000;

/** Los formatos que el chat acepta. El backend comprueba la firma real, no la extension. */
type ChatMimeType = 'image/jpeg' | 'image/png';

const MAGIC_BYTES: readonly { mimeType: ChatMimeType; signature: readonly number[] }[] = [
  { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function detectMimeType(bytes: Uint8Array): ChatMimeType | null {
  for (const candidate of MAGIC_BYTES) {
    if (candidate.signature.every((byte, index) => bytes[index] === byte)) return candidate.mimeType;
  }
  return null;
}

/**
 * Sube una foto al chat y devuelve lo que hay que declarar al enviar el mensaje.
 *
 * El hash se calcula sobre los BYTES, no sobre el base64: el servidor recalcula el SHA-256 del
 * objeto y compara, asi que hashear la representacion en texto haria que rechazara todas las fotos.
 * El tipo se deduce de la firma binaria y no de la extension, porque la extension es un nombre y la
 * firma es el archivo.
 */
export async function subirFotoAlChat(input: { channelId: string; localUri: string; filename?: string }) {
  const file = new File(input.localUri);
  const bytes = await file.bytes();

  const mimeType = detectMimeType(bytes);
  if (!mimeType) {
    throw new AtlasApiError({
      kind: 'validation',
      code: 'SUPPORT_ATTACHMENT_FORMAT_UNSUPPORTED',
      message: 'No pudimos leer la imagen. Vuelve a intentarlo con otra foto.',
      status: 422,
    });
  }

  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
  const sha256 = toHex(new Uint8Array(digest));

  const ticket = await supportApi.attachmentTicket(input.channelId, { contentType: mimeType, sizeBytes: bytes.length });
  const response = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.requiredHeaders,
    body: bytes as unknown as BodyInit,
  });

  if (!response.ok) {
    throw new AtlasApiError({
      kind: response.status === 403 ? 'validation' : 'server',
      code: response.status === 403 ? 'UPLOAD_URL_EXPIRED' : 'UPLOAD_FAILED',
      message: `El almacenamiento respondio HTTP ${response.status}.`,
      status: response.status,
    });
  }

  return {
    storageObjectKey: ticket.storageKey,
    filename: input.filename ?? 'foto.jpg',
    declaredMime: mimeType,
    sizeBytes: bytes.length,
    sha256,
  } satisfies supportApi.OutgoingAttachment;
}

/**
 * Mezcla lo que acaba de llegar con lo que ya estaba, sin duplicar ni desordenar.
 *
 * Se indexa por `sequence` y no por posicion: el mensaje que uno mismo acaba de enviar ya esta en
 * pantalla cuando la siguiente consulta lo devuelve, y sin esta deduplicacion aparecería dos veces.
 * Ordenar por secuencia —y no por fecha— evita ademas que dos mensajes del mismo segundo se
 * intercambien de sitio entre una consulta y otra.
 */
export function mezclarMensajes(
  actuales: readonly supportApi.SupportMessage[],
  llegados: readonly supportApi.SupportMessage[],
): supportApi.SupportMessage[] {
  const porSecuencia = new Map<string, supportApi.SupportMessage>();
  for (const mensaje of [...actuales, ...llegados]) porSecuencia.set(mensaje.sequence, mensaje);
  return [...porSecuencia.values()].sort((a, b) => Number(a.sequence) - Number(b.sequence));
}

/** La ultima secuencia recibida. Es lo que se le pasa a `afterSequence` en la siguiente consulta. */
export function ultimaSecuencia(mensajes: readonly supportApi.SupportMessage[]): string | undefined {
  const ultima = mensajes.reduce((mayor, mensaje) => Math.max(mayor, Number(mensaje.sequence)), 0);
  return ultima > 0 ? String(ultima) : undefined;
}

/**
 * Si el agente ya leyo hasta este mensaje.
 *
 * Es el doble tic. Solo tiene sentido sobre lo que uno mando: preguntarselo de un mensaje del agente
 * responderia si el agente se leyo a si mismo.
 */
export function fueLeido(mensaje: supportApi.SupportMessage, readState: readonly supportApi.ReadState[]): boolean {
  if (mensaje.senderActorType !== 'CUSTOMER') return false;
  return readState.some((estado) => Number(estado.lastReadSequence) >= Number(mensaje.sequence));
}
