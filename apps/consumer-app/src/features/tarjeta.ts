/**
 * Lo que la app dice de la tarjeta del cliente.
 *
 * La tarjeta es presentación y estatus, como en un banco: Normal, Silver, Gold, Premium, Black. Se gana sola al subir de
 * nivel Atlas, o la puede dar el personal. NUNCA cambia el límite de crédito, y las frases lo dicen para que nadie
 * espere dinero de un color.
 */
import type { CardTier, CardView, Progress } from '../api/endpoints/credit-line';

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
export function siguienteTarjeta(card: CardView, ladder: Progress['ladder']): { tier: CardTier; nivelLabel: string } | null {
  const siguiente = card.catalog.find((t) => t.displayOrder > card.displayOrder);
  if (!siguiente) return null;
  const nivel = ladder.find((n) => n.code === siguiente.levelCode);
  return { tier: siguiente, nivelLabel: nivel?.label ?? siguiente.levelCode };
}

/** Una tarjeta del escalón está desbloqueada si su orden no pasa de la actual. */
export const estaDesbloqueada = (tier: CardTier, card: CardView): boolean => tier.displayOrder <= card.displayOrder;

export function etiquetaAccesible(tier: Pick<CardTier, 'label' | 'theme'>): string {
  return `Tarjeta ${tier.label}, acabado ${tier.theme.finish}`;
}
