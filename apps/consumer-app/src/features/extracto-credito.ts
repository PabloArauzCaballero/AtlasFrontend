/**
 * El extracto de crédito, sin pantalla: todo lo que pasó con el crédito de la persona en una sola lista, como el
 * extracto de un banco (Pablo, 2026-10-08: «no está el botón de mi extracto de créditos»).
 *
 * Cada compra financiada suma a lo que se debe y cada pago recibido resta; el saldo se arrastra fila a fila en orden
 * de fecha. Lo PENDIENTE (cuotas por pagar) va aparte: no es un movimiento, es lo que viene.
 */
import type { LoanDetail } from '../api/endpoints/loans';

export type MovimientoDeExtracto = {
  id: string;
  fecha: string;
  tipo: 'compra' | 'pago';
  concepto: string;
  /** Positivo: se debe más. Negativo: se pagó. */
  importe: number;
  /** Lo que se debía después de este movimiento. */
  saldo: number;
};

export type Extracto = {
  movimientos: MovimientoDeExtracto[];
  totalFinanciado: number;
  totalPagado: number;
  saldo: number;
  proximas: { id: string; fecha: string; concepto: string; importe: number; vencida: boolean }[];
};

const numero = (valor: string | number | null | undefined) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function armarExtracto(creditos: readonly LoanDetail[], hoy: string = new Date().toISOString().slice(0, 10)): Extracto {
  const filas: Omit<MovimientoDeExtracto, 'saldo'>[] = [];
  const proximas: Extracto['proximas'] = [];

  for (const credito of creditos) {
    const comercio = credito.merchant?.displayName ?? 'Atlas';
    if (credito.disbursedAt) {
      filas.push({
        id: `compra-${credito.loanId}`,
        fecha: credito.disbursedAt,
        tipo: 'compra',
        concepto: `Compra en ${comercio} · ${credito.loanCode}`,
        importe: numero(credito.principalAmount),
      });
    }
    for (const pago of credito.payments ?? []) {
      if (pago.status === 'reversed') continue;
      filas.push({
        id: `pago-${pago.paymentId}`,
        fecha: pago.receivedAt,
        tipo: 'pago',
        concepto: `Pago a ${comercio}`,
        importe: -numero(pago.amount),
      });
    }
    for (const cuota of credito.schedule ?? []) {
      if (cuota.status === 'paid') continue;
      const total = numero(cuota.principalAmount) + numero(cuota.interestAmount) + numero(cuota.lateFeeAmount);
      const pagado = numero(cuota.paidPrincipal) + numero(cuota.paidInterest) + numero(cuota.paidLateFee);
      proximas.push({
        id: cuota.installmentId,
        fecha: cuota.dueDate,
        concepto: `Cuota ${cuota.installmentNumber} de ${credito.termMonths} · ${comercio}`,
        importe: Math.max(0, Math.round((total - pagado) * 100) / 100),
        vencida: cuota.dueDate < hoy,
      });
    }
  }

  filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldo = 0;
  const movimientos = filas.map((fila) => {
    saldo = Math.round((saldo + fila.importe) * 100) / 100;
    return { ...fila, saldo };
  });
  proximas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const totalFinanciado = movimientos.filter((m) => m.tipo === 'compra').reduce((t, m) => t + m.importe, 0);
  const totalPagado = movimientos.filter((m) => m.tipo === 'pago').reduce((t, m) => t - m.importe, 0);
  // Más recientes primero, como se lee un extracto en el teléfono; el saldo de cada fila ya quedó calculado.
  return { movimientos: movimientos.reverse(), totalFinanciado, totalPagado, saldo, proximas };
}
