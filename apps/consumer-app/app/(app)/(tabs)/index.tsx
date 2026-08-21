/**
 * Inicio.
 *
 * Responde en un vistazo las tres preguntas que trae quien abre la app: cuanto puedo gastar, cuanto
 * debo y que me vence primero. Todo lo demas baja en la jerarquia.
 */
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { formatMoney } from '../../../src/domain/money';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, BrandPanel, Button, Card, Divider, EmptyState, ListRow, ProgressBar, Skeleton } from '../../../src/ui/primitives';
import { Icon } from '../../../src/ui/icons';
import { PartnerBanner } from '../../../src/ui/partner-banner';
import { spendingReportUrl } from '../../../src/api/endpoints/loans';
import { categoryLook, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { color, radius } from '../../../src/theme/tokens';
import { dueLabel, statusTone, statusLabel } from '../../../src/features/payment-copy';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS, TOUR_INICIO_TARGETS } from '../../../src/features/tour-inicio';
import { TourTarget, shouldAutoStart, useTour } from '../../../src/ui/tour';

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();

  const firstName = session.me?.profile.firstName ?? '';
  /*
   * El libro de credito REAL, del backend. Convive con el motor local de compra mientras el dominio
   * V3 no exista en el servidor: la linea y las compras siguen saliendo del sandbox, pero el dinero
   * que se debe, su reparto por rubro y la mora salen de `loans`, que es lo que de verdad se cobra.
   */
  const book = useCreditBook(session.customerId);
  const spending = book.spending;
  const currency = spending?.currencyCode ?? 'BOB';
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

      {/*
        LO PRIMERO cuando hay mora, por encima incluso de la linea disponible.

        Quien abre la app debiendo dinero vencido no entro a ver cuanto puede gastar. Ensenarle
        primero el disponible seria invitarle a aumentar una deuda que ya no esta pagando.
      */}
      {spending && spending.totals.overdue > 0 ? (
        <Card style={styles.moraCard}>
          <View style={styles.rowCenter}>
            <Icon name="alerta" size={24} tint={color.feedback.danger} />
            <AtlasText variant="h3">Tienes pagos pendientes que debes regularizar</AtlasText>
          </View>
          <AtlasText variant="amount" style={{ color: color.feedback.danger }}>
            {formatAmount(spending.totals.overdue, currency)}
          </AtlasText>
          <AtlasText variant="body" tone="secondary">
            Si no regularizas, empezaran a correr intereses sobre el capital vencido. Incumplir nuestras politicas
            puede llevar a la suspension de tu cuenta.
          </AtlasText>
          <Button label="Ver que debo pagar" onPress={() => router.push('/(app)/(tabs)/pagos')} />
          <Button label="Leer terminos y condiciones" variant="secondary" onPress={() => router.push('/(app)/politica-mora')} />
        </Card>
      ) : null}

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

      {/* El tablero de gasto por rubro. Sale del comercio donde nacio cada credito. */}
      {spending && spending.categories.length > 0 ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <Icon name="grafico" size={20} tint={color.action.primary} />
              <AtlasText variant="h3">En que gastas</AtlasText>
            </View>
            <Badge label={String(spending.totals.loanCount) + (spending.totals.loanCount === 1 ? ' compra' : ' compras')} tone="neutral" />
          </View>
          <Divider />

          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <AtlasText variant="caption" tone="tertiary">
                FINANCIADO
              </AtlasText>
              <AtlasText variant="amountSmall">{formatAmount(spending.totals.financed, currency)}</AtlasText>
            </View>
            <View style={styles.totalItem}>
              <AtlasText variant="caption" tone="tertiary">
                POR PAGAR
              </AtlasText>
              <AtlasText variant="amountSmall">{formatAmount(spending.totals.outstanding, currency)}</AtlasText>
            </View>
          </View>

          {spending.categories.map((item) => {
            const look = categoryLook(item.category);
            const others = item.merchants.length - 1;
            return (
              <Pressable
                key={item.category}
                style={styles.categoryRow}
                onPress={() => router.push('/(app)/(tabs)/pagos')}
                accessibilityRole="button"
                accessibilityLabel={look.label + ': ' + item.share.toFixed(0) + ' por ciento de tu gasto'}
              >
                <View style={styles.categoryIcon}>
                  <Icon name={look.icon} size={20} tint={item.overdue > 0 ? color.feedback.danger : color.action.primary} />
                </View>
                <View style={styles.categoryText}>
                  <View style={styles.rowBetween}>
                    <AtlasText variant="bodyStrong">{look.label}</AtlasText>
                    <AtlasText variant="bodyStrong">{formatAmount(item.financed, currency)}</AtlasText>
                  </View>
                  {/*
                    La barra usa el porcentaje que YA calculo el servidor: recalcularlo aqui haria
                    que la pantalla y el PDF discreparan por redondeo.
                  */}
                  <ProgressBar value={item.share} label={look.label + ': ' + item.share.toFixed(0) + ' por ciento'} />
                  <AtlasText variant="caption" tone="tertiary">
                    {item.share.toFixed(0)} % · {item.merchants[0]?.displayName ?? 'sin comercio'}
                    {others > 0 ? ' y ' + others + ' mas' : ''}
                  </AtlasText>
                </View>
              </Pressable>
            );
          })}

          <Divider />
          {/*
            El informe lo compone el SERVIDOR y se abre en el visor del sistema. Traerlo a memoria
            para reescribirlo en disco no anade nada y deja una copia del documento en el telefono.
          */}
          <Button
            label="Descargar informe en PDF"
            variant="secondary"
            onPress={() => {
              if (session.customerId) void Linking.openURL(spendingReportUrl(session.customerId));
            }}
          />
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

      {/* Al final del inicio: lo comercial nunca por encima de lo que el cliente debe. */}
      <PartnerBanner />
      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  greetingText: { gap: space.xxs },
  lineMeta: { flexDirection: 'row', gap: space.xl },
  lineMetaItem: { gap: space.xxs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  moraCard: { borderColor: color.feedback.danger, borderWidth: 1, gap: space.sm },
  totalsRow: { flexDirection: 'row', gap: space.xl },
  totalItem: { gap: space.xxs },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raisedStrong,
  },
  categoryText: { flex: 1, gap: space.xxs },
});
