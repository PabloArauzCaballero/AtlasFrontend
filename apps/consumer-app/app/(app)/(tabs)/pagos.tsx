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
import { StyleSheet, View } from 'react-native';
import type { LoanSummary, PaymentCalendar, SpendingByCategory } from '../../../src/api/endpoints/loans';
import { amountTone, categoryLook, dueCopy, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useSession } from '../../../src/session/session';
import { color, radius, space } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';
import { Appear, PressSurface } from '../../../src/ui/motion';
import { PaymentCalendarView } from '../../../src/ui/payment-calendar';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, EmptyState, ErrorState, ListRow, Skeleton } from '../../../src/ui/primitives';

type Filter = 'todos' | 'mora' | 'proximos' | 'pagados';
type Layout = 'lista' | 'cuadricula' | 'calendario';

/*
 * Tres vistas del mismo dinero, y se rota entre ellas en este orden a proposito: lista (a quien le
 * debo), cuadricula (lo mismo de un vistazo) y calendario (cuando me toca). El calendario va al
 * final porque responde otra pregunta, no una version mas bonita de la primera.
 */
const LAYOUT_ORDER: Layout[] = ['lista', 'cuadricula', 'calendario'];
const LAYOUT_ICON: Record<Layout, IconName> = { lista: 'lista', cuadricula: 'cuadricula', calendario: 'pagos' };
const LAYOUT_LABEL: Record<Layout, string> = {
  lista: 'Ver en lista',
  cuadricula: 'Ver en cuadrícula',
  calendario: 'Ver en calendario',
};

/** Un comercio con todo lo suyo junto: es la unidad con la que el cliente piensa sus compras. */
type MerchantGroup = {
  key: string;
  displayName: string;
  category: string;
  loans: LoanSummary[];
  outstanding: number;
  /** Importe VENCIDO de los creditos QUE SE ESTAN VIENDO, medido contra el calendario. */
  overdueAmount: number;
};

const FILTERS: Array<{ key: Filter; label: string; icon: IconName }> = [
  { key: 'todos', label: 'Todos', icon: 'lista' },
  { key: 'mora', label: 'En mora', icon: 'alerta' },
  { key: 'proximos', label: 'Próximos', icon: 'reloj' },
  { key: 'pagados', label: 'Pagados', icon: 'check' },
];

/**
 * Que creditos tienen alguna cuota POR VENCER y ninguna vencida.
 *
 * El filtro «Proximos» hacia `loan.status === 'active'`, es decir: TODOS los creditos vivos. Salia
 * lo mismo que en «En mora» mas los que estaban al dia, asi que los dos filtros contestaban a la
 * misma pregunta y ninguno contestaba la suya. «Proximo» no es «activo»: es «no me he pasado
 * todavia, pero me toca».
 *
 * Se resuelve por CUOTA y no por prestamo porque es la cuota la que vence. El calendario ya las
 * trae clasificadas por el servidor, asi que aqui solo se agrupan.
 */
function loansWithUpcomingOnly(calendar: PaymentCalendar | null): Set<string> {
  const upcoming = new Set<string>();
  const overdue = new Set<string>();

  for (const entry of calendar?.entries ?? []) {
    if (entry.state === 'overdue') overdue.add(entry.loanId);
    else if (entry.state === 'upcoming') upcoming.add(entry.loanId);
  }

  for (const loanId of overdue) upcoming.delete(loanId);
  return upcoming;
}

/**
 * Que comercios tienen algo VENCIDO, segun el calendario.
 *
 * No se usa `loan.daysPastDue`: ese contador lo actualiza un barrido periodico, y entre barrido y
 * barrido una cuota puede haber vencido sin que el prestamo lo diga. Se vio en la propia demo — el
 * total de arriba marcaba mora y la lista de abajo no—. El reparto por rubro ya trae lo vencido POR
 * COMERCIO calculado contra las fechas, asi que esa es la unica fuente que usa esta pantalla.
 */
function overdueByPartner(spending: SpendingByCategory | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const category of spending?.categories ?? []) {
    for (const merchant of category.merchants) {
      const key = merchant.partnerProfileId ?? 'sin_comercio';
      map.set(key, (map.get(key) ?? 0) + merchant.overdue);
    }
  }
  return map;
}

