/**
 * El asistente del comercio (Atlas Assist), visto desde la app.
 *
 * Es un PORTE de `AtlasERPFrontend/services/assistService.ts`: va por el backend del ERP como todo
 * lo demás (`/internal/assist/*`) y la app nunca habla con AtlasBackend. Esa pasarela
 * (`assist-gateway.controller.ts`) reenvía con el token de la sesión y FIJA la superficie por el tipo
 * de sesión —una sesión de comercio es `merchant-portal`—, así que aquí no viaja ninguna: si viajara,
 * la pasarela la descartaría igual. Del cuerpo del chat sólo cruzan `prompt`, `clientMessageId`,
 * `conversationId` y `screen`.
 *
 * ## `clientMessageId` es la llave de idempotencia
 *
 * Un UUID v4 que se conserva en cada reintento. Core reconoce la repetición y devuelve la respuesta
 * guardada en vez de generar (y facturar) otra. Viaja también como `x-idempotency-key`, que es lo
 * que deja a `reintentos.ts` repetir la petición si contestó la pasarela durante un despliegue.
 *
 * ## El 409 no es un error
 *
 * `ASSIST_IN_FLIGHT` dice «esa MISMA pregunta se está respondiendo». Se espera lo que pide
 * `Retry-After` y se repite con la misma llave (`conReintentoEnCurso`), como la web.
 */
import { ApiError, apiRequest } from '@/api/client';

export interface RespuestaDelAsistente {
  reply: string;
  suggestHandoff: boolean;
  conversationId: string | null;
  turnId: string | null;
  /** `sin-ia`: el texto sale de la guía, sin modelo de lenguaje. */
  mode?: 'sin-ia';
}

export interface TurnoDelAsistente {
  turnId: string;
  prompt: string;
  reply: string;
  suggestHandoff: boolean;
  createdAt: string;
  mode?: 'sin-ia';
}

export interface ConversacionDelAsistente {
  conversationId: string | null;
  turns: TurnoDelAsistente[];
}

/** Una conversación de la lista del historial (Core devuelve las 30 más recientes, la última primero). */
export interface ResumenDeConversacion {
  conversationId: string;
  title: string | null;
  updatedAt: string;
  turnCount: number;
}

export interface PreguntaAlAsistente {
  prompt: string;
  /** UUID v4. La MISMA en cada reintento: es lo que evita generar dos respuestas. */
  clientMessageId: string;
  conversationId?: string;
  /** El nombre visible de la sección («Gestión POS»): letras, números y `›/·_-().,`, hasta 80. */
  screen?: string;
}

/** Detrás hay un modelo de lenguaje: una respuesta lenta no es una caída. */
export const PLAZO_DE_RESPUESTA_MS = 45_000;

export type Dormir = (ms: number) => Promise<void>;

const dormirDeVerdad: Dormir = (ms) => new Promise<void>((listo) => setTimeout(listo, ms));

/**
 * Repite la MISMA pregunta mientras Core diga que sigue en curso (409). Espera lo que pide
 * `Retry-After` (entre 1 y 10 s; 2 s si no lo dice) y vuelve con el mismo `clientMessageId`. Tres
 * veces como mucho; después el 409 sube y la pantalla lo explica. Igual que `lib/asistente.ts` de la web.
 */
export async function conReintentoEnCurso<T>(enviar: () => Promise<T>, opciones: { intentos?: number; dormir?: Dormir } = {}): Promise<T> {
  const intentos = opciones.intentos ?? 3;
  const dormir = opciones.dormir ?? dormirDeVerdad;
  for (let n = 0; ; n++) {
    try {
      return await enviar();
    } catch (error) {
      const enCurso = error instanceof ApiError && error.status === 409;
      if (!enCurso || n >= intentos) throw error;
      const segundos = Math.min(Math.max(error.retryAfterSeconds ?? 2, 1), 10);
      await dormir(segundos * 1000);
    }
  }
}

const rutaDeConversacion = (id: string) => `internal/assist/conversations/${encodeURIComponent(id)}`;

export const assistService = {
  /** El hilo vigente, para abrir la hoja con lo ya hablado. `null` si nunca se preguntó nada. */
  conversacion() {
    return apiRequest<ConversacionDelAsistente | null>('internal/assist/conversation');
  },
  /** Las conversaciones de esta persona. La superficie la fija la pasarela por el tipo de sesión. */
  async conversaciones(): Promise<ResumenDeConversacion[]> {
    const lista = await apiRequest<{
      conversations?: ResumenDeConversacion[];
    } | null>('internal/assist/conversations');
    return lista?.conversations ?? [];
  },
  /** Una conversación con todos sus turnos, para abrirla y seguirla. */
  abrir(conversationId: string) {
    return apiRequest<ConversacionDelAsistente>(rutaDeConversacion(conversationId));
  },
  /** Borra una conversación del historial. */
  borrar(conversationId: string) {
    return apiRequest<{ deleted: number } | null>(rutaDeConversacion(conversationId), { method: 'DELETE' });
  },
  preguntar(pregunta: PreguntaAlAsistente, opciones: { dormir?: Dormir } = {}) {
    return conReintentoEnCurso(
      () =>
        apiRequest<RespuestaDelAsistente>('internal/assist/chat', {
          method: 'POST',
          body: pregunta,
          timeoutMs: PLAZO_DE_RESPUESTA_MS,
          headers: { 'x-idempotency-key': pregunta.clientMessageId },
        }),
      opciones,
    );
  },
};
