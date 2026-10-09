/**
 * Cómo se escriben los importes y las fechas en Gestión POS: lo mismo que en el portal web.
 *
 * `formatBob` es copia de `AtlasERPFrontend/lib/formatters.ts`, y las fechas usan las MISMAS llamadas
 * que las pantallas de la web (`toLocaleString('es-BO')` en las colas, fecha media + hora corta en el
 * historial). Se copian y no se «mejoran»: si la caja del comercio compara el PDF de la web con la
 * pantalla del teléfono, los dos tienen que decir lo mismo con las mismas letras.
 *
 * La hora sale en la zona del TELÉFONO, igual que en la web sale en la del navegador. En Bolivia es
 * la misma; fuera de Bolivia la web y la app se equivocan igual, que es preferible a que difieran.
 */

const bobFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  maximumFractionDigits: 2,
});

/** «Bs 1.234,50». El backend manda los importes como texto (`numeric` de Postgres): se convierten aquí. */
export function formatBob(value: number | string | null | undefined): string {
  return bobFormatter.format(Number(value ?? 0));
}

/** «9/10/2026, 14:05:00»: la fecha de una solicitud o un aviso de pago en las colas. */
export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-BO');
}

/** «9 oct 2026, 14:05»: la fecha de una fila del historial (más corta: es una lista larga). */
export function fechaDelHistorial(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}
