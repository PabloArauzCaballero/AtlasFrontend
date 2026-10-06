/**
 * El Nivel Atlas, sin pantalla: se mide en PUNTOS, los que se ganan pagando a tiempo (1 por boliviano).
 *
 * Antes salía de la calificación 0-100 y la tarjeta decía «24 de 100» como si fuera un nivel. El nivel es la
 * escalera de los puntos; la Calificación (qué tan buen pagador) es otra cosa y tiene su propia pestaña.
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

/** Los mismos escalones que `AtlasBackend/src/modules/credit/domain/points-level.ts`; sólo se usan si el backend no los manda. */
const ESCALONES: readonly { code: TierCode; label: string; from: number }[] = [
  { code: 'NUEVO', label: 'Nuevo', from: 0 },
  { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 500 },
  { code: 'ESTABLECIDO', label: 'Establecido', from: 2_000 },
  { code: 'CONSOLIDADO', label: 'Consolidado', from: 5_000 },
  { code: 'PREFERENTE', label: 'Preferente', from: 10_000 },
];

export type NivelPorPuntos = {
  level: NonNullable<Progress['level']>;
  nextLevel: NonNullable<Progress['nextLevel']> | null;
  levelLadder: NonNullable<Progress['levelLadder']>;
};

/** El nivel por puntos: el que publica el backend o, con uno anterior, el mismo cálculo sobre `experience.xp`. */
export function nivelPorPuntos(progress: Pick<Progress, 'level' | 'nextLevel' | 'levelLadder' | 'experience' | 'points'>): NivelPorPuntos {
  if (progress.level && progress.levelLadder && progress.nextLevel !== undefined) {
    return { level: progress.level, nextLevel: progress.nextLevel, levelLadder: progress.levelLadder };
  }
  const bruto = progress.points?.value ?? progress.experience?.xp ?? 0;
  const puntos = Number.isFinite(bruto) && bruto > 0 ? Math.floor(bruto) : 0;
  let indice = 0;
  ESCALONES.forEach((e, i) => {
    if (puntos >= e.from) indice = i;
  });
  const actual = ESCALONES[indice]!;
  const siguiente = ESCALONES[indice + 1];
  return {
    level: { code: actual.code, label: actual.label, index: indice + 1, of: ESCALONES.length, points: puntos },
    nextLevel: siguiente ? { code: siguiente.code, label: siguiente.label, from: siguiente.from, pointsMissing: siguiente.from - puntos } : null,
    levelLadder: ESCALONES.map((e) => ({ ...e, reached: puntos >= e.from })),
  };
}

/** Puntos con separador de miles, como se leen en Bolivia: 2.000, no 2000. */
export const formatoPuntos = (n: number) => Math.max(0, Math.round(n)).toLocaleString('es-BO').replace(/,/g, '.');

/**
 * Cuánto de la barra está llena, DENTRO del escalón actual (no sobre el total).
 *
 * Con 1.000 puntos en el escalón de 500 a 2.000 la barra va al 33 %: mide el camino al siguiente nivel, y
 * llenarla según el total haría que subir de nivel pareciera retroceder. En el último nivel está llena.
 */
export function porcentajeDeBarra(nivel: NivelPorPuntos): number {
  if (!nivel.nextLevel) return 100;
  const desde = [...nivel.levelLadder].reverse().find((e) => e.reached)?.from ?? 0;
  const hasta = nivel.nextLevel.from;
  if (hasta <= desde) return 100;
  return Math.max(0, Math.min(100, Math.round(((nivel.level.points - desde) / (hasta - desde)) * 100)));
}

/** La frase de lo que falta, en una línea y en PUNTOS. */
export function fraseDeLoQueFalta(nivel: NivelPorPuntos): string {
  if (!nivel.nextLevel) return 'Estás en el nivel más alto.';
  const n = nivel.nextLevel.pointsMissing;
  return `Te ${n === 1 ? 'falta 1 punto' : `faltan ${formatoPuntos(n)} puntos`} para «${nivel.nextLevel.label}». Los ganas pagando tus compras a tiempo.`;
}
