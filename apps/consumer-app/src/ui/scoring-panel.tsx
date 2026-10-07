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
import { StyleSheet, View } from "react-native";
import type { CreditLine } from "../api/endpoints/credit-line";
import { formatAmount } from "../features/spending-copy";
import { useCopy } from "../features/use-contenido-remoto";
import { color, radius, space } from "../theme/tokens";
import { Icon, type IconName } from "./icons";
import { AtlasText, Badge, Divider, IconChip, Overline } from "./primitives";

const TONE_COLOR: Record<string, string> = {
  success: color.feedback.success,
  info: color.action.primary,
  warning: color.feedback.warning,
  danger: color.feedback.danger,
};

const STEP_ICON: Record<string, IconName> = {
  extracto: "documento",
  antiguedad: "reloj",
  historial: "tendencia",
};

/** De dónde salió cada dato, dicho sin jerga. */
const PROVENANCE_COPY: Record<string, { label: string; tone: string }> = {
  expediente: { label: "Dato tuyo", tone: "success" },
  derivado: { label: "Calculado", tone: "info" },
  ausente: { label: "Nos falta", tone: "warning" },
};

/** Las entradas que de verdad mueven el puntaje. El resto son controles y no se listan. */
const SHOWN_INPUTS: { key: string; label: string }[] = [
  { key: "disposable_income", label: "Tu ingreso disponible" },
  { key: "payment_history_score", label: "Cómo pagas en Atlas" },
  { key: "income_stability_score", label: "Estabilidad de tu ingreso" },
  { key: "bank_statement_nsf_count", label: "Tu extracto bancario" },
  { key: "bureau_score", label: "Historial en el sistema financiero" },
  { key: "delinquency_count_12m", label: "Atrasos en los últimos 12 meses" },
];

