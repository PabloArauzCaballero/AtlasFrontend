/**
 * Puntaje y Calificación, separados (pedido de Pablo, 2026-10-06):
 *
 *  - **Puntaje**: los puntos que se ganan PAGANDO a tiempo, 1 por boliviano. Sólo suben.
 *  - **Calificación**: de 1 a 100, qué tan buen pagador eres.
 *
 * El backend los publica con su nombre (`points`, `rating`); con uno anterior, se derivan de los campos de siempre
 * con la MISMA regla que el servidor (acotado a 1-100), para que la pantalla no diga «0 de 100».
 */
import type { Progress } from '../api/endpoints/credit-line';

export function calificacionDe(progress: Progress): number {
  if (progress.rating) return progress.rating.value;
  const valor = Number.isFinite(progress.score) ? Math.round(progress.score) : 1;
  return Math.min(100, Math.max(1, valor));
}

export function puntajeDe(progress: Progress): { valor: number; racha: number; mejorRacha: number } {
  const p = progress.points;
  if (p) return { valor: p.value, racha: p.currentStreak, mejorRacha: p.bestStreak };
  const { xp, currentStreak, bestStreak } = progress.experience;
  return { valor: xp, racha: currentStreak, mejorRacha: bestStreak };
}

/** Una frase por tramo. No es una política de crédito: describe el número, no decide nada. */
export function fraseDeCalificacion(valor: number): string {
  if (valor >= 80) return 'Pagas muy bien. Sigue así para mantenerla.';
  if (valor >= 60) return 'Vas bien. Pagar siempre a tiempo la sube.';
  if (valor >= 40) return 'Está a mitad de camino. Cada cuota en fecha suma.';
  return 'Recién empieza. Se construye pagando a tiempo tus compras.';
}
