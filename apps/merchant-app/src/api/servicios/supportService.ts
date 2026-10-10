import { apiRequest, buildUrl, cabecerasDeOrigen, getAccessToken } from '@/api/client';
import { newCorrelationId } from '@/api/correlationId';
import { createSupportSseParser, type EventoEnVivo } from '@/api/servicios/support-sse-parser';
export type { EventoEnVivo } from '@/api/servicios/support-sse-parser';

/**
 * Soporte del comercio: sus casos y la conversación con Atlas. Copia de `AtlasERPFrontend/services/supportService.ts`.
 *
 * ## El hilo en vivo también en el teléfono
 *
 * La web escucha la conversación por SSE leyendo el stream con `fetch`. La app del CLIENTE pregunta
 * cada pocos segundos porque su `fetch` no sabía leer un cuerpo a trozos; el de Expo (`expo/fetch`,
 * que el runtime instala como `fetch` global desde el SDK 52) sí devuelve un `ReadableStream`, así
 * que aquí se usa el MISMO camino que la web, con el mismo parser. Lo que cambia es el ciclo de vida:
 * el sistema corta las conexiones al pasar la app a segundo plano, y por eso quien abre el hilo lo
 * cierra al irse a segundo plano y lo reabre al volver (`features/soporte/use-hilo-en-vivo.ts`).
 *
 * ## Cómo se autentica el hilo en vivo
 *
 * Con la cabecera `Authorization` de siempre y las cookies de la sesión (`credentials: 'include'`).
 * Se descartó `EventSource` justamente porque no admite cabeceras y habría obligado a poner el token
 * en la URL —donde acaba en logs, historial y `Referer`—. Ver `suscribirseAlChat`.
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

/** Lo que `suscribirseAlChat` necesita del entorno. Se inyecta en las pruebas; en la app vale el de serie. */
export interface EntornoDelHilo {
  /** El `fetch` que sabe leer el cuerpo a trozos: el de Expo. */
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** La espera antes de reconectar. */
  esperar: (ms: number, accion: () => void) => () => void;
  /**
   * Renueva la sesión cuando el stream contesta 401.
   *
   * El token de acceso caduca a los pocos minutos y el stream no pasa por `apiRequest`, que es quien
   * lo renueva. En la web no se nota —cualquier otra llamada de la pestaña lo renueva enseguida—; en
   * el teléfono, con la conversación como única pantalla abierta, el hilo se quedaba reconectando
   * con un token muerto cada tres segundos. Una lectura barata por `apiRequest` lo resuelve.
   */
  renovar: () => Promise<unknown>;
}

const ENTORNO_DE_SERIE: EntornoDelHilo = {
  // `globalThis.fetch` ES `expo/fetch` (lo instala `expo/src/winter/runtime.native.ts`). Se toma en el
  // momento de llamar y no al cargar el módulo, para que las pruebas puedan sustituirlo.
  fetch: (url, init) => globalThis.fetch(url, init),
  esperar: (ms, accion) => {
    const temporizador = setTimeout(accion, ms);
    return () => clearTimeout(temporizador);
  },
  renovar: () => supportService.sinLeer(),
};

/** La espera entre reconexiones. La misma que la web. */
export const ESPERA_RECONEXION_MS = 3000;

/**
 * Abre el hilo en vivo de una conversación.
 *
 * ## Por qué `fetch` en streaming y no `EventSource`
 *
 * `EventSource` no admite cabeceras, así que el token tendría que viajar en la URL. `fetch` sí manda
 * `Authorization`, entiende el mismo `text/event-stream` y se corta con un `AbortController`. Lo que
 * se pierde es la reconexión automática, que aquí se implementa explícitamente y con espera.
 *
 * Diferencias con la web, todas por el teléfono: la URL sale de `buildUrl` (la misma base que el
 * resto de la API; no hay `window.location`), la petición lleva `credentials: 'include'` como todas
 * las de `client.ts`, un 401 renueva la sesión antes de reintentar, y sin token también se reintenta
 * (la web se rendía: en el teléfono la sesión puede estar renovándose justo al abrir).
 *
 * Devuelve la función para cerrarlo, y quien la llama DEBE invocarla al desmontar y al pasar a
 * segundo plano: una suscripción que sobrevive a la pantalla sigue recibiendo mensajes de una
 * conversación que ya nadie mira, y cada navegación deja otra abierta.
 */
export function suscribirseAlChat(
  channelId: string,
  alRecibir: (evento: EventoEnVivo) => void,
  alCambiarConexion?: (conectado: boolean) => void,
  entorno: EntornoDelHilo = ENTORNO_DE_SERIE,
): () => void {
  const control = new AbortController();
  let cerrado = false;
  let cancelarEspera: (() => void) | null = null;

  const reconectar = () => {
    if (cerrado) return;
    // Sin la pausa, un backend caído recibiría un bucle de peticiones que le impediría levantarse.
    cancelarEspera = entorno.esperar(ESPERA_RECONEXION_MS, () => {
      cancelarEspera = null;
      void escuchar();
    });
  };

  const escuchar = async (): Promise<void> => {
    if (cerrado) return;
    const token = getAccessToken();
    if (!token) {
      reconectar();
      return;
    }

    try {
      const respuesta = await entorno.fetch(buildUrl(`support/channels/${encodeURIComponent(channelId)}/stream`), {
        method: 'GET',
        // Este stream no pasa por `apiRequest`, así que la correlación, el origen y las cookies se
        // ponen aquí: si no, sería la única conexión de la app que el backend no puede atar a nada.
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'x-correlation-id': newCorrelationId(),
          ...cabecerasDeOrigen(),
        },
        credentials: 'include',
        signal: control.signal,
      });
      if (respuesta.status === 401) {
        await entorno.renovar().catch(() => undefined);
        throw new Error('stream HTTP 401');
      }
      if (!respuesta.ok || !respuesta.body) throw new Error(`stream HTTP ${respuesta.status}`);

      alCambiarConexion?.(true);
      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      const parser = createSupportSseParser();

      for (;;) {
        const { done, value } = await lector.read();
        if (done || cerrado) break;
        let eventos: EventoEnVivo[];
        try {
          eventos = parser.push(decodificador.decode(value, { stream: true }));
        } catch (error) {
          // Evento por encima del tope: se suelta esta conexión y se reconecta como ante cualquier corte.
          await lector.cancel().catch(() => undefined);
          throw error;
        }
        for (const evento of eventos) alRecibir(evento);
      }
    } catch {
      // Abortar al cerrar entra por aquí y no es un fallo: por eso se comprueba `cerrado`.
    } finally {
      if (!cerrado) alCambiarConexion?.(false);
    }

    reconectar();
  };

  void escuchar();

  return () => {
    cerrado = true;
    cancelarEspera?.();
    control.abort();
    alCambiarConexion?.(false);
  };
}
