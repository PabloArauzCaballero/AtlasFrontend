/**
 * La tarjeta del nivel Atlas: el escalón, los puntos de experiencia que lo dan y la racha, en UNA pieza.
 *
 * Pablo (2026-10-06): la portada repetía lo mismo en tres tarjetas —«Tu puntaje 0 puntos», «Nivel 1 de 5 · 0 puntos»
 * y la cuenta— con un párrafo de explicación en cada una. Los puntos de experiencia SON lo que da el nivel, así que
 * van juntos; la explicación de cómo se calcula vive en «Más info», una hoja que se abre cuando alguien la pide.
 *
 * Los puntos de experiencia salen de lo COMPRADO: 1 por cada boliviano. Qué tan buen pagador es la persona es otra
 * cosa —la Calificación de 1 a 100— y tiene su propia tarjeta.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { formatoPuntos, fraseDeLoQueFalta, iconoDeEscalon, idDeEscalon, nivelPorPuntos, porcentajeDeBarra } from '../features/nivel';
import { color, radius, space, stroke } from '../theme/tokens';
import { BotonInfo, InfoSheet } from './help-sheet';
import { Icon } from './icons';
import { Vivo } from './motion';
import { AtlasText, Button, Divider, ProgressBar } from './primitives';

export function NivelCard({ progress, onVerLogros }: { progress: Progress; onVerLogros?: () => void }) {
  const [info, setInfo] = useState(false);
  const nivel = nivelPorPuntos(progress);
  const { level, nextLevel } = nivel;
  // Tolerante a un backend que aún no publica la experiencia: sin ella no hay racha, pero el nivel se pinta igual.
  const currentStreak = progress.experience?.currentStreak ?? 0;
  const bestStreak = progress.experience?.bestStreak ?? 0;
  const puntos = level.points === 1 ? 'punto' : 'puntos';

  return (
    <View
      style={styles.tarjeta}
      accessibilityLabel={`Tu nivel Atlas: ${level.label}, nivel ${level.index} de ${level.of}, ${formatoPuntos(level.points)} ${puntos} de experiencia. ${fraseDeLoQueFalta(nivel)}`}
      testID="nivel-card"
    >
      <View style={styles.cabecera}>
        {/* La insignia del nivel respira: es lo que se ha ganado y lo primero que se mira. */}
        <Vivo tipo="flota" periodo={3200}>
          <View style={styles.insignia}>
            <Icon name={iconoDeEscalon(level)} size={26} tint={color.action.primary} />
          </View>
        </Vivo>
        <View style={styles.titulos}>
          <View style={styles.sobretitulo}>
            <AtlasText variant="overline" tone="secondary">
              {`NIVEL ${level.index} DE ${level.of}`}
            </AtlasText>
            <BotonInfo etiqueta="tus puntos y tu nivel" onPress={() => setInfo(true)} testID="nivel-mas-info" />
          </View>
          <AtlasText variant="h2" numberOfLines={1}>
            {level.label}
          </AtlasText>
        </View>
        <View style={styles.puntos}>
          <AtlasText variant="amount" numberOfLines={1}>
            {formatoPuntos(level.points)}
          </AtlasText>
          <AtlasText variant="caption" tone="secondary">
            {puntos}
          </AtlasText>
        </View>
      </View>
      <ProgressBar
        value={porcentajeDeBarra(nivel)}
        label={nextLevel ? `${formatoPuntos(level.points)} puntos; ${nextLevel.label} empieza en ${formatoPuntos(nextLevel.from)}` : 'Nivel máximo'}
      />
      <View style={styles.pie}>
        <AtlasText variant="caption" tone="secondary" style={styles.falta}>
          {nextLevel ? `Faltan ${formatoPuntos(nextLevel.pointsMissing)} para «${nextLevel.label}»` : 'Nivel máximo'}
        </AtlasText>
        {currentStreak > 0 ? (
          <AtlasText variant="captionStrong" tone="brand">
            {`Racha ${currentStreak}`}
          </AtlasText>
        ) : null}
      </View>
      <View style={styles.acciones}>
        {onVerLogros ? <Button label="Mis logros" icon="estrella" variant="secondary" onPress={onVerLogros} style={styles.accion} testID="nivel-logros" /> : null}
      </View>

      <InfoSheet visible={info} titulo="Tus puntos y tu nivel" onClose={() => setInfo(false)} testID="nivel-info">
          <AtlasText variant="bodyStrong">Cómo se ganan</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Cada boliviano que compras con Atlas te da 1 punto de experiencia. Tus puntos nunca bajan, y con ellos subes de
            nivel y de tarjeta.
          </AtlasText>
          <Divider />
          <AtlasText variant="bodyStrong">Los niveles</AtlasText>
          {nivel.levelLadder.map((escalon) => (
            <View key={idDeEscalon(escalon)} style={styles.escalon}>
              <Icon name={escalon.reached ? 'check' : iconoDeEscalon(escalon)} size={18} tint={escalon.reached ? color.action.primary : color.text.tertiary} />
              <AtlasText variant="body" tone={idDeEscalon(escalon) === idDeEscalon(level) ? 'brand' : escalon.reached ? 'primary' : 'secondary'} style={styles.falta}>
                {escalon.label}
              </AtlasText>
              <AtlasText variant="caption" tone="secondary">
                {`desde ${formatoPuntos(escalon.from)}`}
              </AtlasText>
            </View>
          ))}
          <Divider />
          <AtlasText variant="bodyStrong">La racha</AtlasText>
          <AtlasText variant="body" tone="secondary">
            {`Cuotas seguidas pagadas a tiempo. Ahora llevas ${currentStreak}; tu mejor racha es ${bestStreak}.`}
          </AtlasText>
          <Divider />
          <AtlasText variant="bodyStrong">Puntos no es lo mismo que calificación</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Los puntos miden cuánto usas Atlas. Qué tan buen pagador eres lo dice tu calificación de 1 a 100, que sube pagando a
            tiempo y es la que cuenta para tu crédito.
          </AtlasText>
      </InfoSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.xxl,
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
    backgroundColor: color.surface.raised,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  insignia: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.feedbackSoft.success,
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
  },
  titulos: { flex: 1 },
  sobretitulo: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  puntos: { alignItems: 'flex-end' },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  falta: { flex: 1 },
  acciones: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  accion: { flex: 1 },
  escalon: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
