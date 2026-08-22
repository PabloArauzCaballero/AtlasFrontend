/**
 * El puntaje ATLAS del cliente, con su porque.
 *
 * ## Por que se ensena como una progresion
 *
 * Porque un numero de riesgo suelto solo tiene dos lecturas: «me aprobaron» o «me rechazaron», y
 * las dos son un veredicto sobre la persona. Enseñado como un recorrido —donde estas, cuanto falta
 * para el siguiente tramo, que lo mueve— pasa a ser algo sobre lo que se actua. Es lo que se pidio:
 * transparencia, y que se sienta como un juego.
 *
 * ## Donde esta el limite de «gamificar»
 *
 * Esto es una deuda, no una partida. Asi que hay barra, tramos y siguiente meta, pero NO hay
 * premios por pedir credito, ni cuentas atras, ni nada que empuje a endeudarse para subir de nivel.
 * Lo unico que sube el puntaje aqui es pagar y completar el expediente — que es exactamente lo que
 * le conviene a quien lo mira.
 *
 * ## El «por que» no es opcional
 *
 * Los motivos que devuelve la politica se ensenan tal cual, incluidos los adversos. La normativa de
 * credito justo obliga a comunicarlos, y esconderlos convertiria la pantalla en un oraculo.
 */
import { StyleSheet, View } from 'react-native';
import type { CreditLine } from '../api/endpoints/credit-line';
import { formatAmount } from '../features/spending-copy';
import { color, radius, space } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AtlasText, Badge, Divider } from './primitives';

const TONE_COLOR: Record<string, string> = {
  success: color.feedback.success,
  info: color.action.primary,
  warning: color.feedback.warning,
  danger: color.feedback.danger,
};

const STEP_ICON: Record<string, IconName> = {
  extracto: 'documento',
  antiguedad: 'reloj',
  historial: 'tendencia',
};

/** De dónde salió cada dato, dicho sin jerga. */
const PROVENANCE_COPY: Record<string, { label: string; tone: string }> = {
  expediente: { label: 'Dato tuyo', tone: 'success' },
  derivado: { label: 'Calculado', tone: 'info' },
  ausente: { label: 'Nos falta', tone: 'warning' },
};

/** Las entradas que de verdad mueven el puntaje. El resto son controles y no se listan. */
const SHOWN_INPUTS: Array<{ key: string; label: string }> = [
  { key: 'disposable_income', label: 'Tu ingreso disponible' },
  { key: 'payment_history_score', label: 'Cómo pagas en Atlas' },
  { key: 'income_stability_score', label: 'Estabilidad de tu ingreso' },
  { key: 'bank_statement_nsf_count', label: 'Tu extracto bancario' },
  { key: 'bureau_score', label: 'Historial en el sistema financiero' },
  { key: 'delinquency_count_12m', label: 'Atrasos en los últimos 12 meses' },
];

