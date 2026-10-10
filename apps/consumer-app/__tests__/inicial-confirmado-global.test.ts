import { inicialesConfirmados } from '../src/sandbox/conciliacion';
import { emptyState } from '../src/sandbox/engine';
import type { PurchaseOrder, SandboxState } from '../src/sandbox/types';
import { minor } from '../src/domain/money';

/**
 * El pago inicial que el comercio confirma DESPUÉS de que la persona se fue de la pantalla del pago.
 *
 * Antes sólo lo preguntaba `app/(app)/pago/[itemId].tsx` mientras estaba abierta: tras «Entendido», la compra se
 * quedaba en «esperando el pago inicial» para siempre. Ahora lo pregunta el estado de compras con la app en cualquier
 * pantalla (`sandbox/store.tsx`), y esta es la regla que decide qué cuotas se dan por pagadas.
 */
function estado(orders: Pick<PurchaseOrder, 'id' | 'status' | 'backendApplicationId'>[], pagadas: string[] = []): SandboxState {
  return {
    ...emptyState(minor(500_000)),
    orders: orders as PurchaseOrder[],
    schedules: orders.map((order) => ({
      id: `sch-${order.id}`,
      purchaseOrderId: order.id,
      items: [
        { id: `ini-${order.id}`, itemType: 'INITIAL', status: pagadas.includes(`ini-${order.id}`) ? 'PAID' : 'DUE' },
        { id: `c1-${order.id}`, itemType: 'INSTALLMENT', status: 'PENDING' },
      ],
    })) as unknown as SandboxState['schedules'],
  };
}

describe('inicialesConfirmados', () => {
  it('da por pagado el inicial cuya solicitud el servidor marca como confirmada', () => {
    const s = estado([
      { id: 'a', status: 'WAITING_INITIAL_PAYMENT', backendApplicationId: '7' },
      { id: 'b', status: 'WAITING_INITIAL_PAYMENT', backendApplicationId: '8' },
    ]);
    const confirmados = inicialesConfirmados(s, [
      { applicationId: '7', status: 'approved', downPaymentStatus: 'confirmed' },
      { applicationId: '8', status: 'approved', downPaymentStatus: 'submitted' },
    ]);
    expect(confirmados).toEqual(['ini-a']);
  });

  it('no toca compras de demostración, ya activas ni iniciales ya pagados', () => {
    const s = estado(
      [
        { id: 'demo', status: 'WAITING_INITIAL_PAYMENT', backendApplicationId: null },
        { id: 'activa', status: 'ACTIVE', backendApplicationId: '7' },
        { id: 'pagada', status: 'WAITING_INITIAL_PAYMENT', backendApplicationId: '9' },
      ],
      ['ini-pagada'],
    );
    expect(
      inicialesConfirmados(s, [
        { applicationId: '7', status: 'approved', downPaymentStatus: 'confirmed' },
        { applicationId: '9', status: 'approved', downPaymentStatus: 'confirmed' },
      ]),
    ).toEqual([]);
  });

  it('un aviso rechazado o sin avisar no confirma nada', () => {
    const s = estado([{ id: 'a', status: 'WAITING_INITIAL_PAYMENT', backendApplicationId: '7' }]);
    expect(inicialesConfirmados(s, [{ applicationId: '7', status: 'approved', downPaymentStatus: 'rejected' }])).toEqual([]);
    expect(inicialesConfirmados(s, [{ applicationId: '7', status: 'approved', downPaymentStatus: null }])).toEqual([]);
  });
});
