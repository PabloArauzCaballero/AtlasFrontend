/**
 * La lógica del soporte que no es dibujo: qué hace cada evento del hilo en vivo, cuándo un mensaje
 * está leído, cómo se aplana el árbol de motivos y cuándo se puede enviar un caso.
 *
 * Todo sale de `MerchantSupportScreen.tsx` de la web, donde vive en línea dentro del componente.
 * Aquí está aparte para poder probarlo: un evento mal aplicado duplica un mensaje o marca como leído
 * algo que nadie leyó, y eso no se ve en una captura.
 */
import type { CasoDeSoporte, EstadoDeLectura, EventoEnVivo, MensajeDeSoporte, MotivoDeSoporte } from '@/api/servicios/supportService';

/** Identificador propio del mensaje: el backend lo usa para no guardarlo dos veces. Prefijo de la app, no `erp-`. */
export function nuevoClientMessageId(ahora = Date.now(), azar = Math.random()): string {
  return `merchant-app-${ahora}-${azar.toString(36).slice(2, 10)}`;
}

/** Añade un mensaje si no estaba (por `sequence`): el mismo puede llegar por el envío y por el hilo. */
export function agregarMensaje(previos: MensajeDeSoporte[], llegado: MensajeDeSoporte): MensajeDeSoporte[] {
  return previos.some((mensaje) => String(mensaje.sequence) === String(llegado.sequence)) ? previos : [...previos, llegado];
}

/** Lo que el hilo en vivo pide hacer con la pantalla. `null` = el evento no cambia nada. */
export type EfectoDelEvento =
  | { tipo: 'mensaje'; mensaje: MensajeDeSoporte }
  | { tipo: 'escribiendo' }
  | { tipo: 'leido'; actorType: string | undefined; upToSequence: string | undefined }
  | { tipo: 'cerrado' };

/**
 * Traduce un evento del hilo. `message.created` inserta sin volver a pedir la conversación entera;
 * `agent.typing` enciende el aviso; `message.read` mueve el doble tic. `channel.closed` no lo trata
 * la web (el canal se queda abierto en pantalla hasta salir); aquí se avisa, porque en el teléfono
 * la conversación ocupa la pantalla entera y escribir a un canal cerrado sólo daría errores.
 */
export function efectoDelEvento(evento: EventoEnVivo): EfectoDelEvento | null {
  if (evento.type === 'message.created') return { tipo: 'mensaje', mensaje: evento.data as unknown as MensajeDeSoporte };
  if (evento.type === 'agent.typing') return { tipo: 'escribiendo' };
  if (evento.type === 'message.read') {
    const leido = evento.data as { actorType?: unknown; upToSequence?: unknown };
    return {
      tipo: 'leido',
      actorType: typeof leido.actorType === 'string' ? leido.actorType : undefined,
      upToSequence: leido.upToSequence === undefined || leido.upToSequence === null ? undefined : String(leido.upToSequence),
    };
  }
  if (evento.type === 'channel.closed') return { tipo: 'cerrado' };
  return null;
}

/** El acuse de lectura de la otra parte, aplicado como la web: sólo a los actores que ya conocía. */
export function aplicarLectura(previos: EstadoDeLectura[], actorType: string | undefined, upToSequence: string | undefined): EstadoDeLectura[] {
  return previos.map((estado) =>
    estado.actorType === actorType ? { ...estado, lastReadSequence: String(upToSequence ?? estado.lastReadSequence) } : estado,
  );
}

/** El doble tic: sólo tiene sentido sobre lo que mandó este comercio. */
export function fueLeido(mensaje: MensajeDeSoporte, readState: EstadoDeLectura[]): boolean {
  return (
    mensaje.senderActorType === 'PARTNER_USER' &&
    readState.some((estado) => Number(estado.lastReadSequence) >= Number(mensaje.sequence))
  );
}

/** El árbol de motivos como lista plana «Padre › Hijo», para el selector de «Abrir un caso». */
export function aplanarMotivos(lista: MotivoDeSoporte[], prefijo = ''): { label: string; value: string }[] {
  return lista.flatMap((motivo) => [
    { label: `${prefijo}${motivo.label}`, value: motivo.categoryCode },
    ...aplanarMotivos(motivo.subcategories ?? [], `${prefijo}${motivo.label} › `),
  ]);
}

export interface BorradorDeCaso {
  categoryCode: string;
  title: string;
  description: string;
}

