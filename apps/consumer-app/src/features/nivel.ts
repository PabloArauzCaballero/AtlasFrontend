/**
 * El nivel, sin pantalla: el icono de cada escalón y cuánto de la barra de experiencia está llena.
 *
 * Aparte para poder probarlo: el porcentaje de la barra es lo que la persona lee como «cuánto me falta».
 */
import type { IconName } from '../ui/icons';
import type { Progress, TierCode } from '../api/endpoints/credit-line';

export const ICONO_DE_NIVEL: Record<TierCode, IconName> = {
  NUEVO: 'chispa',
  EN_CONSTRUCCION: 'tendencia',
  ESTABLECIDO: 'escudo',
  CONSOLIDADO: 'estrella',
  PREFERENTE: 'estrella',
};

/**
 * Cuánto de la barra está llena, DENTRO del escalón actual (no sobre 100).
 *
 * Con 30 puntos en el escalón de 25 a 50 la barra va al 20 %, no al 30 %: la barra mide el camino al siguiente
 * nivel, y llenarla según el total absoluto haría que subir de nivel pareciera retroceder (la barra se vacía
 * al cruzar el umbral). En el último nivel está llena.
 */
export function porcentajeDeBarra(progress: Pick<Progress, 'score' | 'ladder' | 'nextTier'>): number {
  if (!progress.nextTier) return 100;
  const actual = [...progress.ladder].reverse().find((escalon) => escalon.reached);
  const desde = actual?.from ?? 0;
  const hasta = progress.nextTier.from;
  if (hasta <= desde) return 100;
  return Math.max(0, Math.min(100, Math.round(((progress.score - desde) / (hasta - desde)) * 100)));
}

/** La frase de lo que falta, en una línea. */
export function fraseDeLoQueFalta(progress: Pick<Progress, 'nextTier'>): string {
  if (!progress.nextTier) return 'Estás en el nivel más alto.';
  const n = progress.nextTier.pointsMissing;
  return `Te ${n === 1 ? 'falta' : 'faltan'} ${n} ${n === 1 ? 'punto' : 'puntos'} para «${progress.nextTier.label}».`;
}
