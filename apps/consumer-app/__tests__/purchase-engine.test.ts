/**
 * Invariantes adversariales del flujo de compra.
 *
 * Cada caso corresponde a una regla del documento maestro. Si alguno deja de pasar, el flujo
 * permite algo que el modelo prohibe explicitamente.
 */
import { minor } from '../src/domain/money';
import { DEMO_TOKEN, POS_QRS, REVOKED_DEMO_TOKEN } from '../src/sandbox/fixtures';
import {
  availableCredit,
  commitPurchase,
  createOrder,
  emptyState,
  evaluateOrder,
  openScanSession,
} from '../src/sandbox/engine';
import type { CreditLine, PurchaseOrder, ScanSession } from '../src/sandbox/types';

const NOW = Date.UTC(2026, 7, 18, 12, 0, 0);

function openSession(now = NOW): ScanSession {
  const result = openScanSession(DEMO_TOKEN, now);
  if ('code' in result) throw new Error(`No se pudo abrir la sesion: ${result.code}`);
  return result.session;
}

function lineWith(limit: number): CreditLine {
  return emptyState(minor(limit)).creditLine;
}

/** Lleva una orden hasta el punto exacto anterior al commit. */
function orderReadyToCommit(input?: { limit?: number; gross?: number }): { order: PurchaseOrder; line: CreditLine } {
  const line = lineWith(input?.limit ?? 500_000);
  const created = createOrder({ session: openSession(), grossAmount: minor(input?.gross ?? 100_000), now: NOW });
  if ('code' in created) throw new Error(created.code);

  const decision = evaluateOrder({ order: created.order, line, now: NOW });
  const reserved: CreditLine = {
    ...line,
    reservations: [
      {
        id: 'res_1',
        orderId: created.order.id,
        amount: created.order.financedAmount,
        status: 'ACTIVE',
        expiresAt: decision.validUntil,
      },
    ],
  };

  return {
    line: reserved,
    order: {
      ...created.order,
      decision,
      acceptance: { acceptedAt: new Date(NOW).toISOString(), orderContentHash: created.order.contentHash, memberRole: 'OPERATOR' },
    },
  };
}

describe('escaneo del QR interno (R15)', () => {
  it('abre sesion con un QR activo y resuelve el contexto en el servidor', () => {
    const result = openScanSession(DEMO_TOKEN, NOW);
    expect('session' in result).toBe(true);
    if ('session' in result) {
      expect(result.session.context.tradeName).toBe(POS_QRS[0]!.context.tradeName);
      expect(result.session.status).toBe('OPEN');
    }
  });

  it('rechaza un QR revocado', () => {
    expect(openScanSession(REVOKED_DEMO_TOKEN, NOW)).toEqual({ code: 'QR_REVOKED' });
  });

  it('rechaza un token desconocido', () => {
    expect(openScanSession('atlas://pos/inventado', NOW)).toEqual({ code: 'QR_NOT_RECOGNIZED' });
  });
});

