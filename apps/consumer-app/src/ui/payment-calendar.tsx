/**
 * El calendario de pagos: en que dia le toca cada cuota, y de que color.
 *
 * ## Por que un mes y no una lista
 *
 * Una lista responde «que debo». Un calendario responde «cuando», que es otra pregunta: la de quien
 * cobra el dia 15 y necesita saber si llega. La rejilla enseña los huecos —las semanas sin nada— y
 * las acumulaciones —tres cuotas el mismo dia—, que una lista ordenada por fecha esconde porque las
 * pinta a la misma distancia unas de otras.
 *
 * ## El color es del servidor
 *
 * Rojo lo vencido, ambar lo que esta por vencer, verde lo pagado. El estado NO se calcula aqui: cada
 * cuota llega ya clasificada, comparada contra el reloj del servidor. Un telefono con la fecha
 * corrida pintaria de rojo una cuota que no ha vencido, y eso —en una app de credito— es acusar a
 * alguien de una mora que no tiene.
 *
 * Tampoco se usa el `new Date()` del dispositivo para marcar HOY: viene en la respuesta.
 *
 * ## El color no va solo
 *
 * Cada dia con cuota lleva su punto de color Y su cifra, y la leyenda nombra los tres estados. Una
 * rejilla que solo se distingue por color deja fuera a quien no distingue rojo de verde, que en
 * castellano son justo «me pasé» y «voy bien».
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalendarEntry, PaymentCalendar } from '../api/endpoints/loans';
import { formatAmount } from '../features/spending-copy';
import { color, press, radius, space } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { PressSurface } from './motion';
import { AtlasText, Divider } from './primitives';

type EntryState = CalendarEntry['state'];

const STATE_LOOK: Record<EntryState, { label: string; tint: string; icon: IconName }> = {
  overdue: { label: 'Vencida', tint: color.feedback.danger, icon: 'alerta' },
  upcoming: { label: 'Por vencer', tint: color.feedback.warning, icon: 'reloj' },
  paid: { label: 'Pagada', tint: color.feedback.success, icon: 'check' },
  written_off: { label: 'Castigada', tint: color.text.tertiary, icon: 'documento' },
};

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-08-21` -> `{ year: 2026, month: 7 }`. Se parte el texto en vez de usar `Date`: un ISO de
 *  solo fecha se interpreta como UTC y en Bolivia (UTC-4) devuelve el dia anterior. */
function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year: year ?? 0, month: (month ?? 1) - 1, day: day ?? 1 };
}

