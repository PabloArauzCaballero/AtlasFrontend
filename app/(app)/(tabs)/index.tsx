/**
 * Inicio.
 *
 * Responde en un vistazo las tres preguntas que trae quien abre la app: cuanto puedo gastar, cuanto
 * debo y que me vence primero. Todo lo demas baja en la jerarquia.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { formatMoney } from '../../../src/domain/money';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { color, radius, space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, EmptyState, ListRow, Skeleton } from '../../../src/ui/primitives';
import { dueLabel, statusTone, statusLabel } from '../../../src/features/payment-copy';

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();

  const firstName = session.me?.profile.firstName ?? '';
  const activeOrders = sandbox.state.orders.filter((order) => order.status === 'ACTIVE' || order.status === 'WAITING_INITIAL_PAYMENT');

  if (!sandbox.ready) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card>
          <Skeleton height={14} width="40%" />
          <Skeleton height={36} width="70%" />
          <Skeleton height={6} />
        </Card>
        <Card>
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void session.refresh()}>
      <Gap size="sm" />
      <View style={styles.greeting}>
        <View style={styles.greetingText}>
          <AtlasText variant="caption" tone="secondary">
            Hola{firstName ? `, ${firstName}` : ''}
          </AtlasText>
          <AtlasText variant="h1">Tu linea Atlas</AtlasText>
        </View>
        {isSandboxPurchase ? <DataSourceBadge /> : null}
      </View>

      <Card style={styles.lineCard}>
        <AtlasText variant="caption" tone="secondary">
          Disponible para comprar
        </AtlasText>
        <AtlasText variant="amount">{formatMoney(sandbox.available)}</AtlasText>

        <View style={styles.lineMeta}>
          <View style={styles.lineMetaItem}>
            <AtlasText variant="caption" tone="tertiary">
              Limite aprobado
            </AtlasText>
            <AtlasText variant="amountSmall">{formatMoney(sandbox.state.creditLine.approvedLimit)}</AtlasText>
          </View>
          <View style={styles.lineMetaItem}>
            <AtlasText variant="caption" tone="tertiary">
              Por pagar
            </AtlasText>
            <AtlasText variant="amountSmall">{formatMoney(sandbox.outstanding)}</AtlasText>
          </View>
        </View>

        <Button label="Escanear QR del comercio" onPress={() => router.push('/(app)/(tabs)/escanear')} />
      </Card>

      {sandbox.nextDue ? (
        <Card>
          <View style={styles.rowBetween}>
            <AtlasText variant="h3">Tu proximo pago</AtlasText>
            <Badge label={statusLabel(sandbox.nextDue.item.status)} tone={statusTone(sandbox.nextDue.item.status)} />
          </View>
          <Divider />
          <View style={styles.rowBetween}>
            <View>
              <AtlasText variant="amount">{formatMoney(sandbox.nextDue.item.amount)}</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {dueLabel(sandbox.nextDue.item)}
              </AtlasText>
            </View>
          </View>
          <Button label="Ver como pagar" variant="secondary" onPress={() => router.push(`/(app)/pago/${sandbox.nextDue!.item.id}`)} />
        </Card>
      ) : null}

      <AtlasText variant="h3">Tus compras</AtlasText>

      {activeOrders.length === 0 ? (
        <EmptyState
          title="Todavia no tienes compras"
          detail="Cuando compres en un comercio Atlas, aqui veras el detalle y tus cuotas."
          action={<Button label="Escanear un QR" variant="secondary" onPress={() => router.push('/(app)/(tabs)/escanear')} />}
        />
      ) : (
        <Card>
          {activeOrders.map((order, index) => (
            <View key={order.id}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                title={order.context.tradeName}
                subtitle={`${order.orderCode} · ${formatMoney(order.grossAmount)}`}
                right={
                  <Badge
                    label={order.status === 'ACTIVE' ? 'activa' : 'falta inicial'}
                    tone={order.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                }
                onPress={() => router.push(`/(app)/compra/${order.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  greetingText: { gap: space.xxs },
  lineCard: { backgroundColor: color.surface.secondary, borderRadius: radius.xxl },
  lineMeta: { flexDirection: 'row', gap: space.xl },
  lineMetaItem: { gap: space.xxs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
