/**
 * La lógica del historial de la caja, copiada de `AtlasERPFrontend/components/screens/MerchantPosHistoryScreen.tsx`
 * (allí vive dentro de la pantalla y la prueban `tests/unit/pos-historial.test.ts`; aquí se separa
 * del dibujo para poder probarla igual).
 *
 * Pablo (2026-10-08): las solicitudes ya respondidas y los pagos ya verificados —iniciales y de
 * cuota— en UNA lista, de lo más reciente a lo más antiguo, con la sucursal y la caja de cada fila.
 * Filtros de sucursal, caja y fechas; páginas de 20; el total es del filtro entero, que es lo que se
 * compara al cerrar la caja. Filtra y pagina el SERVIDOR: la lista crece cada día.
 */
import type { OpcionSelect } from '@cliente/ui/form-controls';
import type { BadgeTone } from '@cliente/ui/primitives';
import type { FiltroDeHistorial, HistorialDePos, MovimientoDePos } from '@/api/servicios/merchantCreditService';
import { formatBob } from './formato';
import { nombreDeCaja } from './origen-de-caja';

/*
 * La web pinta estas pastillas con los tonos de su `StatusPill`; `Badge` de la app del cliente tiene
 * los mismos cinco (neutral, success, warning, danger, info), así que el tono se copia tal cual.
 */
export type Tono = Extract<BadgeTone, 'success' | 'danger' | 'warning' | 'neutral' | 'info'>;

export const POR_PAGINA = 20;
export const FILTRO_INICIAL: FiltroDeHistorial = { page: 1, pageSize: POR_PAGINA };

const TIPO: Record<MovimientoDePos['kind'], { texto: string; tono: Tono }> = {
  purchase_request: { texto: 'Solicitud de compra', tono: 'info' },
  down_payment: { texto: 'Pago inicial', tono: 'neutral' },
  installment_payment: { texto: 'Cuota', tono: 'neutral' },
};

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  accepted: { texto: 'Aceptada', tono: 'success' },
  declined: { texto: 'Rechazada', tono: 'danger' },
  confirmed: { texto: 'Confirmado', tono: 'success' },
  verified: { texto: 'Confirmado', tono: 'success' },
  rejected: { texto: 'Rechazado', tono: 'danger' },
};

export function tipoDe(m: Pick<MovimientoDePos, 'kind'>) {
  return TIPO[m.kind] ?? { texto: m.kind, tono: 'neutral' as const };
}

export function estadoDe(m: Pick<MovimientoDePos, 'status'>) {
  return ESTADO[m.status] ?? { texto: m.status, tono: 'neutral' as const };
}

/** Las cajas que se ofrecen en el filtro: las de la sucursal elegida, o todas. */
export function cajasDeSucursal(filtros: HistorialDePos['filters'] | null, branchId: string | undefined) {
  return (filtros?.terminals ?? []).filter((t) => !branchId || t.branchId === branchId);
}

/** Al cambiar de sucursal, una caja de OTRA sucursal deja de tener sentido: se suelta. Y cualquier cambio vuelve a la página 1. */
export function aplicarFiltro(
  actual: FiltroDeHistorial,
  cambio: Partial<FiltroDeHistorial>,
  filtros: HistorialDePos['filters'] | null,
): FiltroDeHistorial {
  const siguiente: FiltroDeHistorial = { ...actual, ...cambio, page: cambio.page ?? 1 };
  if ('branchId' in cambio && siguiente.terminalId) {
    const sigue = cajasDeSucursal(filtros, siguiente.branchId).some((t) => t.terminalId === siguiente.terminalId);
    if (!sigue) delete siguiente.terminalId;
  }
  return siguiente;
}

/** Las opciones del selector de sucursal: «Todas» (valor vacío) y las del comercio. */
export function opcionesDeSucursal(filtros: HistorialDePos['filters'] | null): OpcionSelect[] {
  return [{ valor: '', etiqueta: 'Todas las sucursales' }, ...(filtros?.branches ?? []).map((b) => ({ valor: b.branchId, etiqueta: b.branchName }))];
}

/** Las del selector de caja. Sin sucursal elegida, cada caja dice de qué sucursal es («Caja 1 · Centro»). */
export function opcionesDeCaja(filtros: HistorialDePos['filters'] | null, branchId: string | undefined): OpcionSelect[] {
  return [
    { valor: '', etiqueta: 'Todas las cajas' },
    ...cajasDeSucursal(filtros, branchId).map((t) => ({
      valor: t.terminalId,
      etiqueta: `${nombreDeCaja(t) ?? t.terminalSerial}${branchId ? '' : ` · ${t.branchName}`}`,
    })),
  ];
}

export function hayFiltros(filtro: FiltroDeHistorial): boolean {
  return Boolean(filtro.branchId || filtro.terminalId || filtro.from || filtro.to);
}

/**
 * «3 operaciones · confirmado Bs 1.500,00 con estos filtros»: la línea del total.
 *
 * En la web va con dos negritas dentro; aquí se devuelve en piezas para que la pantalla las ponga en
 * negrita igual, y `texto` entero para el lector de pantalla y las pruebas.
 */
export function lineaDelTotal(datos: HistorialDePos | null, conFiltros: boolean) {
  const cuenta = datos?.totals.count ?? 0;
  const importe = formatBob(Number(datos?.totals.amount ?? 0));
  const operaciones = datos?.totals.count === 1 ? 'operación' : 'operaciones';
  const cola = conFiltros ? ' con estos filtros' : '';
  return { cuenta: String(cuenta), operaciones, importe, cola, texto: `${cuenta} ${operaciones} · confirmado ${importe}${cola}` };
}

/** El texto del vacío: con filtros, la culpa es del filtro; sin ellos, todavía no pasó nada. */
export function textoVacioDelHistorial(conFiltros: boolean): string {
  return conFiltros ? 'No hay nada con estos filtros.' : 'Todavía no hay movimientos en la caja.';
}

/** «Página 2 de 5 · 93 en total». */
export function textoDePagina(datos: Pick<HistorialDePos, 'page' | 'pages' | 'total'>): string {
  return `Página ${datos.page} de ${datos.pages} · ${datos.total} en total`;
}

/** `AAAA-MM-DD` → `Date` para los límites del calendario (mediodía: ver `formatDate` de la web). */
export function fechaDeFiltro(valor: string | undefined): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  return new Date(anio, mes - 1, dia, 12);
}
