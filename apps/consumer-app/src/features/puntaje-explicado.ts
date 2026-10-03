/**
 * «Por qué tienes este puntaje», sin pantalla: las frases que se leen y el orden en que se cuentan.
 *
 * Aparte para probarlo: lo que se escribe aquí es lo que la persona lee como la razón de su nivel, y una cuenta mal
 * dicha («suma 41» cuando el nivel es 24) destruye la confianza que el puntaje existe para dar.
 */
import type { Progress } from '../api/endpoints/credit-line';

/** «45 % de 50 = 22,5 puntos»: la cuenta de una parte, con números de la persona. */
export function cuentaDeUnaParte(parte: Progress['components'][number]): string {
  const peso = Math.round(parte.weight * 100);
  return `${parte.value} de 100 × ${peso} % = ${formatoPuntos(parte.points)} pts`;
}

/** Un punto decimal sólo cuando hace falta: «22,5» pero «20». */
export function formatoPuntos(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace('.', ',');
}

/**
 * La frase del resultado. Sin topes: «Suma 31 puntos: estás en Nivel 2». Con tope: dice cuánto SUMABA y por qué el
 * resultado es menor, para que nadie crea que la cuenta está mal.
 */
export function fraseDelResultado(progress: Pick<Progress, 'score' | 'rawScore' | 'caps' | 'tier'>): string {
  const { score, rawScore, caps, tier } = progress;
  if (caps.length === 0 || rawScore === score) return `Suma ${score} puntos: estás en el nivel «${tier.label}».`;
  return `Tus partes suman ${rawScore}, pero hay un tope: tu nivel cuenta ${score} y estás en «${tier.label}».`;
}

/** La experiencia en una línea: lo que suma, de dónde sale y qué NO suma. */
export function fraseDeExperiencia(xp: number): string {
  if (xp === 0) return 'Cada boliviano que pagues a tiempo suma 1 punto. Comprar no suma: sólo pagar.';
  return `${xp.toLocaleString('es-BO')} puntos: 1 por cada boliviano que pagaste a tiempo.`;
}

/** Cuánto falta para una insignia, en texto. */
export function avanceDeInsignia(insignia: Pick<Progress['experience']['badges'][number], 'earned' | 'current' | 'target'>): string {
  if (insignia.earned) return 'Ganada';
  return `${insignia.current.toLocaleString('es-BO')} de ${insignia.target.toLocaleString('es-BO')}`;
}
