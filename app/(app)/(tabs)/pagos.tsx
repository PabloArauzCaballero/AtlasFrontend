/**
 * Calendario de pagos.
 *
 * En web esto seria una tabla con doce columnas. En movil es una lista agrupada por compra, con lo
 * critico —monto, vencimiento y estado— visible sin abrir nada, y el resto en el detalle.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { formatMoney } from '../../../src/domain/money';
import { dueLabel, itemTitle, statusLabel, statusTone } from '../../../src/features/payment-copy';
import { useSandbox } from '../../../src/sandbox/store';
import { space } from '../../../src/theme/tokens';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, EmptyState, ListRow } from '../../../src/ui/primitives';

export default function Payments() {
  const router = useRouter();
  const sandbox = useSandbox();

  const schedules = sandbox.state.schedules;

  return (
    <Screen>
      <Gap size="sm" />
      <AtlasText variant="h1">Tus pagos</AtlasText>
      <AtlasText variant="body" tone="secondary">
        Todos tus pagos van directo al comercio donde compraste.
      </AtlasText>

      <Card>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <AtlasText variant="caption" tone="tertiary">
              Total por pagar
            </AtlasText>
            <AtlasText variant="amountSmall">{formatMoney(sandbox.outstanding)}</AtlasText>
          </View>
          <View style={styles.summaryItem}>
            <AtlasText variant="caption" tone="tertiary">
              Compras activas
            </AtlasText>
            <AtlasText variant="amountSmall">{schedules.length}</AtlasText>
          </View>
        </View>
      </Card>

      {schedules.length === 0 ? (
        <EmptyState
          title="No tienes pagos pendientes"
          detail="Cuando compres con Atlas, aqui apareceran tu pago inicial y tus tres cuotas."
          action={<Button label="Escanear un QR" variant="secondary" onPress={() => router.push('/(app)/(tabs)/escanear')} />}
        />
      ) : (
        schedules.map((schedule) => {
          const order = sandbox.state.orders.find((item) => item.id === schedule.purchaseOrderId);
          return (
            <Card key={schedule.id}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderText}>
                  <AtlasText variant="h3">{order?.context.tradeName ?? 'Compra'}</AtlasText>
                  <AtlasText variant="caption" tone="secondary">
                    {order?.orderCode} · total {formatMoney(schedule.totalAmount)}
                  </AtlasText>
                </View>
              </View>
              <Divider />

              {schedule.items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    title={itemTitle(item)}
                    subtitle={`${formatMoney(item.amount)} · ${dueLabel(item)}`}
                    right={<Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />}
                    onPress={item.status === 'PAID' ? undefined : () => router.push(`/(app)/pago/${item.id}`)}
                    accessibilityHint="Abrir para ver como pagar"
                  />
                </View>
              ))}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: space.xl },
  summaryItem: { gap: space.xxs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardHeaderText: { flex: 1, gap: space.xxs },
});
