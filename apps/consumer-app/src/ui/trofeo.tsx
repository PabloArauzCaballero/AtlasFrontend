/**
 * El RANGO de una insignia —qué tan difícil es— y cómo se nombra. El dibujo vive en `medalla.tsx` y `escudo-de-nivel.tsx`.
 *
 * ## El rango ya no es un color (2026-10-15)
 *
 * Hasta hoy cada rango era un metal: bronce, plata, oro, platino y diamante, cada uno con su paleta en hex. Pablo: «más
 * premium, más serio, y con el MISMO estilo de colores» que el resto de la app. Cinco metales de colores eran cinco
 * paletas ajenas a la marca. Ahora todas las insignias son del mismo esmalte de marca (`theme/esmalte.ts`) y el rango se
 * lee como en una condecoración: por las MARCAS grabadas (de una a cinco) y por su nombre, escrito. Los nombres se quedan
 * porque son la escala que la persona ya conoce; lo que se fue es el color.
 *
 * La copa (`Trofeo`) que vivía aquí ya no la usaba nadie desde que el logro pasó a ser una medalla: se quitó.
 */
import type { Badge, BadgeRank } from '../api/endpoints/credit-line';
import { ICON_NAMES, type IconName } from './icons';

export type Rango = BadgeRank;

/** Cómo se nombra cada rango y cuántas marcas lleva grabadas: la dificultad se lee, no se pinta. */
export const RANGO: Record<Rango, { nombre: string; numeral: string; marcas: number }> = {
  bronce: { nombre: 'Bronce', numeral: 'I', marcas: 1 },
  plata: { nombre: 'Plata', numeral: 'II', marcas: 2 },
  oro: { nombre: 'Oro', numeral: 'III', marcas: 3 },
  platino: { nombre: 'Platino', numeral: 'IV', marcas: 4 },
  diamante: { nombre: 'Diamante', numeral: 'V', marcas: 5 },
};

/** Del más fácil al más difícil. */
export const ORDEN_DE_RANGO: Record<Rango, number> = { bronce: 0, plata: 1, oro: 2, platino: 3, diamante: 4 };

/** Qué tan difícil es cada logro, para un backend que aún no manda `rank`. Uno desconocido es de plata. */
const RANGO_DE: Record<string, Rango> = {
  primera_compra: 'bronce',
  primer_pago: 'bronce',
  identidad: 'bronce',
  racha_3: 'plata',
  compra_cerrada: 'plata',
  cien_bs: 'plata',
  racha_6: 'oro',
  mil_bs: 'oro',
  un_ano: 'oro',
  cinco_mil_bs: 'platino',
};

export const rangoDe = (insignia: Pick<Badge, 'code' | 'rank'>): Rango => insignia.rank ?? RANGO_DE[insignia.code] ?? 'plata';

export const iconoDe = (nombre: string): IconName => ((ICON_NAMES as readonly string[]).includes(nombre) ? (nombre as IconName) : 'estrella');
