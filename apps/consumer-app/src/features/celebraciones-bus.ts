/**
 * El aviso entre pantallas y el anfitrión de las celebraciones, sin contexto de React.
 *
 * Una pantalla de pago o de compra no sabe nada de trofeos: sólo dice «acabo de ocurrir algo que puede dar un logro»
 * (`pedirRevisionDeLogros`) y el anfitrión, montado una vez en el layout, mira el progreso cuando haya un sitio tranquilo.
 * Quien muestra los logros (la vitrina) pide repetir uno (`repetirCelebracion`) por el mismo camino.
 */
import type { Logro } from './celebraciones';

type Oyente = { revisar: () => void; repetir: (logro: Logro) => void };

const oyentes = new Set<Oyente>();

export function suscribirCelebraciones(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Algo acaba de pasar que pudo dar un logro: míralo en cuanto se pueda. */
export const pedirRevisionDeLogros = () => oyentes.forEach((o) => o.revisar());

/** Vuelve a celebrar un logro ya ganado (tocar un trofeo en la vitrina). */
export const repetirCelebracion = (logro: Logro) => oyentes.forEach((o) => o.repetir(logro));