export const CASO_VACIO: BorradorDeCaso = { categoryCode: '', title: '', description: '' };

/** La misma condición que apaga «Enviar el caso» en la web. */
export function casoListoParaEnviar(caso: BorradorDeCaso): boolean {
  return Boolean(caso.categoryCode) && caso.title.trim().length >= 3 && caso.description.trim().length >= 10;
}

/**
 * Por qué «Enviar el caso» está apagado, dicho. En la web el botón se apaga sin explicar; en el
 * teléfono un botón mudo se lee como roto (ver `Button.blockedReason` de la app del cliente).
 */
export function motivoDeBloqueo(caso: BorradorDeCaso): string | null {
  if (!caso.categoryCode) return 'Elige el motivo del caso.';
  if (caso.title.trim().length < 3) return 'El título necesita al menos 3 caracteres.';
  if (caso.description.trim().length < 10) return 'Cuenta un poco más en la descripción (al menos 10 caracteres).';
  return null;
}

/** El canal todavía vivo de un caso, si lo tiene: es lo que enciende «Ver conversación». */
export function canalVivo(caso: CasoDeSoporte): string | null {
  return caso.channels?.find((canal) => !['CLOSED', 'ABANDONED'].includes(canal.status))?.channelId ?? null;
}

/** El tono de la pastilla de estado de un caso, como la web: cerrado gris, resuelto verde, el resto informativo. */
export function tonoDelCaso(caso: Pick<CasoDeSoporte, 'closedAt' | 'resolvedAt'>): 'neutral' | 'success' | 'info' {
  return caso.closedAt ? 'neutral' : caso.resolvedAt ? 'success' : 'info';
}

/**
 * El estado de un caso dicho en español, con su tono. Son los catorce que admite
 * `ck_support_case_status` en AtlasBackend; el tono parte del de la web (`tonoDelCaso`) y sólo
 * cambia a ámbar cuando el caso espera algo DEL comercio, que es lo único que le pide actuar.
 */
const ESTADO_DEL_CASO: Record<string, string> = {
  NEW: 'Nuevo',
  TRIAGED: 'Recibido',
  ASSIGNED: 'Asignado',
  IN_PROGRESS: 'En curso',
  WAITING_CUSTOMER: 'Espera tu respuesta',
  WAITING_PARTNER: 'Espera tu respuesta',
  WAITING_INTERNAL: 'En curso',
  ESCALATED: 'Escalado',
  ON_HOLD: 'En pausa',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  REOPENED: 'Reabierto',
  DUPLICATE: 'Duplicado',
  CANCELLED: 'Cancelado',
};

export function estadoDelCaso(caso: Pick<CasoDeSoporte, 'status' | 'closedAt' | 'resolvedAt'>): { texto: string; tono: 'neutral' | 'success' | 'info' | 'warning' } {
  const texto = ESTADO_DEL_CASO[caso.status] ?? caso.status;
  if (!caso.closedAt && !caso.resolvedAt && (caso.status === 'WAITING_CUSTOMER' || caso.status === 'WAITING_PARTNER')) return { texto, tono: 'warning' };
  return { texto, tono: tonoDelCaso(caso) };
}

/** «2 oct»: la fecha de la línea de un caso, sin año ni punto de abreviatura. */
export function fechaCorta(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }).replace(/\./g, '');
}

/** Fecha y hora como `toLocaleString('es-BO')` de la web. */
export function fechaHora(valor: string | null): string {
  if (!valor) return 'Todavía no';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleString('es-BO');
}

export function soloFecha(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? valor : fecha.toLocaleDateString('es-BO');
}

export function horaDelMensaje(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

/** Avisos de la web, escritos una vez. */
export const TEXTOS = {
  sinAgentes: 'No hay agentes libres ahora. Deja tu mensaje y te respondemos.',
  noAbrio: 'No pudimos abrir la conversación.',
  noCargoConversacion: 'No pudimos cargar la conversación.',
  noEnvio: 'No pudimos enviar tu mensaje.',
  noCerro: 'No pudimos cerrar la conversación.',
  noCasos: 'No pudimos cargar tus casos de soporte.',
  noMotivos: 'No pudimos cargar los motivos de soporte; puedes hablar igual y lo clasificamos nosotros.',
  noCaso: 'No pudimos abrir el caso. Revisa el motivo y el título e inténtalo de nuevo.',
  noDetalle: 'No pudimos cargar el detalle del caso.',
} as const;
