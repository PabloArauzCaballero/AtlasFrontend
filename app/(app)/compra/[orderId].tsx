/**
 * Detalle y avance de una compra.
 *
 * Es la pantalla que acompana el momento delicado: el credito se evalua, el comercio confirma y
 * recien entonces la operacion queda originada. Se distingue con claridad cada estado, porque
 * "aprobado" no es "confirmado" y "el comercio acepto" tampoco es "compra originada".
 *
 * Cuando la compra queda confirmada aparece el QR bancario DEL COMERCIO —el unico que mueve
 * dinero— con el monto inicial exacto.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney } from '../../../src/domain/money';
import { dueLabel, itemTitle, orderStatusCopy, reasonCopy, statusLabel, statusTone } from '../../../src/features/payment-copy';
import { useSandbox } from '../../../src/sandbox/store';
import { space } from '../../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ErrorState, ListRow, Skeleton } from '../../../src/ui/primitives';

const COMMIT_FAILURE_COPY: Record<string, string> = {
  ORDER_EXPIRED: 'La compra expiro antes de confirmarse. Pide al comercio iniciar una nueva.',
  ORDER_NOT_ACCEPTED: 'El comercio todavia no confirmo la venta.',
  DECISION_EXPIRED: 'La aprobacion vencio. Hay que volver a evaluar la compra.',
  DECISION_DOES_NOT_COVER: 'El monto aprobado no cubre lo que se quiere financiar.',
  DECISION_MISSING: 'Falta la evaluacion de credito de esta compra.',
  RESERVATION_NOT_ACTIVE: 'La reserva de tu linea ya no esta vigente.',
  CONTENT_HASH_MISMATCH: 'El monto cambio despues de que el comercio lo acepto. Hay que confirmarlo de nuevo.',
  ALREADY_COMMITTED: 'Esta compra ya estaba confirmada.',
};

export default function PurchaseDetail() {
  const router = useRouter();
  const sandbox = useSandbox();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const order = sandbox.orderById(orderId);
  const origin = sandbox.decisionOrigin;
  const schedule = sandbox.scheduleForOrder(orderId);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Cuando el comercio acepta, el backend revalida todo y origina la compra en una sola
  // transaccion. Aqui se dispara ese commit en cuanto existe la aceptacion.
  useEffect(() => {
    if (!order || !order.acceptance || order.commitmentId) return;
    const result = sandbox.commit(order.id);
    if (!result.ok) setCommitError(result.rejection.code);
  }, [order, sandbox]);

  if (!order) {
    return (
      <Screen>
        <ScreenHeader title="Compra" onBack="auto" />
        <Card>
          <Skeleton height={20} width="60%" />
          <Skeleton height={48} />
        </Card>
      </Screen>
    );
  }

  const copy = orderStatusCopy(order.status);
  const initialItem = schedule?.items.find((item) => item.itemType === 'INITIAL');
  const evaluating = order.status === 'UNDER_EVALUATION';
  const waitingMerchant = order.status === 'PENDING_MERCHANT_ACCEPTANCE' && !order.acceptance;

  return (
    <Screen
      footer={
        order.status === 'WAITING_INITIAL_PAYMENT' && initialItem ? (
          <Button label={`Pagar ${formatMoney(initialItem.amount)}`} onPress={() => router.push(`/(app)/pago/${initialItem.id}`)} haptic="success" />
        ) : order.status === 'DECLINED' || order.status === 'REJECTED_BY_MERCHANT' || order.status === 'EXPIRED' ? (
          <Button label="Volver al inicio" variant="secondary" onPress={() => router.replace('/(app)/(tabs)')} />
        ) : waitingMerchant ? (
          <Button label="Cancelar compra" variant="ghost" onPress={() => { sandbox.cancelOrder(order.id); router.replace('/(app)/(tabs)'); }} />
        ) : null
      }
    >
      <ScreenHeader title={order.context.tradeName} subtitle={`${order.context.branchName} · ${order.orderCode}`} onBack="auto" />

      <Card>
        <View style={styles.rowBetween}>
          <AtlasText variant="caption" tone="secondary">
            Estado de la compra
          </AtlasText>
          <Badge label={copy.label} tone={copy.tone} />
        </View>
        <AtlasText variant="amount">{formatMoney(order.grossAmount)}</AtlasText>
        <AtlasText variant="body" tone="secondary">
          {copy.detail}
        </AtlasText>

        {evaluating ? <Skeleton height={6} /> : null}
        {waitingMerchant ? (
          <AtlasText variant="caption" tone="tertiary">
            El comercio ve tu orden en su portal y debe aceptar el monto exacto.
          </AtlasText>
        ) : null}
      </Card>

      {commitError ? (
        <ErrorState
          title="No pudimos confirmar la compra"
          detail={COMMIT_FAILURE_COPY[commitError] ?? 'Algo cambio antes de confirmar. Pide al comercio iniciar la compra otra vez.'}
        />
      ) : null}

      <Card>
        <AtlasText variant="h3">Como se divide</AtlasText>
        <Divider />
        <View style={styles.rowBetween}>
          <AtlasText variant="body" tone="secondary">
            Pago inicial (60%)
          </AtlasText>
          <AtlasText variant="bodyStrong">{formatMoney(order.initialPaymentAmount)}</AtlasText>
        </View>
        <View style={styles.rowBetween}>
          <AtlasText variant="body" tone="secondary">
            Financiado (40%)
          </AtlasText>
          <AtlasText variant="bodyStrong">{formatMoney(order.financedAmount)}</AtlasText>
        </View>
      </Card>

      {order.decision ? (
        <Card>
          <AtlasText variant="h3">Evaluacion</AtlasText>
          <Divider />
          <ListRow
            title={decisionTitle(order.decision.decision)}
            subtitle={order.decision.reasonCodes.map(reasonCopy).join(' ')}
            right={<Badge label={decisionBadge(order.decision.decision)} tone={decisionTone(order.decision.decision)} />}
          />
          {origin?.source === 'backend' ? (
            <>
              <Divider />
              {/* La trazabilidad se MUESTRA. Quien lea esta pantalla tiene que poder pedirle a
                  soporte la ejecucion exacta que produjo el si o el no, y compararla con el motor. */}
              <AtlasText variant="caption" tone="tertiary">
                Decidido por AtlasBackend contra el motor de decision · solicitud {origin.applicationCode}
                {origin.executionId ? ` · ejecucion ${origin.executionId}` : ''}
                {origin.decisionMode ? ` · modo ${origin.decisionMode}` : ''}
              </AtlasText>
            </>
          ) : null}
          {origin?.source === 'sandbox' ? (
            <>
              <Divider />
              <AtlasText variant="caption" tone="tertiary">
                Decidido por el motor local de demostracion. No es una decision de credito real.
              </AtlasText>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* Un motor que no contesta NO es un rechazo, y la pantalla no puede insinuar que lo sea. */}
      {!order.decision && origin?.source === 'backend-unavailable' ? (
        <ErrorState
          title="No pudimos evaluar tu compra"
          detail={`El servicio de decision no respondio (${origin.code}). Tu compra sigue abierta y nadie la rechazo. Vuelve a intentarlo en un momento.`}
        />
      ) : null}

      {schedule ? (
        <Card>
          <AtlasText variant="h3">Tu calendario</AtlasText>
          <Divider />
          {schedule.items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                title={itemTitle(item)}
                subtitle={`${formatMoney(item.amount)} · ${dueLabel(item)}`}
                right={<Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />}
                onPress={item.status === 'PAID' ? undefined : () => router.push(`/(app)/pago/${item.id}`)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Todos los pagos de esta compra van directo a la cuenta de {order.context.tradeName}.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});

/**
 * Tres desenlaces, tres textos. `REVIEW` existe porque el backend lo emite —tanto cuando la politica
 * lo pide como cuando el motor no respondio— y presentarlo como rechazo seria mentir sobre un
 * expediente que sigue vivo.
 */
function decisionTitle(decision: 'APPROVED' | 'DECLINED' | 'REVIEW'): string {
  if (decision === 'APPROVED') return 'Credito aprobado';
  if (decision === 'DECLINED') return 'Credito no aprobado';
  return 'Tu compra esta en revision';
}

function decisionBadge(decision: 'APPROVED' | 'DECLINED' | 'REVIEW'): string {
  if (decision === 'APPROVED') return 'aprobado';
  if (decision === 'DECLINED') return 'rechazado';
  return 'en revision';
}

function decisionTone(decision: 'APPROVED' | 'DECLINED' | 'REVIEW'): 'success' | 'danger' | 'warning' {
  if (decision === 'APPROVED') return 'success';
  if (decision === 'DECLINED') return 'danger';
  return 'warning';
}
