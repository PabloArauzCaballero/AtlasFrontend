/**
 * En qué punto está el extracto bancario de la persona, y qué le hizo a su línea.
 *
 * Perfil pedía «Sube tu extracto bancario» en dos sitios (el índice de crédito sin calcular y «Recalcular mi
 * línea») aunque la persona YA lo hubiera subido: con un extracto en revisión, el motor todavía no lo evaluó y
 * lo que corresponde decir es «pendiente de evaluar», no volver a pedirlo. Sólo si no hay NADA subido se pide.
 *
 * Aparte para poder probarlo: son decisiones de texto y de cuentas, y las pantallas sólo las pintan.
 */
import type { BankStatementReview, LineChange } from '../api/endpoints/credit-line';

export type EstadoDelExtracto =
  | { tipo: 'sin_subir' }
  | { tipo: 'pendiente'; detalle: string }
  | { tipo: 'aplicado' }
  /** Leído y medido; el límite nuevo lo concede una persona (`lineAwaitingApproval`). */
  | { tipo: 'retenido' }
  | { tipo: 'rechazado'; motivo: string };

type Resumen = Pick<BankStatementReview, 'status' | 'rejectionReason'> & Partial<Pick<BankStatementReview, 'lineAwaitingApproval'>>;

/** `ultimo` es el más reciente que subió la persona, o `null` si nunca subió ninguno. */
export function estadoDelExtracto(ultimo: Resumen | null): EstadoDelExtracto {
  if (!ultimo) return { tipo: 'sin_subir' };
  if (ultimo.status === 'received' || ultimo.status === 'processing') {
    return { tipo: 'pendiente', detalle: 'Tu extracto está pendiente de evaluar. Te avisamos en cuanto esté listo (hasta 24 h).' };
  }
  if (ultimo.status === 'applied') return ultimo.lineAwaitingApproval ? { tipo: 'retenido' } : { tipo: 'aplicado' };
  return { tipo: 'rechazado', motivo: ultimo.rejectionReason ?? 'No pudimos leer ese extracto.' };
}

/** El subtítulo de «Recalcular mi línea», según haya o no un extracto en camino. */
export function subtituloDeRecalcular(estado: EstadoDelExtracto): string {
  switch (estado.tipo) {
    case 'pendiente':
      return 'Tu extracto está pendiente de evaluar (hasta 24 h)';
    case 'retenido':
      return 'Leímos tu extracto: una persona confirma tu nueva línea';
    case 'rechazado':
      return 'Tu último extracto no se pudo usar: sube otro';
    case 'aplicado':
      return 'Sube un extracto más reciente y la recalculamos en un máximo de 24 h';
    default:
      return 'Sube tu extracto bancario y la recalculamos en un máximo de 24 h';
  }
}

/* ------------------------------------------------------------------ fechas */

/** «15/10/2026, 14:30»: fecha y hora sin depender del `Intl` del motor de JS del teléfono. */
export function fechaYHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}, ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/**
 * «01/06/2026 – 31/08/2026», o `null` si el motor no leyó el periodo.
 *
 * Las fechas del periodo llegan SIN hora («2026-06-01»). `new Date` las toma como medianoche UTC y en Bolivia (UTC−4)
 * eso es el día anterior: la pantalla decía «31/05 – 30/08» de un extracto de junio a agosto. Se leen como texto.
 */
export function periodoDelExtracto(p: BankStatementReview['period']): string | null {
  if (!p || (!p.from && !p.to)) return null;
  const dia = (valor: string | null) => {
    if (!valor) return '…';
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    return soloFecha ? `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}` : fechaYHora(valor).split(',')[0]!;
  };
  return `${dia(p.from)} – ${dia(p.to)}`;
}

/* ------------------------------------------------------------------ etapas */

export type Etapa = { clave: string; titulo: string; detalle: string; estado: 'hecha' | 'actual' | 'pendiente' | 'fallida' };

/**
 * Las cuatro etapas del recálculo, para que la espera se vea avanzar: recibido → leído → línea recalculada → listo.
 *
 * Antes la pantalla decía sólo «Lo estamos revisando» y una pastilla en versalitas con la hora: la persona no sabía si
 * el archivo había llegado, si ya se había leído o si faltaba la línea. `processing` sin motivo de revisión es «ya lo
 * leímos y falta la línea»; CON motivo, lo está mirando una persona y la lectura no terminó.
 */
