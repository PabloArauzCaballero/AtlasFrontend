/**
 * El ACABADO de la tarjeta de membresía: de un color del catálogo a una superficie mate y sobria.
 *
 * El catálogo del backend manda el color de cada categoría (Normal, Silver, Gold, Premium, Black), y a
 * veces muy saturado: un dorado de joyería, un verde fosforescente. La app no pinta ese color tal
 * cual: conserva su MATIZ (sigue siendo «la dorada», «la negra») y le baja la viveza, como el metal
 * anodizado de una tarjeta de banco de verdad. Pedido de Pablo (2026-10-09): tarjetas sobrias, nada
 * fosforescente.
 */
import { aOklch, desdeOklch, tintaSobre } from './color';

export type Acabado = {
  /** Las dos paradas de la cara: casi planas, apenas una luz de arriba a la izquierda. */
  cara: readonly [string, string];
  /** La tinta del texto y los iconos de la tarjeta, la que mejor se lee sobre la cara. */
  tinta: string;
  /** El canto: una linea de la misma tinta, muy tenue. */
  canto: string;
};

export function acabadoDeTarjeta(colorDelCatalogo: string | undefined): Acabado {
  const o = aOklch(colorDelCatalogo && /^#[0-9a-f]{6}$/i.test(colorDelCatalogo) ? colorDelCatalogo : '#8E8E93');
  // La luminosidad se acota para que ninguna tarjeta sea blanca de papel ni un agujero negro; el croma se recorta a un
  // tercio (y nunca pasa de 0,06): el color se reconoce sin brillar.
  const l = Math.min(0.78, Math.max(0.24, o.l));
  const c = Math.min(o.c * 0.35, 0.06);
  const base = desdeOklch({ l, c, h: o.h });
  const tinta = tintaSobre(base, '#FFFFFF', '#1D1D1F');
  return {
    cara: [desdeOklch({ l: Math.min(0.86, l + 0.04), c, h: o.h }), desdeOklch({ l: Math.max(0.18, l - 0.04), c, h: o.h })],
    tinta,
    canto: tinta === '#FFFFFF' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
  };
}
