/**
 * Atlas Assist: el asistente que contesta dudas de uso de la app al momento.
 *
 * ## Por qué habla con Core y no con el servicio de IA
 *
 * La app llama a `/mobile/assist/*` de SU backend, con su sesión de siempre: mismo `baseUrl`,
 * mismo refresco de token, misma correlación. La clave con la que Core habla con el servicio de
 * IA vive en el servidor y no existe en ningún bundle. Aquí no hay variables de entorno nuevas.
 *
 * ## `clientMessageId` lo genera la pantalla y SE CONSERVA al reintentar
 *
 * Igual que en el chat de soporte: es lo único que impide que una señal mala convierta una
 * pregunta en tres respuestas facturadas. El servidor guarda la respuesta bajo esa clave y el
 * reintento recoge la que ya había. Un 409 significa «la misma consulta sigue en curso»: se
 * espera un momento y se repite CON LA MISMA clave; no es un error de la persona.
 *
 * ## El 404 es el interruptor, no un fallo
 *
 * Con el asistente apagado (`ASSIST_ENABLED` en Core), toda la superficie contesta 404 con código
 * `ASSIST_DISABLED`. La app lo lee como «esconde el botón entero».
 */
import { request } from '../client';

/** Desde qué pantalla escribe la persona. Mismo vocabulario que el catálogo del asistente. */
export type AssistScreen = 'inicio' | 'escanear' | 'pagos' | 'avisos' | 'perfil' | 'otra';

export type AssistReply = {
  reply: string;
  /** Si la respuesta amerita ofrecer el chat humano en primer plano (reclamos, fraude, «una persona»). */
  suggestHandoff: boolean;
  conversationId: string | null;
  turnId: string | null;
};

export type AssistTurn = {
  turnId: string;
  prompt: string;
  reply: string;
  suggestHandoff: boolean;
  createdAt: string;
};

export type AssistConversation = {
  conversationId: string | null;
  turns: AssistTurn[];
};

export function preguntar(input: {
  prompt: string;
  clientMessageId: string;
  conversationId?: string;
  screen?: AssistScreen;
}): Promise<AssistReply> {
  return request('/mobile/assist/chat', { method: 'POST', body: input });
}

/** El hilo vigente, para rehidratar la hoja al abrirla. Vacío si nunca se preguntó nada. */
export function conversacion(): Promise<AssistConversation> {
  return request('/mobile/assist/conversation');
}
