/**
 * Cómo se ordena un hilo de chat en pantalla: separadores de día y mensajes agrupados por quien habla.
 *
 * Es lógica pura, sin dibujo, y la usan los dos chats de soporte —el del cliente y el del comercio
 * (`@cliente/features/chat-hilo`)— para que se lean igual.
 *
 * ## Por que se agrupan los mensajes
 *
 * Tres mensajes seguidos del mismo lado con su hora cada uno son tres tarjetas; agrupados, son una
 * frase dicha en tres partes. La hora y el estado (enviado, leído) van solo en el ÚLTIMO del grupo,
 * que es donde se mira, y el hilo ocupa la mitad.
 */

export type LadoDelMensaje = 'mio' | 'suyo' | 'sistema';

export type EntradaDelHilo<M> =
  | { tipo: 'dia'; clave: string; etiqueta: string }
  | { tipo: 'mensaje'; clave: string; mensaje: M; lado: LadoDelMensaje; primeroDelGrupo: boolean; ultimoDelGrupo: boolean };

/** Dos mensajes del mismo lado separados por más de esto empiezan grupo nuevo. */
export const PAUSA_ENTRE_GRUPOS_MS = 300_000; // cinco minutos

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function claveDeDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/** «Hoy», «Ayer» o «12 de octubre» (con el año si no es el actual). */
export function etiquetaDeDia(fecha: Date, ahora: Date = new Date()): string {
  if (claveDeDia(fecha) === claveDeDia(ahora)) return 'Hoy';
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (claveDeDia(fecha) === claveDeDia(ayer)) return 'Ayer';
  const base = `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
  return fecha.getFullYear() === ahora.getFullYear() ? base : `${base} de ${fecha.getFullYear()}`;
}

export function armarHilo<M extends { messageId: string; createdAt: string }>(
  mensajes: readonly M[],
  ladoDe: (mensaje: M) => LadoDelMensaje,
  ahora: Date = new Date(),
): EntradaDelHilo<M>[] {
  const salida: EntradaDelHilo<M>[] = [];
  let diaAnterior: string | null = null;

  mensajes.forEach((mensaje, indice) => {
    const fecha = new Date(mensaje.createdAt);
    const valida = !Number.isNaN(fecha.getTime());
    const dia = valida ? claveDeDia(fecha) : diaAnterior;
    if (valida && dia !== diaAnterior) {
      salida.push({ tipo: 'dia', clave: `dia-${dia}`, etiqueta: etiquetaDeDia(fecha, ahora) });
    }
    diaAnterior = dia;

    const lado = ladoDe(mensaje);
    const anterior = mensajes[indice - 1];
    const siguiente = mensajes[indice + 1];
    const mismoGrupo = (a: M | undefined, b: M) => {
      if (!a || ladoDe(a) === 'sistema' || ladoDe(a) !== ladoDe(b)) return false;
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
      return claveDeDia(new Date(ta)) === claveDeDia(new Date(tb)) && Math.abs(tb - ta) <= PAUSA_ENTRE_GRUPOS_MS;
    };

    salida.push({
      tipo: 'mensaje',
      clave: mensaje.messageId,
      mensaje,
      lado,
      primeroDelGrupo: !mismoGrupo(anterior, mensaje),
      ultimoDelGrupo: !siguiente || !mismoGrupo(mensaje, siguiente),
    });
  });

  return salida;
}

/** La hora corta de un mensaje: «14:05». */
export function horaCorta(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}
