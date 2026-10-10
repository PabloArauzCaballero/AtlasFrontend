/**
 * Cómo se escriben importes y fechas en Cartera y facturación. Copia de `AtlasERPFrontend/lib/formatters.ts`
 * (`formatBob`, `formatDate`) y del `fecha` de `MerchantPortfolioScreen`.
 *
 * Se copian y no se toman los de la app del cliente (`domain/money.ts`) a propósito: aquellos
 * trabajan en centavos enteros y éstos reciben las cadenas decimales que manda el backend del ERP
 * («1234.50»). Mezclar los dos obligaría a convertir en cada pantalla, y una conversión olvidada es
 * un importe cien veces mayor. Lo que el comercio ve en el teléfono tiene que decir, carácter a
 * carácter, lo mismo que en el portal: el mismo `Intl` con la misma configuración lo garantiza.
 */

const bobFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeZone: 'America/La_Paz',
});

/** «Bs 1.234,50». Un valor que no es número (cadena vacía, `null`) se pinta como cero, igual que la web con `Number(x ?? 0)`. */
export function formatBob(value: number): string {
  return bobFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Atajo para lo que llega del backend como cadena decimal o ausente. */
export function bob(value: unknown): string {
  return formatBob(Number(value ?? 0));
}

/** `AAAA-MM-DD` a secas: lo que devuelven las columnas `DATE` del ERP (vencimientos). */
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * «9 oct 2026» en La Paz.
 *
 * Una fecha sin hora se ancla a mediodía UTC: `new Date('2026-01-01')` es medianoche UTC, y en
 * La Paz (UTC-4) se pintaría «31 dic 2025». En un vencimiento ese día de menos no es cosmético.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') {
    const partes = SOLO_FECHA.exec(value);
    if (partes) {
      const [, anio, mes, dia] = partes;
      return dateFormatter.format(new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12)));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

/**
 * «vie, 09 oct»: el día de cobro en el panel, los créditos y el calendario de «Mi cartera».
 *
 * Es el `fecha` de la web tal cual —mediodía local para que la fecha no salte de día—, incluido que
 * espera `AAAA-MM-DD`. Un valor con hora (`…T00:00:00Z`) se recorta a su fecha antes, para no
 * acabar en «Invalid Date» si el backend un día manda el instante entero.
 */
export function fechaCorta(valor: string): string {
  const dia = valor.slice(0, 10);
  const fecha = new Date(`${dia}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' });
}

/** El texto de un fallo, como lo pinta la web (`error instanceof Error ? error.message : …`). */
export function textoDeFallo(error: unknown, respaldo: string): string {
  return error instanceof Error && error.message ? error.message : respaldo;
}