export function ScoringPanel({ line }: { line: CreditLine }) {
  const t = useCopy();
  const scoring = line.scoring ?? 0;
  const scale = line.scoringScale;
  const tint = TONE_COLOR[line.scoringBand.tone] ?? color.action.primary;
  const progress = Math.max(
    0,
    Math.min(1, (scoring - scale.min) / Math.max(1, scale.max - scale.min)),
  );

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
          <AtlasText variant="h3">Tu índice de crédito</AtlasText>
        </View>
        <Badge
          dot
          label={line.scoringBand.label}
          tone={
            line.scoringBand.tone === "info"
              ? "info"
              : (line.scoringBand.tone as never)
          }
        />
      </View>

      {/*
        El puntaje es la cifra mas grande del perfil, y por eso va en `amountHero`: es lo que la
        persona viene a mirar y lo unico de esta tarjeta que puede mover pagando.
      */}
      <View style={styles.scoreRow}>
        <AtlasText variant="amountHero" style={{ color: tint }}>
          {scoring}
        </AtlasText>
        <AtlasText variant="amountSmall" tone="tertiary">
          / {scale.max}
        </AtlasText>
      </View>

      {/* La barra con los cortes marcados: sin ellos, el progreso no dice hacia donde. */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: tint },
          ]}
        />
        {sorted
          .filter((band) => band.from > scale.min)
          .map((band) => (
            <View
              key={band.code}
              style={[
                styles.tick,
                {
                  left: `${((band.from - scale.min) / (scale.max - scale.min)) * 100}%`,
                },
              ]}
            />
          ))}
      </View>

      {next ? (
        <AtlasText variant="caption" tone="secondary">
          Te faltan{" "}
          <AtlasText variant="captionStrong">
            {next.from - scoring}
          </AtlasText>{" "}
          para llegar a «{next.label}».
        </AtlasText>
      ) : (
        <AtlasText variant="caption" tone="secondary">
          {t.texto("puntaje.tramo_alto")}
        </AtlasText>
      )}

      <Divider />

      {/* Que compone el puntaje, y de donde salio cada pieza. */}
      <Overline>Con qué se calculó</Overline>
      {SHOWN_INPUTS.filter((input) => line.inputs[input.key]).map((input) => {
        const origin =
          PROVENANCE_COPY[line.inputs[input.key]!] ?? PROVENANCE_COPY.ausente!;
        return (
          <View key={input.key} style={styles.inputRow}>
            <AtlasText variant="body" tone="secondary" style={styles.flex}>
              {input.label}
            </AtlasText>
            <Badge label={origin.label} tone={origin.tone as never} />
          </View>
        );
      })}

      {/*
        Por que tu limite es ESE.
        
        Es la pregunta que sigue siempre a una cifra de credito, y hasta ahora no tenia respuesta en
        ninguna pantalla: la persona veia un numero y un puntaje sin relacion visible entre ellos.
        Cuando el limite aprobado es MENOR que la capacidad medida —lo normal en alguien nuevo— lo
        que falta no es dinero sino relacion, y eso si se puede accionar.
      */}
      {line.capacity.explanation ? (
        <>
          <Divider />
          <Overline>Por qué tu límite es ese</Overline>
          <AtlasText variant="body" tone="secondary">
            {line.capacity.explanation}
          </AtlasText>
          {line.capacity.recommendedLimit !== null &&
          line.capacity.recommendedLimit > line.approvedLimit ? (
            <AtlasText variant="caption" tone="tertiary">
              Tus movimientos sostienen hasta Bs{" "}
              {line.capacity.recommendedLimit.toLocaleString("es-BO", {
                maximumFractionDigits: 0,
              })}
              .
            </AtlasText>
          ) : null}
        </>
      ) : null}

      {line.reasons.length > 0 ? (
        <>
          <Divider />
          <Overline>Lo que dijo la política</Overline>
          {line.reasons.map((reason) => (
            <View key={reason.code} style={styles.rowCenter}>
              <Icon
                name={reason.adverseAction ? "alerta" : "check"}
                size={16}
                tint={
                  reason.adverseAction
                    ? color.feedback.warning
                    : color.feedback.success
                }
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
          <Overline>Cómo subirlo</Overline>
          {line.nextSteps.map((step) => (
            <View key={step.code} style={styles.step}>
              {/*
                El chip comun, no un fondo fabricado concatenando la alfa al hexadecimal del color de
                marca —que ademas es un color literal escrito fuera de los tokens—.
              */}
              <IconChip name={STEP_ICON[step.code] ?? "chispa"} size="sm" />
              <View style={styles.flex}>
                <AtlasText variant="title">{step.label}</AtlasText>
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
        Calculado por el motor de decisión de Atlas · ejecución{" "}
        {line.decision.executionId ?? "—"}
        {line.decision.artifactVersionId
          ? ` · política v${line.decision.artifactVersionId}`
          : ""}
      </AtlasText>
    </View>
  );
}

/** El aviso de lo que cuesta la mora, con cifras suyas y no con una amenaza genérica. */
export function DelinquencyImpact({
  line,
  overdueAmount,
  currency,
}: {
  line: CreditLine;
  overdueAmount: number;
  currency: string;
}) {
  const t = useCopy();
  if (overdueAmount <= 0) return null;

  return (
    <View style={[styles.impact, { borderColor: color.feedbackBorder.danger }]}>
      <View style={styles.rowCenter}>
        <IconChip name="alerta" tone="danger" size="sm" />
        <AtlasText variant="h3">{t.texto("puntaje.mora")}</AtlasText>
      </View>
      <AtlasText variant="caption" tone="secondary">
        Tienes {formatAmount(overdueAmount, currency)} vencidos. Cada atraso
        entra en el cálculo de tu puntaje y baja la línea que la política te
        aprueba: hoy tu banda de riesgo es{" "}
        <AtlasText variant="captionStrong">
          {line.riskBand ?? "la más alta"}
        </AtlasText>
        .
      </AtlasText>
      <AtlasText variant="caption" tone="secondary">
        Ponerte al día lo revierte. No es un castigo permanente: el puntaje se
        recalcula con cada pago.
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  flex: { flex: 1 },
  // `flexWrap`: con «EN CONSTRUCCIÓN» el título y la etiqueta no caben en un teléfono y la etiqueta se
  // salía por el borde de la tarjeta. Ahora baja a su propia línea.
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.sm,
    rowGap: space.xs,
  },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: color.surface.sunken,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: { height: 10, borderRadius: 5 },
  tick: {
    position: "absolute",
    width: 1,
    height: 10,
    backgroundColor: color.surface.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 2,
  },
  step: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    paddingVertical: space.xxs,
  },
  impact: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: color.surface.raised,
  },
});
