/** Lo que llega por el hilo en vivo. El tipo viaja DENTRO del dato, no como nombre de evento SSE. */
export interface EventoEnVivo {
  type: 'message.created' | 'message.read' | 'agent.typing' | 'channel.closed' | string;
  data: Record<string, unknown>;
}

/**
 * Topes del hilo en vivo. Antes, lo que llegaba sin línea en blanco se acumulaba en `pendiente` sin
 * límite: un upstream roto (o malicioso) que nunca cerrara un evento hacía crecer la memoria de la
 * pestaña hasta tumbarla. Un evento del chat es un mensaje; 64 KiB le sobran.
 */
const MAX_EVENT_CHARS = 65_536;
const MAX_CHUNK_CHARS = 131_072;
const EVENT_SEPARATOR = /\r?\n\r?\n/g;

/** Un evento SSE ya completo → `{ type, data }`, o `null` si no trae datos o no tiene esa forma. */
function parseEvent(frame: string): EventoEnVivo | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  try {
    const event: unknown = JSON.parse(data);
    if (
      typeof event !== 'object' || event === null ||
      !('type' in event) || typeof event.type !== 'string' ||
      !('data' in event) || typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)
    ) return null;
    return event as EventoEnVivo;
  } catch {
    return null;
  }
}

/**
 * Parte el texto del stream en eventos. Un chunk puede cortar un evento por la mitad, así que sólo se
 * devuelve lo que ya está completo y el resto espera al siguiente trozo. Un evento ilegible se ignora
 * (no puede tumbar el hilo); uno que pasa del tope lanza, y quien escucha corta y reconecta.
 */
export function createSupportSseParser(): { push(chunk: string): EventoEnVivo[] } {
  let pending = '';
  return {
    push(chunk: string): EventoEnVivo[] {
      if (chunk.length > MAX_CHUNK_CHARS) throw new Error('SSE chunk demasiado grande');
      const input = pending + chunk;
      const events: EventoEnVivo[] = [];
      let cursor = 0;
      EVENT_SEPARATOR.lastIndex = 0;
      for (const separator of input.matchAll(EVENT_SEPARATOR)) {
        const frame = input.slice(cursor, separator.index);
        if (frame.length > MAX_EVENT_CHARS) throw new Error('SSE evento demasiado grande');
        const event = parseEvent(frame);
        if (event) events.push(event);
        cursor = separator.index + separator[0].length;
      }
      pending = input.slice(cursor);
      if (pending.length > MAX_EVENT_CHARS) throw new Error('SSE evento incompleto demasiado grande');
      return events;
    },
  };
}
