/**
 * Pagos.
 *
 * ## El orden es la decision de esta pantalla
 *
 * Arriba lo VENCIDO, despues lo que vence pronto, y solo entonces el resumen por rubro. Se pidio
 * que los pendientes salieran antes que las categorias; la recomendacion va un paso mas alla y
 * separa vencido de por-vencer, porque no son la misma urgencia. Mezclarlos en un unico bloque rojo
 * enseña a ignorar el rojo, y el dia que hay una mora de verdad ya nadie lo mira.
 *
 * ## De donde salen los numeros
 *
 * Del libro de prestamos de AtlasBackend, no del motor local: cada credito trae el comercio donde
 * nacio y su rubro. La agrupacion por comercio se hace aqui porque es presentacion; el reparto por
 * rubro y lo vencido llegan ya calculados del servidor.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LoanSummary } from '../../../src/api/endpoints/loans';
import { amountTone, categoryLook, dueCopy, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useSession } from '../../../src/session/session';
import { color, radius, space } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, EmptyState, ErrorState, ListRow, Skeleton } from '../../../src/ui/primitives';

type Filter = 'todos' | 'mora' | 'proximos' | 'pagados';
type Layout = 'lista' | 'cuadricula';

/** Un comercio con todo lo suyo junto: es la unidad con la que el cliente piensa sus compras. */
type MerchantGroup = {
  key: string;
  displayName: string;
  category: string;
  loans: LoanSummary[];
  outstanding: number;
  overdueLoans: number;
};

const FILTERS: Array<{ key: Filter; label: string; icon: IconName }> = [
  { key: 'todos', label: 'Todos', icon: 'lista' },
  { key: 'mora', label: 'En mora', icon: 'alerta' },
  { key: 'proximos', label: 'Proximos', icon: 'reloj' },
  { key: 'pagados', label: 'Pagados', icon: 'check' },
];

