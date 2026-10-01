/**
 * Subir la agenda ENTERA sin que un fallo se coma contactos en silencio.
 *
 * ## Que fallaba
 *
 * La subida mandaba los lotes en serie y, ante el primer error, se paraba: `subirAgenda(...).catch(() => 0)`.
 * Un corte de red en el lote 3 de 10 dejaba siete lotes sin subir, y nadie se enteraba. Peor: el
 * servidor valida el lote entero, asi que UNA ficha que no cumpliera el contrato tumbaba las otras
 * cien con un 400 que tampoco veia nadie. La persona daba «permitir» a todo y en la base quedaba una
 * agenda a medias.
 *
 * ## Que hace ahora
 *
 *  - **Fallo transitorio** (red, plazo, 5xx, 429): reintenta el MISMO lote con espera creciente. Es
 *    seguro repetir: el servidor reconoce cada contacto por su identificador y actualiza en vez de
 *    duplicar.
 *  - **Rechazo por validacion** (400/422 que no sea el consentimiento): parte el lote por la mitad y
 *    reintenta cada mitad hasta aislar la ficha concreta. Se pierde esa ficha, no cien.
 *  - **Todo lo demas** (sesion caducada, sin consentimiento, dispositivo no vinculado): corta. Insistir
 *    no arregla nada y gasta la red de la persona.
 *  - **El cierre**: el servidor solo marca la sincronizacion como completa cuando llega el lote con
 *    `isFinalBatch`. Si la ultima ficha del orden fue la rechazada, el cierre se manda con otra ya
 *    aceptada (reenviarla no duplica) para que la ejecucion no se quede en `partial` para siempre.
 *
 * Es puro: recibe `enviar` y `esperar` en vez de importar el cliente HTTP, para poder probar los tres
 * caminos sin red.
 */
import { AtlasApiError } from '../api/errors';
import { trocear, TAMANO_LOTE_AGENDA, type ContactoParaEnviar } from './rastreo';

export type EnviarLote = (lote: ContactoParaEnviar[], esUltimo: boolean) => Promise<void>;

export type ResultadoDeSubida = {
  /** Fichas que el servidor acepto. */
  subidos: number;
  /** Fichas concretas que el servidor rechazo aun aisladas. */
  rechazados: number;
  /** Fichas que no se intentaron o no llegaron por un corte que no se pudo reintentar. */
  pendientes: number;
  /** Si el servidor recibio el cierre. */
  cerrada: boolean;
  /** Por que se corto, si se corto. */
  corte: string | null;
};

type Opciones = {
  tamano?: number;
  /** Reintentos por lote ante un fallo transitorio. */
  reintentos?: number;
  esperar?: (ms: number) => Promise<void>;
};

const ESPERAS_MS = [1_000, 3_000, 8_000];
const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

type Clase = 'transitorio' | 'rechazo' | 'corte';

/** Que se hace con un fallo. El consentimiento es un 422 pero NO es una ficha mala: es todo el lote. */
export function clasificarFallo(error: unknown): Clase {
  if (!(error instanceof AtlasApiError)) return 'transitorio';
  if (error.kind === 'network' || error.kind === 'timeout' || error.kind === 'server' || error.kind === 'unavailable' || error.kind === 'rate_limited') {
    return 'transitorio';
  }
  if (error.kind === 'validation') {
    return error.code.startsWith('CONSENT_NOT_GRANTED') || error.message.startsWith('CONSENT_NOT_GRANTED') ? 'corte' : 'rechazo';
  }
  return 'corte';
}

export async function subirAgendaPorLotes(
  contactos: readonly ContactoParaEnviar[],
  enviar: EnviarLote,
  opciones: Opciones = {},
): Promise<ResultadoDeSubida> {
  const esperar = opciones.esperar ?? dormir;
  const reintentos = opciones.reintentos ?? ESPERAS_MS.length;

  const resultado: ResultadoDeSubida = { subidos: 0, rechazados: 0, pendientes: 0, cerrada: false, corte: null };
  const lotes = trocear(contactos, opciones.tamano ?? TAMANO_LOTE_AGENDA);
  // En un objeto y no en dos `let`: se escriben desde funciones anidadas y TypeScript, que no lo ve,
  // estrecharia las variables a `null`/`false` en el punto de lectura.
  const memoria: { ultimoAceptado: ContactoParaEnviar | null; cerrar: boolean } = { ultimoAceptado: null, cerrar: false };

  /** Manda UN lote con reintentos. `true` si el servidor lo acepto. */
  const intentar = async (lote: ContactoParaEnviar[], esUltimo: boolean): Promise<'ok' | 'rechazo' | 'corte'> => {
    for (let intento = 0; ; intento += 1) {
      try {
        await enviar(lote, esUltimo);
        return 'ok';
      } catch (error) {
        const clase = clasificarFallo(error);
        if (clase === 'rechazo') return 'rechazo';
        if (clase === 'corte' || intento >= reintentos) {
          resultado.corte = error instanceof AtlasApiError ? `${error.code}` : 'FALLO_DE_RED';
          return 'corte';
        }
        await esperar(ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)] as number);
      }
    }
  };

  /** Un lote y, si lo rechazan, sus mitades. Devuelve `false` si hay que cortar todo. */
  const procesar = async (lote: ContactoParaEnviar[], esUltimo: boolean): Promise<boolean> => {
    const estado = await intentar(lote, esUltimo);
    if (estado === 'ok') {
      resultado.subidos += lote.length;
      memoria.ultimoAceptado = lote[lote.length - 1] ?? memoria.ultimoAceptado;
      if (esUltimo) resultado.cerrada = true;
      return true;
    }
    if (estado === 'corte') return false;

    // Rechazo por validacion: se aisla la ficha.
    if (lote.length === 1) {
      resultado.rechazados += 1;
      if (esUltimo) memoria.cerrar = true;
      return true;
    }
    const medio = Math.ceil(lote.length / 2);
    if (!(await procesar(lote.slice(0, medio), false))) return false;
    return procesar(lote.slice(medio), esUltimo);
  };

  for (const [indice, lote] of lotes.entries()) {
    const esUltimo = indice === lotes.length - 1;
    if (!(await procesar(lote, esUltimo))) {
      // Lo que no se llego a intentar, mas el lote que fallo, queda pendiente.
      resultado.pendientes = contactos.length - resultado.subidos - resultado.rechazados;
      return resultado;
    }
  }

  // La ultima ficha del orden fue la rechazada: el cierre viaja con la ultima aceptada.
  if (memoria.cerrar && !resultado.cerrada && memoria.ultimoAceptado) {
    const estado = await intentar([memoria.ultimoAceptado], true);
    resultado.cerrada = estado === 'ok';
  }

  return resultado;
}