export function ScoringPanel({ line }: { line: CreditLine }) {
  const scoring = line.scoring ?? 0;
  const scale = line.scoringScale;
  const tint = TONE_COLOR[line.scoringBand.tone] ?? color.action.primary;
  const progress = Math.max(0, Math.min(1, (scoring - scale.min) / Math.max(1, scale.max - scale.min)));

  /*
   * El siguiente tramo, y cuanto falta. Es la unica cifra de esta pantalla que la persona puede
   * mover, asi que es la que se dice en grande. Los tramos vienen del servidor: la app no decide
   * donde esta el corte entre «bueno» y «muy bueno».
   */
  const sorted = [...scale.bands].sort((left, right) => left.from - right.from);
  const next = sorted.find((band) => band.from > scoring);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.rowCenter}>
          <Icon name="estrella" size={20} tint={tint} />
          <AtlasText variant="h3">Tu puntaje Atlas</AtlasText>
        </View>
        <Badge label={line.scoringBand.label} tone={line.scoringBand.tone === 'info' ? 'info' : (line.scoringBand.tone as never)} />
      </View>

      <View style={styles.scoreRow}>
        <AtlasText variant="amount" style={{ color: tint }}>
          {scoring}
        </AtlasText>
        <AtlasText variant="caption" tone="tertiary">
          de {scale.max}
        </AtlasText>
      </View>

      {/* La barra con los cortes marcados: sin ellos, el progreso no dice hacia donde. */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
        {sorted
          .filter((band) => band.from > scale.min)
          .map((band) => (
            <View key={band.code} style={[styles.tick, { left: `${((band.from - scale.min) / (scale.max - scale.min)) * 100}%` }]} />
          ))}
      </View>

      {next ? (
        <AtlasText variant="caption" tone="secondary">
          Te faltan <AtlasText variant="bodyStrong">{next.from - scoring} puntos</AtlasText> para llegar a «{next.label}».
        </AtlasText>
      ) : (
        <AtlasText variant="caption" tone="secondary">
          Estás en el tramo más alto. Mantenerlo depende de seguir pagando a tiempo.
        </AtlasText>
      )}

      <Divider />

      {/* Que compone el puntaje, y de donde salio cada pieza. */}
      <AtlasText variant="caption" tone="tertiary">
        CON QUÉ SE CALCULÓ
      </AtlasText>
      {SHOWN_INPUTS.filter((input) => line.inputs[input.key]).map((input) => {
        const origin = PROVENANCE_COPY[line.inputs[input.key]!] ?? PROVENANCE_COPY.ausente!;
        return (
          <View key={input.key} style={styles.inputRow}>
            <AtlasText variant="body" tone="secondary" style={styles.flex}>
              {input.label}
            </AtlasText>
            <Badge label={origin.label} tone={origin.tone as never} />
          </View>
        );
      })}

      {line.reasons.length > 0 ? (
        <>
          <Divider />
          <AtlasText variant="caption" tone="tertiary">
            LO QUE DIJO LA POLÍTICA
          </AtlasText>
          {line.reasons.map((reason) => (
            <View key={reason.code} style={styles.rowCenter}>
              <Icon
                name={reason.adverseAction ? 'alerta' : 'check'}
                size={16}
                tint={reason.adverseAction ? color.feedback.warning : color.feedback.success}
              />
              <AtlasText variant="caption" tone="secondary" style={styles.flex}>
                {reason.message}
              </AtlasText>
            </View>
          ))}
        </>
      ) : null}

      {line.nextSteps.length > 0 ? (
        <>
          <Divider />
          <AtlasText variant="caption" tone="tertiary">
            CÓMO SUBIRLO
          </AtlasText>
          {line.nextSteps.map((step) => (
            <View key={step.code} style={styles.step}>
              <View style={[styles.stepIcon, { backgroundColor: color.action.primary + '22' }]}>
                <Icon name={STEP_ICON[step.code] ?? 'chispa'} size={18} tint={color.action.primary} />
              </View>
              <View style={styles.flex}>
                <AtlasText variant="bodyStrong">{step.label}</AtlasText>
                <AtlasText variant="caption" tone="tertiary">
                  {step.detail}
                </AtlasText>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Divider />
      {/*
        La traza al motor. No es adorno: es lo que permite que alguien pregunte «por que» y que
        alguien pueda contestarle mirando una ejecucion concreta.
      */}
      <AtlasText variant="caption" tone="tertiary">
        Calculado por el motor de decisión de Atlas · ejecución {line.decision.executionId ?? '—'}
        {line.decision.artifactVersionId ? ` · política v${line.decision.artifactVersionId}` : ''}
      </AtlasText>
    </View>
  );
}

/** El aviso de lo que cuesta la mora, con cifras suyas y no con una amenaza genérica. */
export function DelinquencyImpact({ line, overdueAmount, currency }: { line: CreditLine; overdueAmount: number; currency: string }) {
  if (overdueAmount <= 0) return null;

  return (
    <View style={[styles.impact, { borderColor: color.feedback.danger }]}>
      <View style={styles.rowCenter}>
        <Icon name="alerta" size={20} tint={color.feedback.danger} />
        <AtlasText variant="bodyStrong">La mora te está costando puntos</AtlasText>
      </View>
      <AtlasText variant="caption" tone="secondary">
        Tienes {formatAmount(overdueAmount, currency)} vencidos. Cada atraso entra en el cálculo de tu puntaje y baja la línea que
        la política te aprueba: hoy tu banda de riesgo es{' '}
        <AtlasText variant="bodyStrong">{line.riskBand ?? 'la más alta'}</AtlasText>.
      </AtlasText>
      <AtlasText variant="caption" tone="secondary">
        Ponerte al día lo revierte. No es un castigo permanente: el puntaje se recalcula con cada pago.
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  track: { height: 10, borderRadius: 5, backgroundColor: color.surface.sunken, overflow: 'hidden', justifyContent: 'center' },
  fill: { height: 10, borderRadius: 5 },
  tick: { position: 'absolute', width: 1, height: 10, backgroundColor: color.surface.primary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 2 },
  step: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingVertical: space.xxs },
  stepIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  impact: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, backgroundColor: color.surface.raised },
});
