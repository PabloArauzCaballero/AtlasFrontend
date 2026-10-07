/**
 * Los rangos de ingreso mensual que ofrece la app, de catálogo cerrado.
 *
 * Viven aquí y no en la pantalla de economía porque los usan dos sitios: el alta, que los guarda como banda, y la solicitud
 * de corregir el ingreso, que ofrece los mismos rangos para que lo corregido se pueda comparar con lo declarado.
 */
/*
 * El ingreso se pide por BANDA, no por monto: es autodeclarado y se trata como dato blando. Lo que
 * decide la capacidad de pago de verdad es el extracto bancario, al final del alta.
 *
 * `declarado` es el valor que viaja como `monthlyIncomeDeclared`, porque la capacidad sin extracto
 * (`CAP_SIN_EXTRACTO`) necesita un número: el PISO de la banda —conservador a propósito—, salvo la
 * primera, cuyo piso es cero y dejaría a todos sin cupo. Los códigos los cierra el servidor
 * (`MONTHLY_INCOME_BAND_VALUES`).
 */
export type IncomeBand = 'bs_0_3000' | 'bs_3000_5000' | 'bs_5000_8000' | 'bs_8000_12000' | 'bs_12000_20000' | 'bs_20000_plus';
export const BANDAS: readonly { valor: IncomeBand; etiqueta: string; detalle: string; declarado: number }[] = [
  { valor: 'bs_0_3000', etiqueta: 'Menos de Bs 3.000', detalle: 'Te queda menos de 3.000 bolivianos al mes.', declarado: 1500 },
  { valor: 'bs_3000_5000', etiqueta: 'Bs 3.000 a 5.000', detalle: 'Te queda entre 3.000 y 5.000 bolivianos al mes.', declarado: 3000 },
  { valor: 'bs_5000_8000', etiqueta: 'Bs 5.000 a 8.000', detalle: 'Te queda entre 5.000 y 8.000 bolivianos al mes.', declarado: 5000 },
  { valor: 'bs_8000_12000', etiqueta: 'Bs 8.000 a 12.000', detalle: 'Te queda entre 8.000 y 12.000 bolivianos al mes.', declarado: 8000 },
  { valor: 'bs_12000_20000', etiqueta: 'Bs 12.000 a 20.000', detalle: 'Te queda entre 12.000 y 20.000 bolivianos al mes.', declarado: 12000 },
  { valor: 'bs_20000_plus', etiqueta: 'Más de Bs 20.000', detalle: 'Te quedan más de 20.000 bolivianos al mes.', declarado: 20000 },
];
