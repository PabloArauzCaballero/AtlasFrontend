/**
 * Soporte: buscar una respuesta, abrir un caso y hablar con una persona.
 *
 * ## Por que el chat pregunta por lo NUEVO y no se baja la conversacion entera
 *
 * `afterSequence` devuelve solo lo que llego despues del ultimo mensaje que esta pantalla ya tiene.
 * Con una conexion mala —que es la normal— volver a descargar treinta mensajes cada tres segundos
 * gasta datos de la persona para reenseñarle lo que ya estaba mirando.
 *
 * ## Por que aqui NO hay SSE
 *
 * React Native no trae `EventSource`, y el `fetch` de Hermes no expone el cuerpo como stream. El
 * backend publica el hilo en vivo por SSE —el ERP lo consume asi— y la app pregunta cada pocos
 * segundos mientras la pantalla esta abierta. El resultado que ve la persona es el mismo; lo que
 * cambia es que no hace falta meter una dependencia nativa para sostener un socket que el sistema
 * operativo va a matar en cuanto la app pase a segundo plano.
 *
 * ## El comprobante viaja DIRECTO al almacen
 *
 * Igual que en el aviso de pago: se pide un permiso de subida, el archivo sube solo y despues se
 * manda el mensaje con su clave. La imagen no pasa por la API, y por eso un reintento no la vuelve
 * a subir entera.
 */
import { readAccessToken, request, newCorrelationId } from '../client';
import { apiConfig } from '../config';

export type FaqArticle = {
  articleId: string;
  articleKey: string;
  title: string;
  question: string | null;
  shortAnswer: string | null;
  body: string;
  escalateWhen: string | null;
};

export type KnowledgeHit = {
  articleId: string;
  articleKey: string;
  title: string;
  question: string | null;
  shortAnswer: string | null;
};

export type SupportCase = {
  caseId: string;
  caseNumber: string;
  title: string;
  caseType: string;
  domain: string;
  /** Ya viene traducido por el servidor: «Estamos trabajando», no `IN_PROGRESS`. */
  status: string;
  summary: string | null;
  openedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  reopenedCount: number;
  channelId?: string;
  channels?: { channelId: string; status: string; type: string }[];
};

export type SupportAttachment = {
  attachmentId: string;
  filename: string;
  mime: string | null;
  sizeBytes: number;
  scanStatus: string;
};

export type SupportMessage = {
  messageId: string;
  sequence: string;
  clientMessageId: string;
  senderActorType: 'CUSTOMER' | 'PARTNER_USER' | 'AGENT' | 'SUPERVISOR' | 'SYSTEM';
  messageType: string;
  visibility: string;
  body: string | null;
  redacted: boolean;
  redactionReason: string | null;
  createdAt: string;
  attachments: SupportAttachment[];
};

/** Hasta donde leyo la OTRA parte: es el doble tic de lo que uno mando. */
export type ReadState = {
  actorType: string;
  roleInChannel: string;
  lastReadSequence: string;
  lastReadAt: string | null;
};

export type Transcript = {
  messages: SupportMessage[];
  readState: ReadState[];
  nextCursor: string | null;
};

export type OpenCaseInput = {
  categoryCode: string;
  title: string;
  description: string;
  references?: { entityType: string; entityId: string; relationType?: string }[];
  originContext?: Record<string, string>;
  acknowledgeDuplicate?: boolean;
};

export function getFaq(): Promise<{ faq: FaqArticle[] }> {
  return request('/mobile/support/faq');
}

export function searchKnowledge(query: string): Promise<{ query: string; results: KnowledgeHit[] }> {
  return request(`/mobile/support/knowledge/search?q=${encodeURIComponent(query)}`);
}

export function rateArticle(articleId: string, helpful: boolean, searchQuery?: string) {
  return request(`/mobile/support/knowledge/articles/${articleId}/feedback`, {
    method: 'POST',
    body: { helpful, searchQuery, avoidedCase: helpful },
  });
}

export function listCases(): Promise<{ cases: SupportCase[] }> {
  return request('/mobile/support/cases');
}

export function getCase(caseId: string): Promise<SupportCase> {
  return request(`/mobile/support/cases/${caseId}`);
}

export function openCase(input: OpenCaseInput): Promise<SupportCase> {
  return request('/mobile/support/cases', { method: 'POST', body: input, idempotent: true });
}

export function requestClose(caseId: string, reason: string) {
  return request(`/mobile/support/cases/${caseId}/close-request`, { method: 'POST', body: { reason } });
}

export function reopenCase(caseId: string, reason: string) {
  return request(`/mobile/support/cases/${caseId}/reopen`, { method: 'POST', body: { reason } });
}