describe('creacion de la orden', () => {
  it('consume la sesion y no permite una segunda orden (R17)', () => {
    const session = openSession();
    const first = createOrder({ session, grossAmount: minor(100_000), now: NOW });
    expect('order' in first).toBe(true);
    if (!('order' in first)) return;

    const second = createOrder({ session: first.session, grossAmount: minor(50_000), now: NOW });
    expect(second).toEqual({ code: 'SESSION_ALREADY_USED' });
  });

  it('rechaza una sesion vencida', () => {
    const session = openSession();
    const later = NOW + 11 * 60 * 1000;
    expect(createOrder({ session, grossAmount: minor(100_000), now: later })).toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('calcula los importes en el servidor y no acepta los del cliente (R34/R35)', () => {
    const created = createOrder({ session: openSession(), grossAmount: minor(100_000), now: NOW });
    if (!('order' in created)) throw new Error('orden no creada');
    expect(created.order.initialPaymentAmount).toBe(60_000);
    expect(created.order.financedAmount).toBe(40_000);
    expect(created.order.initialPaymentAmount + created.order.financedAmount).toBe(created.order.grossAmount);
  });
});

describe('disponible de la linea (R51)', () => {
  it('descuenta reservas activas', () => {
    const { line } = orderReadyToCommit();
    expect(availableCredit(line)).toBe(500_000 - 40_000);
  });

  it('rechaza la compra cuando el financiado supera el disponible', () => {
    const line = lineWith(10_000);
    const created = createOrder({ session: openSession(), grossAmount: minor(100_000), now: NOW });
    if (!('order' in created)) throw new Error('orden no creada');
    const decision = evaluateOrder({ order: created.order, line, now: NOW });
    expect(decision.decision).toBe('DECLINED');
    expect(decision.reasonCodes).toContain('INSUFFICIENT_AVAILABLE_LINE');
  });
});

describe('commit atomico (R41-R48)', () => {
  it('origina la compra cuando todo sigue vigente', () => {
    const { order, line } = orderReadyToCommit();
    const result = commitPurchase({ order, line, now: NOW });
    expect('schedule' in result).toBe(true);
    if (!('schedule' in result)) return;

    expect(result.order.commitmentId).toBeTruthy();
    expect(result.order.status).toBe('WAITING_INITIAL_PAYMENT');
    // Inicial + 3 cuotas.
    expect(result.schedule.items).toHaveLength(4);
    expect(result.schedule.items.reduce((total, item) => total + item.amount, 0)).toBe(order.grossAmount);
    // La reserva pasa a consumida, no queda colgada.
    expect(result.line.reservations[0]?.status).toBe('COMMITTED');
  });

  it('aprobar no es originar: sin aceptacion del comercio no hay commit (R42)', () => {
    const { order, line } = orderReadyToCommit();
    const result = commitPurchase({ order: { ...order, acceptance: null }, line, now: NOW });
    expect(result).toEqual({ code: 'ORDER_NOT_ACCEPTED' });
  });

  it('una aceptacion con hash distinto no sirve si la orden cambio (R37)', () => {
    const { order, line } = orderReadyToCommit();
    const tampered: PurchaseOrder = { ...order, contentHash: `${order.contentHash}-modificado` };
    expect(commitPurchase({ order: tampered, line, now: NOW })).toEqual({ code: 'CONTENT_HASH_MISMATCH' });
  });

  it('aborta si la orden vencio (R38)', () => {
    // La orden vive 15 minutos; pasado ese punto no se acepta ni se origina.
    const { order, line } = orderReadyToCommit();
    expect(commitPurchase({ order, line, now: NOW + 16 * 60 * 1000 })).toEqual({ code: 'ORDER_EXPIRED' });
  });

  it('aborta si la decision de credito vencio aunque la orden siga viva (R47)', () => {
    // La decision vive 10 minutos: vence ANTES que la orden, y ese es el control que debe saltar.
    const { order, line } = orderReadyToCommit();
    const later = NOW + 11 * 60 * 1000;
    const stillFresh: PurchaseOrder = { ...order, expiresAt: new Date(later + 60_000).toISOString() };
    expect(commitPurchase({ order: stillFresh, line, now: later })).toEqual({ code: 'DECISION_EXPIRED' });
  });

  it('aborta si la reserva ya no esta activa (R48)', () => {
    const { order, line } = orderReadyToCommit();
    const released: CreditLine = {
      ...line,
      reservations: line.reservations.map((item) => ({ ...item, status: 'RELEASED' as const })),
    };
    expect(commitPurchase({ order, line: released, now: NOW })).toEqual({ code: 'RESERVATION_NOT_ACTIVE' });
  });

  it('no permite dos commitments para la misma orden (R39)', () => {
    const { order, line } = orderReadyToCommit();
    const first = commitPurchase({ order, line, now: NOW });
    if (!('order' in first)) throw new Error('primer commit fallido');
    expect(commitPurchase({ order: first.order, line: first.line, now: NOW })).toEqual({ code: 'ALREADY_COMMITTED' });
  });
});
