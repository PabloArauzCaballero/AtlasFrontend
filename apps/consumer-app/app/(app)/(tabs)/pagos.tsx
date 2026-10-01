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
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LoanSummary, PaymentCalendar, SpendingByCategory } from '../../../src/api/endpoints/loans';
import { amountTone, categoryLook, dueCopy, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useSession } from '../../../src/session/session';
import { color, radius, space } from '../../../src/theme/tokens';
import type { IconName } from '../../../src/ui/icons';
import { Appear, PressSurface } from '../../../src/ui/motion';
import { PaymentCalendarView } from '../../../src/ui/payment-calendar';
import { Gap, HeaderAction, Screen, ScreenHeader } from '../../../src/ui/layout';
import { useCopy } from '../../../src/features/use-contenido-remoto';
import {
  AtlasText,
  Badge,
  Button,
  Card,
  CardHeader,
  Chip,
  ChipBar,
  Divider,
  EmptyState,
  ErrorState,
  IconChip,
  ListRow,
  Skeleton,
  Stat,
} from '../../../src/ui/primitives';

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

const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
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
  const t = useCopy();
  const router = useRouter();
  const session = useSession();
  const book = useCreditBook(session.customerId);

  const [filter, setFilter] = useState<Filter>('todos');
  const [layout, setLayout] = useState<Layout>('lista');

  const spending = book.spending;
  const calendar = book.calendar;
  const overdue = useMemo(() => overdueByPartner(spending), [spending]);
  const upcomingLoans = useMemo(() => loansWithUpcomingOnly(calendar), [calendar]);

  /*
   * El predicado de cada filtro, en un solo sitio.
   *
   * Estaba escrito como una cadena de `if` dentro del `useMemo` que calcula lo visible, asi que la
   * cifra que ahora lleva cada chip no tenia de donde salir sin duplicar las reglas — y una cuenta
   * duplicada es una cuenta que algun dia dice «3» encima de una lista de dos.
   *
   * El filtro de mora se resuelve por COMERCIO y no por prestamo: lo vencido llega agregado por
   * comercio, que es el nivel al que esta pantalla agrupa. Un comercio con algo vencido muestra
   * todos sus creditos, porque para regularizar hay que verlos juntos.
   */
  const matches = useCallback(
    (loan: LoanSummary, key: Filter) => {
      if (key === 'mora') return (overdue.get(loan.merchant?.partnerProfileId ?? 'sin_comercio') ?? 0) > 0;
      if (key === 'proximos') return upcomingLoans.has(loan.loanId);
      if (key === 'pagados') return loan.status === 'paid_off';
      return true;
    },
    [overdue, upcomingLoans],
  );

  const visible = useMemo(() => book.loans.filter((loan) => matches(loan, filter)), [book.loans, filter, matches]);

  /*
   * Cuantos hay detras de cada filtro. Sin la cifra, elegir un filtro es una apuesta: se toca «En
   * mora», la lista se vacia, y no queda claro si es que no hay mora o si la pantalla ha fallado.
   */
  const counts = useMemo(() => {
    const tally = { todos: 0, mora: 0, proximos: 0, pagados: 0 } as Record<Filter, number>;
    for (const loan of book.loans) {
      for (const key of ['todos', 'mora', 'proximos', 'pagados'] as Filter[]) {
        if (matches(loan, key)) tally[key] += 1;
      }
    }
    return tally;
  }, [book.loans, matches]);

  const overdueOfLoan = useMemo(() => overdueByLoan(calendar), [calendar]);
  const groups = useMemo(() => groupByMerchant(visible, overdueOfLoan), [visible, overdueOfLoan]);
  const currency = spending?.currencyCode ?? 'BOB';
  /*
    La vista que viene despues de la actual. El boton de la cabecera enseña a DONDE lleva, no donde
    se esta: un control que dibuja el estado actual y ademas lo cambia al tocarlo se lee al reves la
    mitad de las veces.
  */
  const siguienteVista = LAYOUT_ORDER[(LAYOUT_ORDER.indexOf(layout) + 1) % LAYOUT_ORDER.length] ?? 'lista';

  if (!book.ready) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card>
          <Skeleton height={11} width="35%" />
          <Skeleton height={23} width="55%" />
        </Card>
        <Card>
          <Skeleton height={17} width="45%" />
          <Skeleton height={1} />
          <Skeleton height={40} />
          <Skeleton height={40} />
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
      <ScreenHeader
        title="Tus pagos"
        subtitle={t.texto('pagos.subtitulo')}
        action={
          <HeaderAction
            icon={LAYOUT_ICON[siguienteVista]}
            label={LAYOUT_LABEL[siguienteVista]}
            onPress={() => setLayout(siguienteVista)}
          />
        }
      />

      {/* 1. LO VENCIDO. Va primero y solo, para que no compita con nada. */}
      {spending && spending.totals.overdue > 0 ? (
        <Appear index={0}>
        <Card tone="danger">
          <CardHeader
            icon="alerta"
            iconTone="danger"
            eyebrow="En mora"
            title="Tienes pagos vencidos"
            detail={`${spending.totals.overdueLoanCount} ${spending.totals.overdueLoanCount === 1 ? 'crédito' : 'créditos'} con cuotas vencidas`}
          />
          <AtlasText variant="amount" tone="danger">
            {formatAmount(spending.totals.overdue, currency)}
          </AtlasText>
          <Button label="Ver qué debo regularizar" onPress={() => setFilter('mora')} />
        </Card>
        </Appear>
      ) : null}

      {/* 2. LO QUE VENCE PRONTO. Ambar: exige atencion, no alarma. */}
      {spending && spending.totals.upcoming > 0 ? (
        <Card padding="tight">
          <View style={styles.rowCenter}>
            <IconChip name="reloj" tone="warning" size="sm" />
            <Stat label="Por pagar" value={formatAmount(spending.totals.upcoming, currency)} tone="warning" style={styles.flex} />
            {spending.nextDueDate ? <Badge dot label={dueCopy(spending.nextDueDate)} tone="warning" /> : null}
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
            icon="pagos"
            title={t.titulo('pagos.vacio')}
            detail={t.texto('pagos.vacio')}
            action={<Button label="Ver en lista" variant="secondary" onPress={() => setLayout('lista')} />}
          />
        )
      ) : null}

      {/* 4. Filtros. */}
      {layout !== 'calendario' ? (
      <ChipBar>
        {FILTERS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            icon={option.icon}
            count={counts[option.key]}
            selected={filter === option.key}
            onPress={() => setFilter(option.key)}
            accessibilityLabel={`Filtrar por ${option.label}: ${counts[option.key]}`}
          />
        ))}
      </ChipBar>
      ) : null}

      {/* 5. Los comercios. */}
      {layout === 'calendario' ? null : groups.length === 0 ? (
        <EmptyState
          icon={filter === 'todos' ? 'billetera' : 'filtro'}
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
                <IconChip name={look.icon} tone={group.overdueAmount > 0 ? 'danger' : 'brand'} />
                <View style={styles.gridText}>
                  <AtlasText variant="title" numberOfLines={2}>
                    {group.displayName}
                  </AtlasText>
                  <AtlasText variant="caption" tone="tertiary">
                    {look.label}
                  </AtlasText>
                </View>
                <AtlasText variant="amountSmall" tone={group.overdueAmount > 0 ? 'danger' : 'primary'}>
                  {formatAmount(group.outstanding, currency)}
                </AtlasText>
              </PressSurface>
            );
          })}
        </View>
      ) : (
        <Card padding="tight">
          {groups.map((group, index) => {
            const look = categoryLook(group.category);
            return (
              <View key={group.key}>
                {index > 0 ? <Divider inset /> : null}
                <ListRow
                  title={group.displayName}
                  subtitle={`${look.label} · ${group.loans.length} ${group.loans.length === 1 ? 'crédito' : 'créditos'}`}
                  icon={look.icon}
                  right={
                    group.overdueAmount > 0 ? (
                      <Badge label={formatAmount(group.overdueAmount, currency) + ' en mora'} tone="danger" />
                    ) : (
                      <AtlasText variant="amountMicro">{formatAmount(group.outstanding, currency)}</AtlasText>
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
        <Card padding="tight">
          <CardHeader icon="grafico" iconTone="neutral" title="Resumen por rubro" />
          {spending.categories.map((item, index) => {
            const look = categoryLook(item.category);
            const tone = amountTone(item);
            return (
              <View key={item.category}>
                {index > 0 ? <Divider inset /> : null}
                <ListRow
                  title={look.label}
                  subtitle={`${item.share.toFixed(0)} % de lo financiado · ${item.loanCount} ${item.loanCount === 1 ? 'compra' : 'compras'}`}
                  icon={look.icon}
                  right={
                    <AtlasText variant="amountMicro" tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'primary'}>
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
  flex: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  /*
    La celda de la cuadricula es una TARJETA, con su contorno y su filo iluminado, no un rectangulo
    de color un poco mas claro. Sin contorno, ocho celdas sobre el fondo se leen como ocho manchas y
    la cuadricula pierde justo lo que la hace util: que cada comercio sea un objeto separado.

    `flexBasis: 46%` con `gap` de 12 deja dos columnas en un telefono y tres en cuanto hay ancho,
    sin tener que medir la ventana.
  */
  gridCell: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: space.sm,
    padding: space.base,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    backgroundColor: color.surface.raised,
  },
  gridText: { gap: space.xxs },
});
