/**
 * Cómo se escriben los importes y las fechas en Gestión POS.
 *
 * `formatBob` es copia de `AtlasERPFrontend/lib/formatters.ts`: el importe tiene que decir lo mismo,
 * con las mismas letras, en el PDF de la web y en la pantalla del teléfono.
 *
 * Las fechas de las tarjetas son más cortas que las de la web («9 oct, 14:03» en vez de
 * «9/10/2026, 14:05:00»): van en la línea secundaria de cada tarjeta, que es UN renglón (Pablo,
 * 2026-10-10). La hora sale en la zona del TELÉFONO, igual que en la web sale en la del navegador.
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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «9 oct, 14:03»: la fecha de la línea secundaria de una tarjeta. El año sólo si no es el de hoy.
 *
 * Se arma a mano y no con `toLocaleString`: el motor de JS del iPhone y el de Node no escriben igual
 * el mes abreviado («oct», «oct.», «de oct.»), y esta línea tiene que caber en un renglón en los dos.
 */
export function fechaCorta(iso: string | null | undefined, hoy: Date = new Date()): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  const anio = fecha.getFullYear() === hoy.getFullYear() ? '' : ` ${fecha.getFullYear()}`;
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}${anio}, ${hora}`;
}
