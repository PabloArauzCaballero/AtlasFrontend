/**
 * Copy de pagos y estados de cuota.
 *
 * Un mismo estado se nombra igual en toda la app: si en Inicio dice "vencida" y en Pagos dice
 * "atrasada", la persona cree que son dos cosas distintas.
 */
import type { BadgeTone } from '../ui/primitives';
import type { OrderStatus, ScheduleItem } from '../sandbox/types';

const STATUS_LABEL: Record<ScheduleItem['status'], string> = {
  PENDING: 'programada',
  DUE: 'por pagar',
  PAID: 'pagada',
  OVERDUE: 'vencida',
  DISPUTED: 'en disputa',
  COVERED: 'cubierta',
};

const STATUS_TONE: Record<ScheduleItem['status'], BadgeTone> = {
  PENDING: 'neutral',
  DUE: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  DISPUTED: 'info',
  COVERED: 'info',
};

export const statusLabel = (status: ScheduleItem['status']): string => STATUS_LABEL[status];
export const statusTone = (status: ScheduleItem['status']): BadgeTone => STATUS_TONE[status];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Vence hoy" comunica mucho mas que una fecha suelta cuando faltan horas. */
export function dueLabel(item: ScheduleItem, now: number = Date.now()): string {
  if (item.status === 'PAID') {
    return item.resolvedPaidAt ? `Pagada el ${formatDate(item.resolvedPaidAt)}` : 'Pagada';
  }

  const due = new Date(item.dueAt).getTime();
  const diffDays = Math.round((due - now) / DAY_MS);

  if (diffDays < 0) return `Venció hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'}`;
  if (due - now < DAY_MS && diffDays === 0) return `Vence hoy a las ${formatTime(item.dueAt)}`;
  if (diffDays === 1) return 'Vence mañana';
  return `Vence el ${formatDate(item.dueAt)}`;
}

export function itemTitle(item: ScheduleItem): string {
  return item.itemType === 'INITIAL' ? 'Pago inicial (60%)' : `Cuota ${item.sequenceNo} de 3`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

const ORDER_STATUS_COPY: Record<OrderStatus, { label: string; tone: BadgeTone; detail: string }> = {
  CREATED: { label: 'iniciada', tone: 'neutral', detail: 'Estamos preparando tu compra.' },
  UNDER_EVALUATION: { label: 'evaluando', tone: 'info', detail: 'Estamos evaluando tu crédito para esta compra.' },
  DECLINED: { label: 'no aprobada', tone: 'danger', detail: 'No pudimos aprobar esta compra.' },
  REVIEW: { label: 'en revisión', tone: 'info', detail: 'Un analista está revisando esta compra.' },
  CREDIT_APPROVED: { label: 'aprobada', tone: 'success', detail: 'Crédito aprobado.' },
  PENDING_MERCHANT_ACCEPTANCE: { label: 'esperando comercio', tone: 'warning', detail: 'El comercio debe confirmar la venta.' },
  REJECTED_BY_MERCHANT: { label: 'rechazada', tone: 'danger', detail: 'El comercio rechazó la operación.' },
  EXPIRED: { label: 'expirada', tone: 'neutral', detail: 'La compra expiró sin confirmarse.' },
  CANCELLED: { label: 'cancelada', tone: 'neutral', detail: 'Cancelaste esta compra.' },
  COMMITTED: { label: 'confirmada', tone: 'success', detail: 'La compra quedo registrada.' },
  WAITING_INITIAL_PAYMENT: { label: 'falta el inicial', tone: 'warning', detail: 'Paga el 60% inicial para activar tus cuotas.' },
  ACTIVE: { label: 'activa', tone: 'success', detail: 'Tus cuotas están en curso.' },
  COMPLETED: { label: 'completada', tone: 'success', detail: 'Terminaste de pagar esta compra.' },
};

export const orderStatusCopy = (status: OrderStatus) => ORDER_STATUS_COPY[status];

/**
 * Motivos de rechazo en lenguaje comprensible.
 *
 * Se explica lo suficiente para actuar sin detallar el criterio: publicar el umbral exacto es
 * publicar el manual para esquivarlo.
 */
const REASON_COPY: Record<string, string> = {
  INSUFFICIENT_AVAILABLE_LINE: 'El monto supera tu disponible actual.',
  LINE_UTILIZATION_HIGH: 'Estás usando buena parte de tu línea.',
  WITHIN_AVAILABLE_LINE: 'Dentro de tu disponible.',
};

export const reasonCopy = (code: string): string => REASON_COPY[code] ?? 'Evaluación de riesgo.';
