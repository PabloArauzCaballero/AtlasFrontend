/**
 * Lo que la app dice de la tarjeta del cliente.
 *
 * La tarjeta es presentación y estatus, como en un banco: Normal, Silver, Gold, Premium, Black. Se gana sola al subir de
 * nivel Atlas, o la puede dar el personal. NUNCA cambia el límite de crédito, y las frases lo dicen para que nadie
 * espere dinero de un color.
 */
import type { CardTheme, CardTier, CardView } from '../api/endpoints/credit-line';

export const AVISO_SIN_LIMITE = 'La tarjeta es tu estatus en Atlas: no cambia tu límite de crédito.';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** De dónde viene la tarjeta, en una frase para la persona. */
export function fraseDeOrigen(card: CardView, nivelLabel: string): string {
  if (card.source === 'AUTOMATICA') return `La ganaste por tu nivel ${nivelLabel}. Si subes de nivel, cambia sola.`;
  const hasta = card.manual?.expiresAt ? `hasta el ${fecha(card.manual.expiresAt)}` : 'sin fecha de vencimiento';
  return `Atlas te la dio ${hasta}. Tu nivel ${nivelLabel} te corresponde la ${card.automatic.label}.`;
}

/** La siguiente tarjeta del escalón y qué nivel la desbloquea; null en la última. */
export function siguienteTarjeta(
  card: CardView,
  ladder: readonly { code: string; label: string; from: number }[],
): { tier: CardTier; nivelLabel: string; desde: number | null } | null {
  const siguiente = card.catalog.find((t) => t.displayOrder > card.displayOrder);
  if (!siguiente) return null;
  const nivel = ladder.find((n) => n.code === siguiente.levelCode);
  return { tier: siguiente, nivelLabel: nivel?.label ?? siguiente.levelCode, desde: nivel?.from ?? null };
}

/** Una tarjeta del escalón está desbloqueada si su orden no pasa de la actual. */
export const estaDesbloqueada = (tier: CardTier, card: CardView): boolean => tier.displayOrder <= card.displayOrder;

export function etiquetaAccesible(tier: Pick<CardTier, 'label' | 'theme'>): string {
  return `Tarjeta ${tier.label}, acabado ${tier.theme.finish}`;
}

/**
 * Cuánto brilla una tarjeta, traducido a lo que se pinta (Pablo, 2026-10-07: «de menos a más fulgor… eso que brilla y
 * la hace ver ultra exclusiva»). El número 0-1 viene del backend (`theme.glow`); aquí sólo se reparte entre los efectos.
 * Sin número (backend anterior) todo vale lo de antes: sin halo, sin chispas y con el barrido una sola vez.
 */
export type Fulgor = {
  nivel: number;
  /** Halo del color de la tarjeta alrededor de ella. */
  halo: { opacidad: number; radio: number };
  /** La luz de ambiente de arriba a la izquierda. */
  ambiente: number;
  /** La banda de luz que cruza la tarjeta: qué tan blanca es y cada cuánto vuelve (`null` = sólo al aparecer). */
  barrido: { opacidad: number; pausaMs: number | null };
  /** Cuántos destellos pequeños titilan sobre el metal. */
  chispas: number;
};

export function fulgorDe(theme: Pick<CardTheme, 'glow'>): Fulgor {
  const bruto = theme.glow;
  const nivel = typeof bruto === 'number' && Number.isFinite(bruto) ? Math.min(1, Math.max(0, bruto)) : 0;
  // Por debajo de este fulgor la tarjeta no se mueve sola: la primera de la escalera queda sobria, y eso hace que las demás se noten.
  const vivo = nivel >= 0.3;
  return {
    nivel,
    halo: { opacidad: nivel === 0 ? 0 : 0.18 + nivel * 0.62, radio: 8 + nivel * 26 },
    ambiente: 0.2 + nivel * 0.16,
    barrido: { opacidad: 0.34 + nivel * 0.36, pausaMs: vivo ? Math.round(9000 - nivel * 6500) : null },
    chispas: vivo ? Math.max(0, Math.round(nivel * 5) - 1) : 0,
  };
}
