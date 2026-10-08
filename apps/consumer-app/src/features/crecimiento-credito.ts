/**
 * Cuánto puede crecer el crédito de una persona, sin pantalla (pedido de Pablo, 2026-10-07: «cuánto crédito es posible
 * acceder una vez conseguido… en general cuánto puedo aumentar mi capacidad de pedir créditos»).
 *
 * ## De dónde sale
 *
 * De la escalera de CONFIANZA del backend (`RELATIONSHIP_TIERS`): cada escalón de la calificación 1-100 multiplica el
 * tope de quien empieza. El backend publica el tope de cada escalón (`creditCeiling`); la app no tiene escrito ningún
 * importe. Con un backend que todavía no lo manda se enseña cuántas VECES crece, que sí viene desde siempre.
 *
 * ## Lo que NO es
 *
 * No es una promesa de límite. El límite real es el menor entre este tope y lo que la persona puede pagar (su extracto),
 * sube por pasos y lo decide el motor. Por eso todo se dice con «hasta». Y lo que mueve esta escalera es la CALIFICACIÓN
 * —pagar a tiempo—, no los puntos de experiencia: comprar más no sube el crédito.
 */
import type { Progress } from '../api/endpoints/credit-line';
import { formatoPuntos } from './nivel';

export type PeldanoDeCredito = {
  code: string;
  label: string;
  /** Calificación desde la que se alcanza. */
  from: number;
  reached: boolean;
  actual: boolean;
  /** Tope en dinero, o `null` si el backend no lo publica. */
  techo: number | null;
  veces: number;
  /** Ancho de su barra, sobre el escalón más alto (0-100). */
  porcentaje: number;
};

export type CrecimientoDeCredito = {
  peldanos: PeldanoDeCredito[];
  /** Hay importes (backend nuevo) o sólo multiplicadores. */
  conImportes: boolean;
  techoHoy: number | null;
  techoSiguiente: number | null;
  /** Cuánto más crédito admite el siguiente escalón. */
  aumento: number | null;
  techoMaximo: number | null;
  vecesHoy: number;
  vecesSiguiente: number | null;
  vecesMaximo: number;
  siguiente: { label: string; from: number; pointsMissing: number } | null;
};

export function crecimientoDeCredito(progress: Pick<Progress, 'tier' | 'nextTier' | 'ladder'>): CrecimientoDeCredito {
  const { tier, nextTier, ladder } = progress;
  const vecesMaximo = Math.max(1, ...ladder.map((e) => e.multiplier));
  // Importes sólo si TODOS los escalones lo traen: media escalera en bolivianos y media en «veces» no se puede leer.
  const conImportes = ladder.length > 0 && ladder.every((e) => typeof e.creditCeiling === 'number' && e.creditCeiling > 0);
  const techo = (valor: number | undefined) => (conImportes && typeof valor === 'number' ? valor : null);

  const peldanos = ladder.map((e) => ({
    code: e.code,
    label: e.label,
    from: e.from,
    reached: e.reached,
    actual: e.code === tier.code,
    techo: techo(e.creditCeiling),
    veces: e.multiplier,
    porcentaje: Math.round((e.multiplier / vecesMaximo) * 100),
  }));

  const techoHoy = techo(peldanos.find((p) => p.actual)?.techo ?? tier.creditCeiling);
  const techoSiguiente = nextTier ? techo(peldanos.find((p) => p.code === nextTier.code)?.techo ?? nextTier.creditCeiling) : null;
  const techoMaximo = conImportes ? Math.max(...peldanos.map((p) => p.techo ?? 0)) : null;

  return {
    peldanos,
    conImportes,
    techoHoy,
    techoSiguiente,
    aumento: techoHoy !== null && techoSiguiente !== null ? Math.max(0, techoSiguiente - techoHoy) : null,
    techoMaximo,
    vecesHoy: tier.multiplier,
    vecesSiguiente: nextTier?.multiplier ?? null,
    vecesMaximo,
    siguiente: nextTier ? { label: nextTier.label, from: nextTier.from, pointsMissing: nextTier.pointsMissing } : null,
  };
}

/** Bolivianos enteros, como se dice un tope: «Bs 2.250», sin centavos. El espacio es duro: un importe no se parte. */
export const formatoBs = (n: number) => `Bs ${formatoPuntos(n)}`;

/** «1,5 veces», «6 veces»: con coma decimal, como se escribe en Bolivia. */
export const formatoVeces = (n: number) => `×${String(Math.round(n * 10) / 10).replace('.', ',')}`;

/** Lo que falta para el siguiente escalón, en una línea. */
export function fraseDelSiguienteSalto(c: CrecimientoDeCredito): string {
  if (!c.siguiente) return 'Ya estás en el escalón más alto: tienes el tope máximo de Atlas.';
  const n = c.siguiente.pointsMissing;
  const falta = n <= 0 ? 'Ya tienes la calificación' : n === 1 ? 'Te falta 1 punto de calificación' : `Te faltan ${n} puntos de calificación`;
  return `${falta} para «${c.siguiente.label}». Se sube pagando a tiempo.`;
}