/**
 * Lo vencido de cada CREDITO, no de cada comercio.
 *
 * Hace falta porque la insignia del grupo tiene que hablar de los creditos que se estan viendo. Con
 * el filtro «Proximos» los creditos en mora quedan fuera de la lista, y la insignia seguia diciendo
 * «Bs 900,00 en mora» encima de un credito que no debe nada: la fila se contradecia a si misma.
 *
 * Sale del calendario, que ya trae cada cuota clasificada por el servidor.
 */
function overdueByLoan(calendar: PaymentCalendar | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of calendar?.entries ?? []) {
    if (entry.state !== 'overdue') continue;
    map.set(entry.loanId, (map.get(entry.loanId) ?? 0) + entry.pendingAmount);
  }
  return map;
}

function groupByMerchant(loans: readonly LoanSummary[], overdueOfLoan: Map<string, number>): MerchantGroup[] {
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

    // La mora del grupo se suma de los creditos que entran en el, no del comercio entero.
    const loanOverdue = overdueOfLoan.get(loan.loanId) ?? 0;

    if (existing) {
      existing.loans.push(loan);
      existing.outstanding += outstanding;
      existing.overdueAmount += loanOverdue;
    } else {
      groups.set(key, {
        key,
        displayName: loan.merchant?.displayName ?? 'Compra sin comercio registrado',
        category: loan.merchant?.businessCategory ?? 'sin_comercio',
        loans: [loan],
        outstanding,
        overdueAmount: loanOverdue,
      });
    }
  }

  /*
   * Primero quien tiene mora, y dentro de cada bloque quien debe mas. El orden responde «a quien le
   * debo y cuanto», que es la pregunta con la que se abre esta pantalla.
   */
  return [...groups.values()].sort((left, right) => {
    if (left.overdueAmount !== right.overdueAmount) return right.overdueAmount - left.overdueAmount;
    return right.outstanding - left.outstanding;
  });
}