export function rateCase(caseId: string, csatScore: number, comment?: string) {
  return request(`/mobile/support/cases/${caseId}/feedback`, { method: 'POST', body: { csatScore, comment } });
}

/**
 * Un motivo del catalogo, tal y como lo ve quien va a pedir ayuda.
 *
 * NO trae cola, sensibilidad, impacto ni urgencia: esos cuatro campos son la politica interna de
 * atencion, y publicarlos ensenaria que motivo elegir para caer en la cola especializada o para
 * nacer con prioridad alta. Quien abre un caso describe su problema; la consecuencia la decide el
 * servidor.
 */
export type SupportCategory = {
  categoryCode: string;
  label: string;
  description: string | null;
  requiresSpecialist: boolean;
  subcategories?: SupportCategory[];
};

/**
 * Los motivos por los que esta persona puede abrir un caso.
 *
 * Las audiencias las deriva el servidor del token: si viajaran como parametro, pedir el catalogo
 * del comercio seria tan facil como cambiar una cadena en la URL.
 */
export function listCategories(): Promise<{ categories: SupportCategory[] }> {
  return request('/mobile/support/categories');
}

/** Abre —o recupera— la conversacion viva. Pedirla dos veces no crea dos chats. */
export function openChannel(input: { categoryCode?: string; caseId?: string } = {}): Promise<{
  channelId: string;
  status: string;
  reused: boolean;
  agentsAvailable: number | null;
}> {
  return request('/support/channels', { method: 'POST', body: input });
}

export function readTranscript(channelId: string, options: { afterSequence?: string; beforeSequence?: string } = {}): Promise<Transcript> {
  const params = new URLSearchParams();
  if (options.afterSequence) params.set('afterSequence', options.afterSequence);
  if (options.beforeSequence) params.set('beforeSequence', options.beforeSequence);
  const query = params.toString();
  return request(`/support/channels/${channelId}/messages${query ? `?${query}` : ''}`);
}

export type OutgoingAttachment = {
  storageObjectKey: string;
  filename: string;
  declaredMime: string;
  sizeBytes: number;
  sha256: string;
};

/**
 * `clientMessageId` lo genera esta pantalla y se conserva al reintentar.
 *
 * Es lo unico que impide que una señal mala convierta un mensaje en tres: el servidor devuelve el
 * que ya guardo en vez de crear otro.
 */
export function sendMessage(
  channelId: string,
  input: { clientMessageId: string; body: string; messageType?: string; attachment?: OutgoingAttachment },
): Promise<SupportMessage> {
  return request(`/support/channels/${channelId}/messages`, { method: 'POST', body: input });
}

export function markRead(channelId: string, upToSequence: string) {
  return request(`/support/channels/${channelId}/read`, { method: 'POST', body: { upToSequence } });
}

export function announceTyping(channelId: string) {
  return request(`/support/channels/${channelId}/typing`, { method: 'POST' });
}

export function closeChannel(channelId: string, reason = 'USER_ENDED') {
  return request(`/support/channels/${channelId}/close`, { method: 'POST', body: { reason } });
}

export function unreadCount(): Promise<{ channels: { channelId: string; unread: number }[]; total: number }> {
  return request('/support/channels/unread');
}

export function attachmentTicket(
  channelId: string,
  input: { contentType: string; sizeBytes: number },
): Promise<{ storageKey: string; uploadUrl: string; method: string; requiredHeaders: Record<string, string> }> {
  return request(`/support/channels/${channelId}/attachments/ticket`, { method: 'POST', body: input });
}

/**
 * Descarga el adjunto como bytes y lo devuelve en `data:` para poder pintarlo.
 *
 * Un `<Image source={{ uri }}>` no manda cabeceras: contra una ruta autenticada recibiria 401, y
 * servirlo por URL prefirmada seria publicar un enlace que funciona sin sesion. Es la misma regla
 * que ya sigue el QR del comercio.
 */
export async function readAttachment(attachmentId: string): Promise<string | null> {
  const token = await readAccessToken();
  if (!token) return null;

  const response = await fetch(`${apiConfig.baseUrl}/support/attachments/${attachmentId}/content`, {
    // Esta descarga no pasa por `request` —arma la autorizacion a mano—, asi que la correlacion se
    // pone aqui o esta peticion queda como la unica de la app que el backend no puede atar a nada.
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': apiConfig.tenantId,
      'x-correlation-id': newCorrelationId(),
    },
  });
  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${contentType};base64,${base64}`;
}

/** Sin `Buffer` ni dependencias: Hermes no trae el de Node y no vale la pena arrastrarlo. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) binary += String.fromCharCode(bytes[index] as number);
  return globalThis.btoa(binary);
}
