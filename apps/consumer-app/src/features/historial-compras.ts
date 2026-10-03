/**
 * El historial de compras, sin pantalla: estado legible, filtros y agrupación por mes.
 *
 * Vive aparte para poder probarse sin montar nada: lo que se decide aquí —qué es «al día», qué es «en
 * mora», en qué mes cae una compra— es lo que la persona lee como verdad sobre su deuda.
 */
import type { LoanSummary } from '../api/endpoints/loans';

export type FiltroCompras = 'todas' | 'al_dia' | 'mora' | 'pagadas';

export type EstadoCompra = { texto: string; tono: 'success' | 'danger' | 'info' | 'neutral' };

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Cómo se llama el estado de un crédito para quien lo compró. */
export function estadoDeCompra(loan: Pick<LoanSummary, 'status' | 'daysPastDue'>): EstadoCompra {
  switch (loan.status) {
    case 'paid_off':
      return { texto: 'Pagada', tono: 'success' };
    case 'cancelled':
      return { texto: 'Cancelada', tono: 'neutral' };
    case 'pending_disbursement':
      return { texto: 'En trámite', tono: 'info' };
    case 'written_off':
      return { texto: 'Cerrada', tono: 'neutral' };
    default:
      return loan.daysPastDue > 0 ? { texto: 'En mora', tono: 'danger' } : { texto: 'Al día', tono: 'success' };
  }
}

export function coincideConFiltro(loan: Pick<LoanSummary, 'status' | 'daysPastDue'>, filtro: FiltroCompras): boolean {
  if (filtro === 'todas') return true;
  if (filtro === 'pagadas') return loan.status === 'paid_off';
  if (filtro === 'mora') return loan.status === 'active' && loan.daysPastDue > 0;
  return loan.status === 'active' && loan.daysPastDue <= 0;
}

/** El día en que la compra «ocurrió» para la persona: cuando se desembolsó; si aún no, la primera cuota. */
export function fechaDeCompra(loan: Pick<LoanSummary, 'disbursedAt' | 'firstDueDate'>): string | null {
  return loan.disbursedAt ?? loan.firstDueDate ?? null;
}

export type GrupoDeCompras = { clave: string; titulo: string; compras: LoanSummary[] };

/**
 * Agrupa por mes, el más reciente primero, y dentro de cada mes también el más reciente primero. Lo que no
 * tiene fecha va al final, en su propio grupo, en vez de esconderse o ir arriba.
 */
export function agruparPorMes(loans: readonly LoanSummary[]): GrupoDeCompras[] {
  const conFecha = loans
    .map((loan) => ({ loan, fecha: fechaDeCompra(loan) }))
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  const grupos = new Map<string, GrupoDeCompras>();
  for (const { loan, fecha } of conFecha) {
    const valida = fecha !== null && !Number.isNaN(Date.parse(fecha));
    const fechaDate = valida ? new Date(fecha) : null;
    const clave = fechaDate ? `${fechaDate.getUTCFullYear()}-${String(fechaDate.getUTCMonth() + 1).padStart(2, '0')}` : 'sin-fecha';
    const titulo = fechaDate ? `${MESES[fechaDate.getUTCMonth()]} de ${fechaDate.getUTCFullYear()}` : 'Sin fecha';
    const grupo = grupos.get(clave) ?? { clave, titulo, compras: [] };
    grupo.compras.push(loan);
    grupos.set(clave, grupo);
  }
  const lista = [...grupos.values()];
  // «Sin fecha» siempre al final, aunque la ordenación por texto lo pusiera en otro sitio.
  return [...lista.filter((g) => g.clave !== 'sin-fecha'), ...lista.filter((g) => g.clave === 'sin-fecha')];
}

/** Búsqueda por comercio, sin distinguir mayúsculas ni tildes. */
export function buscarPorComercio(loans: readonly LoanSummary[], texto: string): LoanSummary[] {
  const limpio = quitarTildes(texto.trim().toLowerCase());
  if (!limpio) return [...loans];
  return loans.filter((loan) => quitarTildes((loan.merchant?.displayName ?? '').toLowerCase()).includes(limpio));
}

function quitarTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
