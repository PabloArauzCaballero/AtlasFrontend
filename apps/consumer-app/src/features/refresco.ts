/**
 * Cuando hay que volver a pedir los datos del dinero: compras, cuotas, linea, puntos, movimientos y avisos.
 *
 * ## Por que existe (Pablo, 2026-10-09: «al hacer un pago tenés que cerrar la app para que recarguen las compras y
 * los puntos»)
 *
 * La app no tiene cache de consultas: cada pantalla pide lo suyo al montarse y lo guarda en su estado. Las pestañas
 * quedan montadas, asi que desde el #92 se recargaba al volver a la pantalla (`useAlVolver`). No bastaba por tres
 * motivos que se suman:
 *
 *  1. **Nada avisaba de una operacion de dinero.** Avisar un pago, confirmar una compra o que el comercio confirme el
 *     inicial no le decia nada a Inicio ni a Pagos: se enteraban solo si la persona cambiaba de pantalla.
 *  2. **El servidor confirma en diferido.** El prestamo, la linea disponible y los puntos cambian cuando el comercio
 *     acepta o confirma el pago y el desembolso termina, segundos DESPUES de la respuesta que ve la app. La unica
 *     recarga —al volver a Inicio— llegaba antes que el cambio, y la siguiente no llegaba nunca mientras la persona
 *     se quedara mirando la pantalla. Cerrar y abrir la app era lo unico que volvia a pedirlo todo.
 *  3. **Tirar hacia abajo no recargaba** en Inicio (solo el perfil) y no existia en Pagos, Compras, Credito y Cuota.
 *
 * ## La regla
 *
 * - Tras una operacion de dinero (`avisarCambioDeDinero`): se recarga YA y se repasa a los 3, 10 y 30 s, para alcanzar
 *   la confirmacion diferida del servidor. Un aviso nuevo antes de terminar reinicia los repasos, no los duplica.
 * - Al volver a la pantalla, al volver la app al frente y cada minuto con la pantalla a la vista: se recarga, pero
 *   nunca dos veces en menos de 5 s (`crearLimitador`), para no martillar el servidor al cambiar de pestaña.
 * - Tirar hacia abajo recarga siempre.
 */

/** Tras una operacion de dinero: ahora y estos repasos, para alcanzar lo que el servidor confirma en diferido. */
export const REPASOS_TRAS_CAMBIO_MS = [0, 3_000, 10_000, 30_000] as const;
/** Lo minimo entre dos recargas que no pidio nadie expresamente (foco, primer plano, latido). */
export const ESPERA_MINIMA_MS = 5_000;
/** Con la pantalla a la vista y la app en primer plano, cada cuanto se vuelve a pedir. */
export const LATIDO_EN_PANTALLA_MS = 60_000;

type Oyente = () => void;
const oyentes = new Set<Oyente>();
let repasos: ReturnType<typeof setTimeout>[] = [];

function emitir(): void {
  for (const oyente of [...oyentes]) {
    try {
      oyente();
    } catch {
      /* una pantalla que falla al recargar no impide que recarguen las demas */
    }
  }
}

/**
 * Una operacion de dinero acaba de salir bien: pago inicial avisado, aviso de pago de una cuota, compra confirmada,
 * inicial confirmado por el comercio. Todas las pantallas suscritas recargan ahora y en los repasos.
 */
export function avisarCambioDeDinero(): void {
  cancelarRepasos();
  for (const espera of REPASOS_TRAS_CAMBIO_MS) {
    if (espera === 0) {
      emitir();
      continue;
    }
    const temporizador = setTimeout(() => {
      repasos = repasos.filter((t) => t !== temporizador);
      emitir();
    }, espera);
    repasos.push(temporizador);
  }
}

export function suscribirCambioDeDinero(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Al cerrar sesion: ningun repaso pendiente puede salir con la sesion de otro. */
export function cancelarRepasos(): void {
  repasos.forEach(clearTimeout);
  repasos = [];
}

/** El limite de las recargas automaticas: nunca dos en menos de `minimoMs`. Las forzadas siempre pasan. */
export function crearLimitador(minimoMs = ESPERA_MINIMA_MS, ahora: () => number = Date.now) {
  let ultima = Number.NEGATIVE_INFINITY;
  return {
    /** Si se puede recargar ahora. Si si, anota la hora. */
    puede(forzada = false): boolean {
      const t = ahora();
      if (!forzada && t - ultima < minimoMs && t >= ultima) return false;
      ultima = t;
      return true;
    },
    /** Una recarga que ocurrio por otro camino (la carga al montar) tambien cuenta. */
    anotar(): void {
      ultima = ahora();
    },
  };
}
