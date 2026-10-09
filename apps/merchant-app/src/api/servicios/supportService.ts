import { apiRequest, getAccessToken, cabecerasDeOrigen } from '@/api/client';
import { newCorrelationId } from '@/api/correlationId';
import { createSupportSseParser, type EventoEnVivo } from '@/api/servicios/support-sse-parser';
export type { EventoEnVivo } from '@/api/servicios/support-sse-parser';

/**
 * Soporte del comercio: sus casos y la conversación con Atlas.
 *
 * ## Por qué aquí sí hay tiempo real y en la app no
 *
 * El navegador trae `EventSource` de serie y la pestaña vive abierta mientras el comercio trabaja:
 * es el escenario para el que se hizo SSE. En el teléfono no existe `EventSource` y el sistema mata
 * las conexiones al pasar a segundo plano, así que allí se pregunta cada pocos segundos. El backend
 * publica lo mismo por los dos caminos.
 *
 * ## Cómo se autentica el hilo en vivo
 *
 * Con la cabecera `Authorization` de siempre, leyendo el stream con `fetch`. Se descartó
 * `EventSource` justamente porque no admite cabeceras y habría obligado a poner el token en la URL
 * —donde acaba en logs, historial y `Referer`—. Ver `suscribirseAlChat`.
 */

export interface CasoDeSoporte {
  caseId: string;
  caseNumber: string;
  title: string;
  caseType: string;
  domain: string;
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
}

export interface MensajeDeSoporte {
  messageId: string;
  sequence: string;
  clientMessageId: string;
  senderActorType: 'CUSTOMER' | 'PARTNER_USER' | 'AGENT' | 'SUPERVISOR' | 'SYSTEM';
  messageType: string;
  visibility: string;
  body: string | null;
  redacted: boolean;
  createdAt: string;
  attachments: { attachmentId: string; filename: string; mime: string | null; sizeBytes: number; scanStatus: string }[];
}

export interface EstadoDeLectura {
  actorType: string;
  roleInChannel: string;
  lastReadSequence: string;
  lastReadAt: string | null;
}

export interface Transcripcion {
  messages: MensajeDeSoporte[];
  readState: EstadoDeLectura[];
  nextCursor: string | null;
}

/**
 * Un motivo del catálogo, tal y como lo ve quien va a pedir ayuda.
 *
 * NO trae cola, sensibilidad, impacto ni urgencia: esos cuatro campos son la política interna de
 * atención, y publicarlos enseñaría qué motivo elegir para caer en la cola especializada o para
 * nacer con prioridad alta.
 */
export interface MotivoDeSoporte {
  categoryCode: string;
  label: string;
  description: string | null;
  requiresSpecialist: boolean;
  subcategories?: MotivoDeSoporte[];
}

export interface ArticuloDeAyuda {
  articleId: string;
  articleKey: string;
  title: string;
  question: string | null;
  shortAnswer: string | null;
  body: string;
  escalateWhen: string | null;
}

export const supportService = {
  faq() {
    return apiRequest<{ faq: ArticuloDeAyuda[] }>('/merchant/support/faq');
  },
  buscar(consulta: string) {
    return apiRequest<{ query: string; results: ArticuloDeAyuda[] }>('/merchant/support/knowledge/search', {
      query: { q: consulta },
    });
  },
  listarCasos(partnerProfileId: string) {
    return apiRequest<{ cases: CasoDeSoporte[] }>(`/merchant/support/partners/${partnerProfileId}/cases`);
  },
  verCaso(caseId: string) {
    return apiRequest<CasoDeSoporte>(`/merchant/support/cases/${caseId}`);
  },
  abrirCaso(body: {
    categoryCode: string;
    title: string;
    description: string;
    partnerProfileId: string;
    acknowledgeDuplicate?: boolean;
  }) {
    return apiRequest<CasoDeSoporte>('/merchant/support/cases', { method: 'POST', body });
  },
  /**
   * Los motivos por los que este comercio puede abrir un caso.
   *
   * Las audiencias las deriva el servidor del token: si viajaran como parámetro, pedir el catálogo
   * del consumidor sería tan fácil como cambiar una cadena en la URL.
   */
  listarMotivos() {
    return apiRequest<{ categories: MotivoDeSoporte[] }>('/merchant/support/categories');
  },
  abrirConversacion(body: { partnerProfileId: string; categoryCode?: string; caseId?: string }) {
    return apiRequest<{ channelId: string; status: string; reused: boolean; agentsAvailable: number | null }>(
      '/support/channels',
      { method: 'POST', body },
    );
  },
  leerConversacion(channelId: string, opciones: { afterSequence?: string; beforeSequence?: string } = {}) {
    return apiRequest<Transcripcion>(`/support/channels/${channelId}/messages`, {
      query: { afterSequence: opciones.afterSequence, beforeSequence: opciones.beforeSequence },
    });
  },
  enviarMensaje(channelId: string, body: { clientMessageId: string; body: string }) {
    return apiRequest<MensajeDeSoporte>(`/support/channels/${channelId}/messages`, { method: 'POST', body });
  },
  marcarLeido(channelId: string, upToSequence: string) {
    return apiRequest<unknown>(`/support/channels/${channelId}/read`, { method: 'POST', body: { upToSequence } });
  },
  avisarEscribiendo(channelId: string) {
    return apiRequest<unknown>(`/support/channels/${channelId}/typing`, { method: 'POST' });
  },
  cerrarConversacion(channelId: string) {
    return apiRequest<unknown>(`/support/channels/${channelId}/close`, { method: 'POST', body: { reason: 'USER_ENDED' } });
  },
  sinLeer() {
    return apiRequest<{ channels: { channelId: string; unread: number }[]; total: number }>('/support/channels/unread');
  },
};

