/**
 * Inicio.
 *
 * Responde en un vistazo las tres preguntas que trae quien abre la app: cuanto puedo gastar, cuanto
 * debo y que me vence primero. Todo lo demas baja en la jerarquia.
 */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { formatMoney } from '../../../src/domain/money';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, BrandPanel, Button, Card, Divider, EmptyState, ListRow, Skeleton } from '../../../src/ui/primitives';
import { dueLabel, statusTone, statusLabel } from '../../../src/features/payment-copy';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS, TOUR_INICIO_TARGETS } from '../../../src/features/tour-inicio';
import { TourTarget, shouldAutoStart, useTour } from '../../../src/ui/tour';

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();

  const firstName = session.me?.profile.firstName ?? '';
  const activeOrders = sandbox.state.orders.filter((order) => order.status === 'ACTIVE' || order.status === 'WAITING_INITIAL_PAYMENT');

  const tour = useTour();
  /*
    El recorrido se lanza solo una vez y SOLO si no hay nada que atender.

    Quien abre la app con una cuota por pagar entro a resolver eso; superponerle un tutorial de tres
    pasos convierte la ayuda en un obstaculo. Con compras activas tampoco hace falta: si llego a
    tener una, ya recorrio el flujo entero.

    Se espera a `sandbox.ready` porque hasta entonces la pantalla son esqueletos, y medir el objetivo
    sobre un esqueleto deja el recorte en el sitio equivocado.
  */
  useEffect(() => {
    if (!sandbox.ready || activeOrders.length > 0 || sandbox.nextDue) return;
    let cancelled = false;
    void shouldAutoStart(TOUR_INICIO_KEY).then((should) => {
      if (should && !cancelled) tour.start(TOUR_INICIO_STEPS, TOUR_INICIO_KEY);
    });
    return () => {
      cancelled = true;
    };
    // `tour.start` es estable y las dependencias reales son las tres condiciones de arranque.
  }, [sandbox.ready, sandbox.nextDue, activeOrders.length, tour]);

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

      <TourTarget id={TOUR_INICIO_TARGETS.linea}>
        <BrandPanel>
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

          <TourTarget id={TOUR_INICIO_TARGETS.escanear}>
            <Button label="Escanear QR del comercio" onPress={() => router.push('/(app)/(tabs)/escanear')} />
          </TourTarget>
        </BrandPanel>
      </TourTarget>

      <TourTarget id={TOUR_INICIO_TARGETS.pagos}>
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
        ) : (
          /*
            Sin proximo pago el paso del recorrido necesita igual algo a lo que apuntar. En vez de un
            hueco vacio se explica el invariante que va a nombrar, que ademas es justo lo que alguien
            sin compras se esta preguntando: donde se paga esto.
          */
          <Card>
            <AtlasText variant="h3">Tus pagos</AtlasText>
            <Divider />
            <AtlasText variant="body" tone="secondary">
              Cuando tengas una compra activa, aqui aparece tu proxima cuota y el QR bancario del comercio donde
              pagarla.
            </AtlasText>
          </Card>
        )}
      </TourTarget>

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
  lineMeta: { flexDirection: 'row', gap: space.xl },
  lineMetaItem: { gap: space.xxs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
