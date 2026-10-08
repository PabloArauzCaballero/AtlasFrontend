/**
 * El Nivel Atlas, sin pantalla: se mide en PUNTOS de experiencia, 1 por cada boliviano comprado con Atlas.
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
  PREFERENTE: 'corona',
};

/** El icono de cada uno de los doce niveles; uno que la app no conoce (llega del servidor) cae al de su escalón. */
export const ICONO_DE_ESCALON: Record<string, IconName> = {
  NUEVO: 'chispa',
  EXPLORADOR: 'cohete',
  EN_CONSTRUCCION: 'tendencia',
  CONSTANTE: 'fuego',
  ESTABLECIDO: 'escudo',
  CONFIABLE: 'medalla',
  CONSOLIDADO: 'estrella',
  DESTACADO: 'rayo',
  PREFERENTE: 'corona',
  ELITE: 'diamante',
  LEYENDA: 'sol',
  TITAN: 'diamante',
};

export const iconoDeEscalon = (e: { id?: string; code: TierCode }): IconName => ICONO_DE_ESCALON[e.id ?? e.code] ?? ICONO_DE_NIVEL[e.code];

/** El identificador único de un escalón: el `id` de un backend nuevo o, con uno anterior, su `code`. */
export const idDeEscalon = (e: { id?: string; code: string }): string => e.id ?? e.code;

/**
 * Los mismos doce escalones que `AtlasBackend/src/modules/credit/domain/points-level.ts`; sólo se usan si el backend no
 * los manda. Los cinco cortes originales (0, 500, 2.000, 5.000, 10.000) no se movieron.
 */
const ESCALONES: readonly { id: string; code: TierCode; label: string; from: number }[] = [
  { id: 'NUEVO', code: 'NUEVO', label: 'Nuevo', from: 0 },
  { id: 'EXPLORADOR', code: 'NUEVO', label: 'Explorador', from: 100 },
  { id: 'EN_CONSTRUCCION', code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 500 },
  { id: 'CONSTANTE', code: 'EN_CONSTRUCCION', label: 'Constante', from: 1_000 },
  { id: 'ESTABLECIDO', code: 'ESTABLECIDO', label: 'Establecido', from: 2_000 },
  { id: 'CONFIABLE', code: 'ESTABLECIDO', label: 'Confiable', from: 3_500 },
  { id: 'CONSOLIDADO', code: 'CONSOLIDADO', label: 'Consolidado', from: 5_000 },
  { id: 'DESTACADO', code: 'CONSOLIDADO', label: 'Destacado', from: 7_500 },
  { id: 'PREFERENTE', code: 'PREFERENTE', label: 'Preferente', from: 10_000 },
  { id: 'ELITE', code: 'PREFERENTE', label: 'Élite', from: 15_000 },
  { id: 'LEYENDA', code: 'PREFERENTE', label: 'Leyenda', from: 25_000 },
  { id: 'TITAN', code: 'PREFERENTE', label: 'Titán Atlas', from: 50_000 },
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
    level: { id: actual.id, code: actual.code, label: actual.label, index: indice + 1, of: ESCALONES.length, points: puntos },
    nextLevel: siguiente ? { id: siguiente.id, code: siguiente.code, label: siguiente.label, from: siguiente.from, pointsMissing: siguiente.from - puntos } : null,
    levelLadder: ESCALONES.map((e) => ({ ...e, reached: puntos >= e.from })),
  };
}

/** Puntos con separador de miles, como se leen en Bolivia: 2.000, no 2000. */
export const formatoPuntos = (n: number) => Math.max(0, Math.round(n)).toLocaleString('es-BO').replace(/,/g, '.');

/** Los puntos en los que empieza el escalón actual: el extremo izquierdo de la barra. */
export const desdeDelNivel = (nivel: NivelPorPuntos): number => [...nivel.levelLadder].reverse().find((e) => e.reached)?.from ?? 0;

/**
 * Cuánto de la barra está llena, DENTRO del escalón actual (no sobre el total).
 *
 * Con 1.000 puntos en el escalón de 500 a 2.000 la barra va al 33 %: mide el camino al siguiente nivel, y
 * llenarla según el total haría que subir de nivel pareciera retroceder. En el último nivel está llena.
 */
export function porcentajeDeBarra(nivel: NivelPorPuntos): number {
  if (!nivel.nextLevel) return 100;
  const desde = desdeDelNivel(nivel);
  const hasta = nivel.nextLevel.from;
  if (hasta <= desde) return 100;
  return Math.max(0, Math.min(100, Math.round(((nivel.level.points - desde) / (hasta - desde)) * 100)));
}

/** La frase de lo que falta, en una línea y en PUNTOS. */
export function fraseDeLoQueFalta(nivel: NivelPorPuntos): string {
  if (!nivel.nextLevel) return 'Estás en el nivel más alto.';
  const n = nivel.nextLevel.pointsMissing;
  return `Te ${n === 1 ? 'falta 1 punto' : `faltan ${formatoPuntos(n)} puntos`} para «${nivel.nextLevel.label}». Sumas 1 por cada boliviano que compras.`;
}