export default function Payments() {
  const router = useRouter();
  const session = useSession();
  const book = useCreditBook(session.customerId);

  const [filter, setFilter] = useState<Filter>('todos');
  const [layout, setLayout] = useState<Layout>('lista');

  const spending = book.spending;
  const calendar = book.calendar;
  const overdue = useMemo(() => overdueByPartner(spending), [spending]);
  const upcomingLoans = useMemo(() => loansWithUpcomingOnly(calendar), [calendar]);

  const visible = useMemo(() => {
    const active = book.loans;
    /*
     * El filtro de mora se resuelve por COMERCIO y no por prestamo: lo vencido llega agregado por
     * comercio, que es el nivel al que esta pantalla agrupa. Un comercio con algo vencido muestra
     * todos sus creditos, porque para regularizar hay que verlos juntos.
     */
    if (filter === 'mora') {
      return active.filter((loan) => (overdue.get(loan.merchant?.partnerProfileId ?? 'sin_comercio') ?? 0) > 0);
    }
    if (filter === 'proximos') return active.filter((loan) => upcomingLoans.has(loan.loanId));
    if (filter === 'pagados') return active.filter((loan) => loan.status === 'paid_off');
    return active;
  }, [book.loans, filter, overdue, upcomingLoans]);

  const overdueOfLoan = useMemo(() => overdueByLoan(calendar), [calendar]);
  const groups = useMemo(() => groupByMerchant(visible, overdueOfLoan), [visible, overdueOfLoan]);
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
        <PressSurface
          onPress={() => setLayout(LAYOUT_ORDER[(LAYOUT_ORDER.indexOf(layout) + 1) % LAYOUT_ORDER.length] ?? 'lista')}
          style={styles.layoutToggle}
          accessibilityRole="button"
          accessibilityLabel={LAYOUT_LABEL[LAYOUT_ORDER[(LAYOUT_ORDER.indexOf(layout) + 1) % LAYOUT_ORDER.length] ?? 'lista']}
        >
          <Icon
            name={LAYOUT_ICON[LAYOUT_ORDER[(LAYOUT_ORDER.indexOf(layout) + 1) % LAYOUT_ORDER.length] ?? 'lista']}
            size={20}
            tint={color.text.primary}
          />
        </PressSurface>
      </View>

      {/* 1. LO VENCIDO. Va primero y solo, para que no compita con nada. */}
      {spending && spending.totals.overdue > 0 ? (
        <Appear index={0}>
        <Card style={styles.overdueCard}>
          <View style={styles.rowCenter}>
            <Icon name="alerta" size={22} tint={color.feedback.danger} />
            <View style={styles.flex}>
              <AtlasText variant="bodyStrong">Tienes pagos en mora</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {spending.totals.overdueLoanCount} {spending.totals.overdueLoanCount === 1 ? 'crédito' : 'créditos'} con cuotas vencidas
              </AtlasText>
            </View>
          </View>
          <AtlasText variant="amountSmall" style={{ color: color.feedback.danger }}>
            {formatAmount(spending.totals.overdue, currency)}
          </AtlasText>
          <Button label="Ver qué debo regularizar" onPress={() => setFilter('mora')} />
        </Card>
        </Appear>
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

      {/*
        3. EL CALENDARIO. Cuando esta activo reemplaza a los filtros y a la lista de comercios: es
        otra forma de mirar el mismo dinero, no un bloque que se apila debajo. Dejar las dos vistas
        a la vez obligaria a decidir cual de las dos manda.
      */}
      {layout === 'calendario' ? (
        calendar && calendar.entries.length > 0 ? (
          <Card>
            <PaymentCalendarView
              calendar={calendar}
              onOpenEntry={(entry) => router.push(`/(app)/cuota/${entry.loanId}/${entry.installmentNumber}`)}
            />
          </Card>
        ) : (
          <EmptyState
            title="Todavía no hay cuotas que mostrar"
            detail="Cuando compres con Atlas, aquí verás en qué día te toca cada pago."
            action={<Button label="Ver en lista" variant="secondary" onPress={() => setLayout('lista')} />}
          />
        )
      ) : null}

      {/* 4. Filtros. */}
      {layout !== 'calendario' ? (
      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <PressSurface
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
            </PressSurface>
          );
        })}
      </View>
      ) : null}

      {/* 5. Los comercios. */}
      {layout === 'calendario' ? null : groups.length === 0 ? (
        <EmptyState
          title={filter === 'todos' ? 'Todavía no tienes créditos' : 'Nada en este filtro'}
          detail={
            filter === 'todos'
              ? 'Cuando compres con Atlas, aquí aparecerán tus cuotas agrupadas por comercio.'
              : 'Prueba con otro filtro para ver el resto de tus créditos.'
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
              <PressSurface
                key={group.key}
                style={styles.gridCell}
                onPress={() => router.push(`/(app)/comercio/${group.key}`)}
                accessibilityRole="button"
                accessibilityLabel={`Ver créditos de ${group.displayName}`}
              >
                <View style={styles.gridIcon}>
                  <Icon name={look.icon} size={22} tint={group.overdueAmount > 0 ? color.feedback.danger : color.action.primary} />
                </View>
                <AtlasText variant="bodyStrong" numberOfLines={2}>
                  {group.displayName}
                </AtlasText>
                <AtlasText variant="caption" tone="tertiary">
                  {look.label}
                </AtlasText>
                <AtlasText variant="bodyStrong" style={{ color: group.overdueAmount > 0 ? color.feedback.danger : color.text.primary }}>
                  {formatAmount(group.outstanding, currency)}
                </AtlasText>
              </PressSurface>
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
                  subtitle={`${look.label} · ${group.loans.length} ${group.loans.length === 1 ? 'crédito' : 'créditos'}`}
                  icon={look.icon}
                  right={
                    group.overdueAmount > 0 ? (
                      <Badge label={formatAmount(group.overdueAmount, currency) + ' en mora'} tone="danger" />
                    ) : (
                      <AtlasText variant="bodyStrong">{formatAmount(group.outstanding, currency)}</AtlasText>
                    )
                  }
                  onPress={() => router.push(`/(app)/comercio/${group.key}`)}
                  accessibilityHint="Abrir para ver los créditos de este comercio"
                />
              </View>
            );
          })}
        </Card>
      )}

      {/* 6. El resumen por rubro, AL FINAL: es informativo, no accionable. */}
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