/**
 * Abre el hilo en vivo de una conversación.
 *
 * ## Por qué `fetch` en streaming y no `EventSource`
 *
 * `EventSource` no admite cabeceras, así que el token tendría que viajar en la URL — y una URL con
 * un token dentro acaba en los logs del servidor, en el historial y en la cabecera `Referer` de
 * cualquier recurso que la página cargue después. `fetch` sí manda `Authorization`, entiende el
 * mismo `text/event-stream` y se corta con un `AbortController`. Lo único que se pierde es la
 * reconexión automática del navegador, que aquí se implementa explícitamente y con espera.
 *
 * Devuelve la función para cerrarlo, y quien la llama DEBE invocarla al desmontar: una suscripción
 * que sobrevive a la pantalla sigue recibiendo mensajes de una conversación que ya nadie mira, y
 * cada navegación deja otra abierta.
 */
export function suscribirseAlChat(
  channelId: string,
  alRecibir: (evento: EventoEnVivo) => void,
  alCambiarConexion?: (conectado: boolean) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const control = new AbortController();
  let cerrado = false;

  const escuchar = async (): Promise<void> => {
    const token = getAccessToken();
    if (!token) return;

    const base = process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL?.trim() || window.location.origin;
    const prefijo = (process.env.NEXT_PUBLIC_ATLAS_API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    const url = `${base.replace(/\/+$/, '')}/${prefijo}/support/channels/${channelId}/stream`;

    try {
      const respuesta = await fetch(url, {
        // Este stream no pasa por `apiClient` —arma la URL y la autorización a mano—, así que la
        // correlación hay que ponerla aquí o esta conexión queda como la única del portal que el
        // backend no puede atar a nada. Uno por conexión, no por evento: la fila del log es la del
        // request, y el request es la conexión entera.
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'x-correlation-id': newCorrelationId(),
          // Tampoco pasa por `buildHeaders` el origen: sin esto, el chat es la única pantalla del portal
          // cuyas llamadas no dicen desde dónde salen.
          ...cabecerasDeOrigen(),
        },
        signal: control.signal,
      });
      if (!respuesta.ok || !respuesta.body) throw new Error(`stream HTTP ${respuesta.status}`);

      alCambiarConexion?.(true);
      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      const parser = createSupportSseParser();

      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        let eventos: EventoEnVivo[];
        try {
          eventos = parser.push(decodificador.decode(value, { stream: true }));
        } catch (error) {
          // Evento por encima del tope: se suelta esta conexión (si no, el cuerpo sigue llegando sin
          // nadie que lo lea) y se reconecta como ante cualquier otro corte.
          await lector.cancel().catch(() => undefined);
          throw error;
        }
        for (const evento of eventos) alRecibir(evento);
      }
    } catch {
      // Abortar al desmontar entra por aquí y no es un fallo: por eso se comprueba `cerrado`.
    } finally {
      alCambiarConexion?.(false);
    }

    // Reconexión con espera. Sin la pausa, un backend caído produciría un bucle de peticiones que
    // le impediría levantarse.
    if (!cerrado) setTimeout(() => void escuchar(), 3000);
  };

  void escuchar();

  return () => {
    cerrado = true;
    control.abort();
  };
}
