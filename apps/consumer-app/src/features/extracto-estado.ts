/**
 * En qué punto está el extracto bancario de la persona, dicho para Perfil.
 *
 * Perfil pedía «Sube tu extracto bancario» en dos sitios (el índice de crédito sin calcular y «Recalcular mi
 * línea») aunque la persona YA lo hubiera subido: con un extracto en revisión, el motor todavía no lo evaluó y
 * lo que corresponde decir es «pendiente de evaluar», no volver a pedirlo. Sólo si no hay NADA subido se pide.
 *
 * Aparte para poder probarlo: es una decisión de texto con cuatro casos y la pantalla sólo la pinta.
 */
import type { BankStatementReview } from '../api/endpoints/credit-line';

export type EstadoDelExtracto =
  | { tipo: 'sin_subir' }
  | { tipo: 'pendiente'; detalle: string }
  | { tipo: 'aplicado' }
  | { tipo: 'rechazado'; motivo: string };

/** `ultimo` es el más reciente que subió la persona, o `null` si nunca subió ninguno. */
export function estadoDelExtracto(ultimo: Pick<BankStatementReview, 'status' | 'rejectionReason'> | null): EstadoDelExtracto {
  if (!ultimo) return { tipo: 'sin_subir' };
  if (ultimo.status === 'received' || ultimo.status === 'processing') {
    return { tipo: 'pendiente', detalle: 'Tu extracto está pendiente de evaluar. Te avisamos en cuanto esté listo (hasta 24 h).' };
  }
  if (ultimo.status === 'applied') return { tipo: 'aplicado' };
  return { tipo: 'rechazado', motivo: ultimo.rejectionReason ?? 'No pudimos leer ese extracto.' };
}

/** El subtítulo de «Recalcular mi línea», según haya o no un extracto en camino. */
export function subtituloDeRecalcular(estado: EstadoDelExtracto): string {
  switch (estado.tipo) {
    case 'pendiente':
      return 'Tu extracto está pendiente de evaluar (hasta 24 h)';
    case 'rechazado':
      return 'Tu último extracto no se pudo usar: sube otro';
    case 'aplicado':
      return 'Sube un extracto más reciente y la recalculamos en un máximo de 24 h';
    default:
      return 'Sube tu extracto bancario y la recalculamos en un máximo de 24 h';
  }
}
