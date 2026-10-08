import { descartarComprasSinSolicitud } from '../src/sandbox/conciliacion';
import { emptyState } from '../src/sandbox/engine';
import type { PurchaseOrder, SandboxState } from '../src/sandbox/types';
import { minor } from '../src/domain/money';

/**
 * El «crédito fantasma» (Pablo, 2026-10-07): una compra guardada en el teléfono apuntaba a la
 * solicitud 1, que el servidor ya no tenía. Pagos pedía el inicial y el aviso moría con
 * `CREDIT_APPLICATION_NOT_FOUND`.
 */
const ANTES = Date.parse('2026-10-07T00:00:00.000Z');
const CONSULTA = Date.parse('2026-10-07T01:00:00.000Z');
const DESPUES = Date.parse('2026-10-07T02:00:00.000Z');

function compra(id: string, backendApplicationId: string | null, creada = ANTES): PurchaseOrder {
  return { id, backendApplicationId, createdAt: new Date(creada).toISOString() } as PurchaseOrder;
}

function estadoCon(orders: PurchaseOrder[]): SandboxState {
  const base = emptyState(minor(500_000));
  return {
    ...base,
    orders,
    schedules: orders.map((order) => ({
      id: `sch-${order.id}`,
      purchaseOrderId: order.id,
      items: [{ id: `item-${order.id}` }],
    })) as unknown as SandboxState['schedules'],
    instructions: orders.map((order) => ({ id: `ins-${order.id}`, scheduleItemId: `item-${order.id}` })) as unknown as SandboxState['instructions'],
    claims: orders.map((order) => ({ id: `clm-${order.id}`, instructionId: `ins-${order.id}` })) as unknown as SandboxState['claims'],
    creditLine: {
      ...base.creditLine,
      ledger: orders.map((order) => ({
        id: `led-${order.id}`,
        entryType: 'CONSUME' as const,
        amount: minor(10_000),
        referenceId: order.id,
        createdAt: new Date(ANTES).toISOString(),
      })),
      reservations: orders.map((order) => ({
        id: `res-${order.id}`,
        orderId: order.id,
        amount: minor(1_000),
        status: 'ACTIVE' as const,
        expiresAt: new Date(DESPUES).toISOString(),
      })),
    },
  };
}

describe('descartarComprasSinSolicitud', () => {
  it('descarta la compra cuya solicitud no existe, con sus cuotas, avisos y cupo', () => {
    const estado = estadoCon([compra('fantasma', '1'), compra('viva', '7')]);
    const limpio = descartarComprasSinSolicitud(estado, [{ applicationId: '7', status: 'approved' }], CONSULTA);

    expect(limpio.orders.map((order) => order.id)).toEqual(['viva']);
    expect(limpio.schedules.map((schedule) => schedule.purchaseOrderId)).toEqual(['viva']);
    expect(limpio.instructions.map((entry) => entry.id)).toEqual(['ins-viva']);
    expect(limpio.claims.map((entry) => entry.id)).toEqual(['clm-viva']);
    expect(limpio.creditLine.ledger.map((entry) => entry.referenceId)).toEqual(['viva']);
    expect(limpio.creditLine.reservations.map((entry) => entry.orderId)).toEqual(['viva']);
  });

  it('una solicitud cancelada o vencida tampoco sostiene la compra', () => {
    const estado = estadoCon([compra('a', '2'), compra('b', '3')]);
    const limpio = descartarComprasSinSolicitud(
      estado,
      [
        { applicationId: '2', status: 'cancelled' },
        { applicationId: '3', status: 'expired' },
      ],
      CONSULTA,
    );
    expect(limpio.orders).toEqual([]);
  });

  it('no toca las compras de demostración ni las creadas después de la consulta', () => {
    const estado = estadoCon([compra('demo', null), compra('recien', '9', DESPUES)]);
    expect(descartarComprasSinSolicitud(estado, [], CONSULTA)).toBe(estado);
  });

  it('los ids numéricos del servidor casan con los guardados como texto', () => {
    const estado = estadoCon([compra('viva', '7')]);
    const solicitudes = [{ applicationId: 7 as unknown as string, status: 'under_review' }];
    expect(descartarComprasSinSolicitud(estado, solicitudes, CONSULTA)).toBe(estado);
  });
});