/** El nombre del mes. Con indice fuera de rango devuelve texto vacio en vez de reventar. */
function monthName(month: number): string {
  return MONTHS[month] ?? '';
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** El lunes es el primer dia de la semana: es el calendario que la gente tiene en la pared. */
function leadingBlanks(year: number, month: number): number {
  const weekday = new Date(year, month, 1).getDay();
  return (weekday + 6) % 7;
}

/**
 * Que estado manda cuando un dia tiene varias cuotas.
 *
 * Lo vencido gana siempre, y despues lo que esta por vencer. Un dia que mezcla una cuota pagada con
 * una vencida no es un dia resuelto; pintarlo de verde porque una de las dos se pago seria esconder
 * justo la que hay que mirar.
 */
function dominantState(entries: readonly CalendarEntry[]): EntryState {
  if (entries.some((entry) => entry.state === 'overdue')) return 'overdue';
  if (entries.some((entry) => entry.state === 'upcoming')) return 'upcoming';
  if (entries.some((entry) => entry.state === 'paid')) return 'paid';
  return 'written_off';
}

export function PaymentCalendarView({
  calendar,
  onOpenEntry,
}: {
  calendar: PaymentCalendar;
  /** Abrir el detalle de una cuota. La rejilla dice CUANDO; el detalle, de que se compone. */
  onOpenEntry?: (entry: CalendarEntry) => void;
}) {
  const today = parts(calendar.today);
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState<string | null>(null);

  /** Las cuotas agrupadas por dia, una sola vez: la rejilla consulta 42 celdas por mes. */
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of calendar.entries) {
      const bucket = map.get(entry.dueDate);
      if (bucket) bucket.push(entry);
      else map.set(entry.dueDate, [entry]);
    }
    return map;
  }, [calendar.entries]);

  const shift = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(null);
  };

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const blanks = leadingBlanks(cursor.year, cursor.month);
  const cells: Array<{ key: string; day: number | null }> = [
    ...Array.from({ length: blanks }, (_, index) => ({ key: `blank-${index}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  const selectedEntries = selected ? (byDay.get(selected) ?? []) : [];
  const monthEntries = calendar.entries.filter((entry) => {
    const at = parts(entry.dueDate);
    return at.year === cursor.year && at.month === cursor.month;
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.monthBar}>
        <PressSurface onPress={() => shift(-1)} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Mes anterior">
          <Icon name="atras" size={18} tint={color.text.primary} />
        </PressSurface>
        <View style={styles.monthLabel}>
          <AtlasText variant="bodyStrong">
            {monthName(cursor.month)} {cursor.year}
          </AtlasText>
          <AtlasText variant="caption" tone="tertiary">
            {monthEntries.length === 0
              ? 'Sin cuotas este mes'
              : `${monthEntries.length} ${monthEntries.length === 1 ? 'cuota' : 'cuotas'}`}
          </AtlasText>
        </View>
        <PressSurface onPress={() => shift(1)} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Mes siguiente">
          <Icon name="adelante" size={18} tint={color.text.primary} />
        </PressSurface>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((label, index) => (
          <AtlasText key={`${label}-${index}`} variant="caption" tone="tertiary" style={styles.weekday}>
            {label}
          </AtlasText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          if (cell.day === null) return <View key={cell.key} style={styles.cell} />;

          const iso = `${monthKey(cursor.year, cursor.month)}-${String(cell.day).padStart(2, '0')}`;
          const entries = byDay.get(iso) ?? [];
          const isToday = iso === calendar.today;
          const isSelected = iso === selected;
          const look = entries.length > 0 ? STATE_LOOK[dominantState(entries)] : null;

          return (
            /*
              La celda entera se hunde al tocarla.

              Un dia con cuotas y uno sin ellas se ven casi igual —cambia un punto de color de seis
              pixeles—, asi que sin realimentacion no habia forma de saber cual de los dos se acaba
              de tocar: el que no tiene cuotas esta `disabled` y no pasa nada, y el que si las tiene
              cambiaba la lista de MAS ABAJO, fuera de donde estaba mirando el dedo.
            */
            <PressSurface
              key={cell.key}
              style={[styles.cell, isSelected && styles.cellSelected]}
              onPress={() => setSelected(entries.length > 0 && !isSelected ? iso : null)}
              disabled={entries.length === 0}
              accessibilityRole={entries.length > 0 ? 'button' : undefined}
              accessibilityLabel={
                entries.length > 0
                  ? `${cell.day} de ${monthName(cursor.month)}: ${entries.length} ${entries.length === 1 ? 'cuota' : 'cuotas'}, ${STATE_LOOK[dominantState(entries)].label.toLowerCase()}`
                  : `${cell.day} de ${monthName(cursor.month)}, sin cuotas`
              }
            >
              <View style={[styles.dayNumber, isToday && styles.today]}>
                <AtlasText
                  variant="caption"
                  style={{ color: isToday ? color.surface.primary : entries.length > 0 ? color.text.primary : color.text.tertiary }}
                >
                  {cell.day}
                </AtlasText>
              </View>
              {look ? <View style={[styles.dot, { backgroundColor: look.tint }]} /> : <View style={styles.dotPlaceholder} />}
            </PressSurface>
          );
        })}
      </View>

      <Divider />

      {/* La leyenda nombra los colores: sin ella la rejilla solo la entiende quien ya la entendia. */}
      <View style={styles.legend}>
        {(['overdue', 'upcoming', 'paid'] as const).map((state) => (
          <View key={state} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STATE_LOOK[state].tint }]} />
            <AtlasText variant="caption" tone="tertiary">
              {STATE_LOOK[state].label}
            </AtlasText>
          </View>
        ))}
      </View>

      {/*
        Lo que hay debajo de la rejilla es el dia elegido; si no hay ninguno, el mes entero. Asi la
        pantalla nunca esta vacia: abrirla en un mes con cuotas y no ver ninguna hasta tocar un dia
        obligaria a adivinar que la rejilla es pulsable.
      */}
      {(selected ? selectedEntries : monthEntries).length > 0 ? (
        <View style={styles.list}>
          <AtlasText variant="caption" tone="tertiary">
            {selected
              ? `${parts(selected).day} DE ${monthName(cursor.month).toUpperCase()}`
              : `TODO ${monthName(cursor.month).toUpperCase()}`}
          </AtlasText>
          {(selected ? selectedEntries : monthEntries).map((entry) => (
            <CalendarRow
              key={`${entry.loanId}-${entry.installmentNumber}`}
              entry={entry}
              showDate={!selected}
              onPress={onOpenEntry ? () => onOpenEntry(entry) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Una cuota en la lista de debajo del mes. Se exporta porque la pantalla de pagos la reutiliza. */
export function CalendarRow({
  entry,
  showDate = true,
  onPress,
}: {
  entry: CalendarEntry;
  showDate?: boolean;
  onPress?: () => void;
}) {
  const look = STATE_LOOK[entry.state];
  const at = parts(entry.dueDate);

  return (
    <PressSurface
      style={styles.row}
      scaleTo={press.scaleSubtle}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Cuota ${entry.installmentNumber} de ${entry.merchant.displayName}, ${look.label.toLowerCase()}`}
    >
      <View style={[styles.rowIcon, { backgroundColor: look.tint + '22' }]}>
        <Icon name={look.icon} size={16} tint={look.tint} />
      </View>
      <View style={styles.rowText}>
        <AtlasText variant="bodyStrong" numberOfLines={1}>
          {entry.merchant.displayName}
        </AtlasText>
        <AtlasText variant="caption" tone="tertiary">
          Cuota {entry.installmentNumber}
          {showDate ? ` · ${at.day} de ${monthName(at.month)}` : ''}
          {entry.state === 'overdue' ? ` · ${entry.daysPastDue} ${entry.daysPastDue === 1 ? 'día' : 'días'} de atraso` : ''}
        </AtlasText>
      </View>
      <AtlasText variant="bodyStrong" style={{ color: entry.state === 'paid' ? color.text.tertiary : look.tint }}>
        {formatAmount(entry.state === 'paid' ? entry.totalAmount : entry.pendingAmount, entry.currencyCode)}
      </AtlasText>
      {onPress ? <Icon name="adelante" size={16} tint={color.text.tertiary} /> : null}
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.md },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  monthLabel: { flex: 1, alignItems: 'center', gap: 2 },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.sm },
  cellSelected: { backgroundColor: color.surface.raised },
  dayNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  today: { backgroundColor: color.action.primary },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotPlaceholder: { width: 6, height: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  rowIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
});