function groupByMerchant(loans: readonly LoanSummary[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();

  for (const loan of loans) {
    /*
     * Los creditos sin comercio se agrupan bajo una clave propia y no se reparten entre los demas:
     * atribuirlos a cualquiera seria inventar donde compro el cliente, que es justo el dato que se
     * quiere que sea cierto.
     */
    const key = loan.merchant?.partnerProfileId ?? 'sin_comercio';
    const existing = groups.get(key);
    const outstanding = Number(loan.outstandingPrincipal ?? 0);
    const overdue = loan.daysPastDue > 0 ? 1 : 0;

    if (existing) {
      existing.loans.push(loan);
      existing.outstanding += outstanding;
      existing.overdueLoans += overdue;
    } else {
      groups.set(key, {
        key,
        displayName: loan.merchant?.displayName ?? 'Compra sin comercio registrado',
        category: loan.merchant?.businessCategory ?? 'sin_comercio',
        loans: [loan],
        outstanding,
        overdueLoans: overdue,
      });
    }
  }

  /*
   * Primero quien tiene mora, y dentro de cada bloque quien debe mas. El orden responde «a quien le
   * debo y cuanto», que es la pregunta con la que se abre esta pantalla.
   */
  return [...groups.values()].sort((left, right) => {
    if (left.overdueLoans !== right.overdueLoans) return right.overdueLoans - left.overdueLoans;
    return right.outstanding - left.outstanding;
  });
}

export default function Payments() {
  const router = useRouter();
  const session = useSession();
  const book = useCreditBook(session.customerId);

  const [filter, setFilter] = useState<Filter>('todos');
  const [layout, setLayout] = useState<Layout>('lista');

  const visible = useMemo(() => {
    const active = book.loans;
    if (filter === 'mora') return active.filter((loan) => loan.daysPastDue > 0);
    if (filter === 'proximos') return active.filter((loan) => loan.daysPastDue === 0 && loan.status === 'active');
    if (filter === 'pagados') return active.filter((loan) => loan.status === 'paid_off');
    return active;
  }, [book.loans, filter]);

  const groups = useMemo(() => groupByMerchant(visible), [visible]);
  const spending = book.spending;
  const currency = spending?.currencyCode ?? 'BOB';

  if (!book.ready) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card>
          <Skeleton height={14} width="40%" />
          <Skeleton height={32} width="60%" />
        </Card>
        <Card>
          <Skeleton height={14} width="50%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </Card>
      </Screen>
    );
  }

  if (book.error) {
    return (
      <Screen>
        <Gap size="lg" />
        <ErrorState title="No pudimos cargar tus pagos" detail={book.error} />
        <Button label="Reintentar" variant="secondary" onPress={() => void book.reload()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Gap size="sm" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AtlasText variant="h1">Tus pagos</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Agrupados por el comercio donde compraste.
          </AtlasText>
        </View>
        <Pressable
          onPress={() => setLayout(layout === 'lista' ? 'cuadricula' : 'lista')}
          style={styles.layoutToggle}
          accessibilityRole="button"
          accessibilityLabel={layout === 'lista' ? 'Ver en cuadricula' : 'Ver en lista'}
        >
          <Icon name={layout === 'lista' ? 'cuadricula' : 'lista'} size={20} tint={color.text.primary} />
        </Pressable>
      </View>

      {/* 1. LO VENCIDO. Va primero y solo, para que no compita con nada. */}
      {spending && spending.totals.overdue > 0 ? (
        <Card style={styles.overdueCard}>
          <View style={styles.rowCenter}>
            <Icon name="alerta" size={22} tint={color.feedback.danger} />
            <View style={styles.flex}>
              <AtlasText variant="bodyStrong">Tienes pagos en mora</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {spending.totals.overdueLoanCount} {spending.totals.overdueLoanCount === 1 ? 'credito' : 'creditos'} con cuotas vencidas
              </AtlasText>
            </View>
          </View>
          <AtlasText variant="amountSmall" style={{ color: color.feedback.danger }}>
            {formatAmount(spending.totals.overdue, currency)}
          </AtlasText>
          <Button label="Ver que debo regularizar" onPress={() => setFilter('mora')} />
        </Card>
      ) : null}

      {/* 2. LO QUE VENCE PRONTO. Ambar: exige atencion, no alarma. */}
      {spending && spending.totals.upcoming > 0 ? (
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="reloj" size={20} tint={color.feedback.warning} />
            <View style={styles.flex}>
              <AtlasText variant="caption" tone="tertiary">
                POR PAGAR
              </AtlasText>
              <AtlasText variant="amountSmall" style={{ color: color.feedback.warning }}>
                {formatAmount(spending.totals.upcoming, currency)}
              </AtlasText>
            </View>
            {spending.nextDueDate ? <Badge label={dueCopy(spending.nextDueDate)} tone="warning" /> : null}
          </View>
        </Card>
      ) : null}

      {/* 3. Filtros. */}
      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filtrar por ${option.label}`}
            >
              <Icon name={option.icon} size={15} tint={active ? color.surface.primary : color.text.secondary} />
              <AtlasText variant="caption" style={{ color: active ? color.surface.primary : color.text.secondary }}>
                {option.label}
              </AtlasText>
            </Pressable>
          );
        })}
      </View>

      {/* 4. Los comercios. */}
      {groups.length === 0 ? (
        <EmptyState
          title={filter === 'todos' ? 'Todavia no tienes creditos' : 'Nada en este filtro'}
          detail={
            filter === 'todos'
              ? 'Cuando compres con Atlas, aqui apareceran tus cuotas agrupadas por comercio.'
              : 'Prueba con otro filtro para ver el resto de tus creditos.'
          }
          action={
            filter === 'todos' ? (
              <Button label="Escanear un QR" variant="secondary" onPress={() => router.push('/(app)/(tabs)/escanear')} />
            ) : (
              <Button label="Ver todos" variant="secondary" onPress={() => setFilter('todos')} />
            )
          }
        />
      ) : layout === 'cuadricula' ? (
        <View style={styles.grid}>
          {groups.map((group) => {
            const look = categoryLook(group.category);
            return (
              <Pressable
                key={group.key}
                style={styles.gridCell}
                onPress={() => router.push(`/(app)/comercio/${group.key}`)}
                accessibilityRole="button"
                accessibilityLabel={`Ver creditos de ${group.displayName}`}
              >
                <View style={styles.gridIcon}>
                  <Icon name={look.icon} size={22} tint={group.overdueLoans > 0 ? color.feedback.danger : color.action.primary} />
                </View>
                <AtlasText variant="bodyStrong" numberOfLines={2}>
                  {group.displayName}
                </AtlasText>
                <AtlasText variant="caption" tone="tertiary">
                  {look.label}
                </AtlasText>
                <AtlasText variant="bodyStrong" style={{ color: group.overdueLoans > 0 ? color.feedback.danger : color.text.primary }}>
                  {formatAmount(group.outstanding, currency)}
                </AtlasText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Card>
          {groups.map((group, index) => {
            const look = categoryLook(group.category);
            return (
              <View key={group.key}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  title={group.displayName}
                  subtitle={`${look.label} · ${group.loans.length} ${group.loans.length === 1 ? 'credito' : 'creditos'}`}
                  icon={look.icon}
                  right={
                    group.overdueLoans > 0 ? (
                      <Badge label="En mora" tone="danger" />
                    ) : (
                      <AtlasText variant="bodyStrong">{formatAmount(group.outstanding, currency)}</AtlasText>
                    )
                  }
                  onPress={() => router.push(`/(app)/comercio/${group.key}`)}
                  accessibilityHint="Abrir para ver los creditos de este comercio"
                />
              </View>
            );
          })}
        </Card>
      )}

      {/* 5. El resumen por rubro, AL FINAL: es informativo, no accionable. */}
      {spending && spending.categories.length > 0 ? (
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="grafico" size={18} tint={color.text.secondary} />
            <AtlasText variant="h3">Resumen por rubro</AtlasText>
          </View>
          {spending.categories.map((item, index) => {
            const look = categoryLook(item.category);
            const tone = amountTone(item);
            return (
              <View key={item.category}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  title={look.label}
                  subtitle={`${item.share.toFixed(0)} % de lo financiado · ${item.loanCount} ${item.loanCount === 1 ? 'compra' : 'compras'}`}
                  icon={look.icon}
                  right={
                    <AtlasText
                      variant="bodyStrong"
                      style={{
                        color:
                          tone === 'danger' ? color.feedback.danger : tone === 'warning' ? color.feedback.warning : color.text.primary,
                      }}
                    >
                      {formatAmount(item.outstanding, currency)}
                    </AtlasText>
                  }
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  flex: { flex: 1, gap: space.xxs },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  layoutToggle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  overdueCard: { borderColor: color.feedback.danger, borderWidth: 1, gap: space.sm },
  filters: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raised,
  },
  chipActive: { backgroundColor: color.action.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridCell: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
  },
  gridIcon: { marginBottom: space.xxs },
});