export function etapasDelExtracto(review: Pick<BankStatementReview, 'status' | 'lineAwaitingApproval' | 'inHumanReview'>): Etapa[] {
  const { status } = review;
  const leido = status === 'applied' || (status === 'processing' && !review.inHumanReview);
  const etapas: Etapa[] = [
    { clave: 'recibido', titulo: 'Recibimos tu extracto', detalle: 'Llegó cifrado y quedó en cola.', estado: 'hecha' },
    {
      clave: 'leido',
      titulo: 'Leemos tus movimientos',
      detalle: review.inHumanReview ? 'Una persona lo está revisando.' : 'Ingresos, gastos y cuotas de 3 meses.',
      estado: status === 'rejected' ? 'fallida' : leido ? 'hecha' : 'actual',
    },
    {
      clave: 'linea',
      titulo: 'Recalculamos tu línea',
      detalle: review.lineAwaitingApproval ? 'Una persona del equipo la confirma.' : 'Con lo que puedes pagar al mes.',
      estado: status === 'rejected' ? 'pendiente' : status === 'applied' ? (review.lineAwaitingApproval ? 'actual' : 'hecha') : leido ? 'actual' : 'pendiente',
    },
  ];
  return etapas;
}

/* ------------------------------------------------------------------ la cuenta */

export type FilaDeCuenta = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** El tope que mandó: la cifra de la que sale la propuesta. */
  manda?: boolean;
  /** Un ajuste que RESTA (la banda de riesgo): se pinta con signo. */
  ajuste?: boolean;
  /** El total de un bloque: la propuesta y la línea final. */
  total?: boolean;
};

const TRAMO: Record<string, string> = {
  NUEVO: 'Nuevo',
  EN_CONSTRUCCION: 'En construcción',
  ESTABLECIDO: 'Establecido',
  CONSOLIDADO: 'Consolidado',
  PREFERENTE: 'Preferente',
};

/**
 * La cuenta que lleva del extracto a la línea, en filas que se leen de arriba abajo.
 *
 * 1. Lo que el extracto soporta (cuota × meses). 2. Los topes que la limitan. 3. Manda el menor: la propuesta.
 * 4. El ajuste del Motor por riesgo, y la línea. Sólo entran las filas con dato: una línea vieja sin desglose no
 * inventa pasos. Devuelve `[]` si no hay nada que contar, y la pantalla calla en vez de enseñar una cuenta coja.
 */
export function cuentaDeLaLinea(cambio: LineChange, marca: string): FilaDeCuenta[] {
  const c = cambio.calculation;
  if (!c) return [];
  const filas: FilaDeCuenta[] = [];
  const manda = c.bindingConstraint;
  if (c.byCapacity !== null) {
    const plazo = c.termMonths ? ` × ${c.termMonths} meses` : '';
    filas.push({ clave: 'capacidad', etiqueta: `Lo que tu extracto soporta${c.monthlyInstallment !== null ? ` (cuota de Bs ${miles(c.monthlyInstallment)}${plazo})` : ''}`, valor: c.byCapacity, manda: manda === 'CAPACIDAD' });
  }
  if (c.byRelationship !== null) {
    const tramo = c.relationshipTier ? ` (tramo ${TRAMO[c.relationshipTier] ?? c.relationshipTier})` : '';
    filas.push({ clave: 'relacion', etiqueta: `Tope por tu historia con ${marca}${tramo}`, valor: c.byRelationship, manda: manda === 'RELACION' });
  }
  if (c.byGraduation !== null) filas.push({ clave: 'graduacion', etiqueta: 'Tope de subida (el doble del cálculo anterior)', valor: c.byGraduation, manda: manda === 'GRADUACION' });
  if (c.productCeiling !== null) filas.push({ clave: 'producto', etiqueta: 'Techo del producto', valor: c.productCeiling, manda: manda === 'PRODUCTO' });
  if (c.recommendedLimit !== null) {
    filas.push({ clave: 'propuesta', etiqueta: 'Manda el menor: la propuesta', valor: c.recommendedLimit, total: true });
    const diferencia = c.approvedLimit - c.recommendedLimit;
    if (diferencia !== 0) {
      filas.push({ clave: 'riesgo', etiqueta: `Ajuste por riesgo${c.riskBand ? ` (banda ${c.riskBand})` : ''}`, valor: diferencia, ajuste: true });
    }
  }
  filas.push({ clave: 'linea', etiqueta: 'Tu línea', valor: c.approvedLimit, total: true });
  return filas;
}

/** Cuánto cambió la línea, en una frase y con su tono. */
export function resumenDelCambio(cambio: LineChange): { texto: string; tono: 'success' | 'danger' | 'secondary' } {
  if (cambio.previousLimit === null) return { texto: 'Tu primera línea calculada con tu extracto.', tono: 'secondary' };
  const delta = cambio.newLimit - cambio.previousLimit;
  if (delta > 0) return { texto: `Subió Bs ${miles(delta)}.`, tono: 'success' };
  if (delta < 0) return { texto: `Bajó Bs ${miles(-delta)}.`, tono: 'danger' };
  return { texto: 'Se quedó igual: tu extracto confirma la que tenías.', tono: 'secondary' };
}

/** Miles con punto, sin decimales: «1.500». Sin `toLocaleString`, cuyo resultado depende del motor de JS del teléfono. */
export function miles(valor: number): string {
  const entero = Math.round(Math.abs(valor)).toString();
  return `${valor < 0 ? '−' : ''}${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
