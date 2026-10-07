/**
 * Qué celebrar y cuándo: la lógica de las celebraciones de logros, sin pantalla.
 *
 * Pablo (2026-10-07): «una animación ultra HD al ganar cada insignia o logro, y recomienda CUÁNDO ponerla».
 *
 * ## Cuándo (la recomendación, y por qué)
 *
 * 1. **En el instante del hecho** —cuando la persona termina de pagar o de comprar y vuelve a una pantalla tranquila—.
 *    La recompensa pegada al acto es la que enseña: si llega horas después, ya no se asocia a «pagué a tiempo». Por eso
 *    el pago y la compra avisan (`pedirRevisionDeLogros`) y se mira el progreso al cerrar su pantalla.
 * 2. **Nunca en medio de una tarea.** Ni mientras se paga, se compra, se escribe a soporte o se rellena el alta: una
 *    celebración encima de un formulario es una interrupción, no un premio. Espera a una pantalla tranquila.
 * 3. **Como respaldo, al abrir la app o volver a ella**: lo que se ganó sin que la app estuviera delante (una cuota que
 *    el sistema dio por pagada, la antigüedad que cumple un mes) se celebra la siguiente vez que se mira.
 * 4. **Poco y bien**: como máximo cuatro por vez, de menor a mayor rango y terminando por el cambio de nivel, que es el
 *    clímax. El resto se anota como visto y se resume en una línea; diez trofeos seguidos dejan de ser un premio.
 *
 * ## La primera vez no se celebra el pasado
 *
 * Sin registro previo en el teléfono, lo que ya estaba ganado se anota en silencio: una cuenta con seis trofeos no
 * debe recibir seis fiestas el día que instala la versión. Para revivirlos, tocar el trofeo en «Logros».
 */
import type { Badge, BadgeRank, Progress } from '../api/endpoints/credit-line';
import { idDeEscalon, nivelPorPuntos } from './nivel';
import { rangoDe } from '../ui/trofeo';

/** Lo que el teléfono recuerda haber celebrado ya. */
export type Vistos = { insignias: string[]; nivel: string | null };

export type Logro =
  | { tipo: 'insignia'; insignia: Badge; rango: BadgeRank; coleccion: { ganadas: number; total: number } | null; siguiente: Badge | null }
  | {
      tipo: 'nivel';
      nivel: { id: string; label: string; index: number; of: number };
      rango: BadgeRank;
      siguiente: { label: string; pointsMissing: number; porcentaje: number } | null;
    };

export const MAXIMO_POR_VEZ = 4;

/** Las colecciones, en el orden en que se enseñan: de lo que se hace primero a lo que se acumula. */
export const NOMBRE_COLECCION: Readonly<Record<string, string>> = {
  compras: 'Compras',
  pagos: 'Pagos',
  rachas: 'Rachas',
  dinero: 'Dinero a tiempo',
  estilo: 'Estilo de pago',
  cuenta: 'Tu cuenta',
  coleccion: 'Coleccionista',
};

const ORDEN: Record<BadgeRank, number> = { bronce: 0, plata: 1, oro: 2, platino: 3, diamante: 4 };

/** El rango visual de un nivel: los primeros peldaños son bronce y el último, diamante. */
export function rangoDeNivel(index: number): BadgeRank {
  if (index <= 3) return 'bronce';
  if (index <= 6) return 'plata';
  if (index <= 8) return 'oro';
  if (index <= 10) return 'platino';
  return 'diamante';
}

/** La instantánea de lo que hay ganado ahora, para guardarla como «visto». */
export function instantanea(progress: Progress): Vistos {
  const nivel = nivelPorPuntos(progress).level;
  return { insignias: progress.experience.badges.filter((b) => b.earned).map((b) => b.code), nivel: idDeEscalon(nivel) };
}

/** La siguiente de la misma colección que está más cerca de ganarse; las secretas no se anticipan. */
function siguienteDeLaColeccion(badges: readonly Badge[], ganada: Badge): Badge | null {
  const candidatas = badges.filter((b) => !b.earned && !b.secret && b.category === ganada.category && b.code !== ganada.code);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, b) => (b.current / b.target > mejor.current / mejor.target ? b : mejor));
}

export function logroDeInsignia(progress: Progress, insignia: Badge): Logro {
  const badges = progress.experience.badges;
  const deLaColeccion = insignia.category ? badges.filter((b) => b.category === insignia.category) : [];
  return {
    tipo: 'insignia',
    insignia,
    rango: rangoDe(insignia),
    coleccion: deLaColeccion.length > 0 ? { ganadas: deLaColeccion.filter((b) => b.earned).length, total: deLaColeccion.length } : null,
    siguiente: siguienteDeLaColeccion(badges, insignia),
  };
}

function logroDeNivel(progress: Progress): Logro {
  const n = nivelPorPuntos(progress);
  const desde = [...n.levelLadder].reverse().find((e) => e.reached)?.from ?? 0;
  const siguiente = n.nextLevel
    ? {
        label: n.nextLevel.label,
        pointsMissing: n.nextLevel.pointsMissing,
        porcentaje: Math.round(((n.level.points - desde) / Math.max(1, n.nextLevel.from - desde)) * 100),
      }
    : null;
  return { tipo: 'nivel', nivel: { id: idDeEscalon(n.level), label: n.level.label, index: n.level.index, of: n.level.of }, rango: rangoDeNivel(n.level.index), siguiente };
}

/**
 * Lo que toca celebrar ahora y lo que hay que recordar como visto.
 *
 * `vistos === null` (primera vez en este teléfono) no celebra nada y sólo anota.
 */
export function pendientesDeCelebrar(progress: Progress, vistos: Vistos | null): { logros: Logro[]; masSinMostrar: number; siguiente: Vistos } {
  const ahora = instantanea(progress);
  if (!vistos) return { logros: [], masSinMostrar: 0, siguiente: ahora };

  const yaVistas = new Set(vistos.insignias);
  const nuevas = progress.experience.badges
    .filter((b) => b.earned && !yaVistas.has(b.code))
    // De menor a mayor: se sube hacia lo más grande. A igual rango, el orden del catálogo.
    .sort((a, b) => ORDEN[rangoDe(a)] - ORDEN[rangoDe(b)]);

  const escalera = nivelPorPuntos(progress).levelLadder.map(idDeEscalon);
  const antes = vistos.nivel ? escalera.indexOf(vistos.nivel) : -1;
  const despues = escalera.indexOf(ahora.nivel ?? '');
  // Un nivel que la app no reconoce (o el primer registro de nivel) no se celebra: sólo se anota.
  const subio = antes >= 0 && despues > antes;

  const cupo = MAXIMO_POR_VEZ - (subio ? 1 : 0);
  // Si sobran, se muestran las MÁS grandes (las últimas), no las primeras que llegaron.
  const aMostrar = nuevas.slice(Math.max(0, nuevas.length - cupo));
  const logros: Logro[] = aMostrar.map((b) => logroDeInsignia(progress, b));
  if (subio) logros.push(logroDeNivel(progress));
  return { logros, masSinMostrar: nuevas.length - aMostrar.length, siguiente: ahora };
}

/** ¿La ruta es un sitio tranquilo para celebrar? Nunca encima de una tarea a medias. */
const OCUPADO = [/^\/pagar\//, /^\/pago\//, /^\/compra\//, /^\/soporte(\/|$)/, /^\/escanear(\/|$)/, /^\/editar-perfil/, /^\/cambiar-pin/, /^\/extracto-bancario/];
export const esRutaTranquila = (pathname: string): boolean => !OCUPADO.some((r) => r.test(pathname));
