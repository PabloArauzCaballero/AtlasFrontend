/**
 * La tarjeta del nivel Atlas: el escalón en el que está la persona y su barra de experiencia.
 *
 * Es la versión compacta, para Perfil e Inicio; toca para abrir «Tu nivel Atlas». Se mide en PUNTOS (los que se
 * ganan pagando a tiempo), no en la calificación 1-100: «Nivel 2 de 5 · 1.200 puntos · te faltan 800 para
 * Establecido» dice qué hacer y cuánto falta.
 *
 * No habla de dinero ni de deuda: el nivel se gana con conducta (pagar a tiempo, verificarse, antigüedad), y
 * esta tarjeta nunca invita a pedir más crédito.
 */
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { formatoPuntos, fraseDeLoQueFalta, ICONO_DE_NIVEL, nivelPorPuntos, porcentajeDeBarra } from '../features/nivel';
import { color, radius, space, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface, Vivo } from './motion';
import { AtlasText, ProgressBar } from './primitives';

export function NivelCard({ progress, onPress }: { progress: Progress; onPress?: () => void }) {
  const nivel = nivelPorPuntos(progress);
  const { level, nextLevel } = nivel;
  const cuerpo = (
    <>
      <View style={styles.cabecera}>
        {/* La insignia del nivel respira: es lo que se ha ganado y lo primero que se mira. */}
        <Vivo tipo="flota" periodo={3200}>
          <View style={styles.insignia}>
            <Icon name={ICONO_DE_NIVEL[level.code]} size={26} tint={color.action.primary} />
          </View>
        </Vivo>
        <View style={styles.titulos}>
          <AtlasText variant="overline" tone="secondary">
            {`NIVEL ${level.index} DE ${level.of}`}
          </AtlasText>
          <AtlasText variant="h2">{level.label}</AtlasText>
        </View>
        <View style={styles.puntos}>
          <AtlasText variant="amount">{formatoPuntos(level.points)}</AtlasText>
          <AtlasText variant="caption" tone="secondary">
            {level.points === 1 ? 'punto' : 'puntos'}
          </AtlasText>
        </View>
      </View>
      <ProgressBar
        value={porcentajeDeBarra(nivel)}
        label={nextLevel ? `${formatoPuntos(level.points)} puntos; ${nextLevel.label} empieza en ${formatoPuntos(nextLevel.from)}` : 'Nivel máximo'}
      />
      <AtlasText variant="caption" tone="secondary">
        {fraseDeLoQueFalta(nivel)}
      </AtlasText>
    </>
  );

  if (!onPress) return <View style={styles.tarjeta}>{cuerpo}</View>;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tu nivel Atlas: ${level.label}, nivel ${level.index} de ${level.of}, ${formatoPuntos(level.points)} puntos. ${fraseDeLoQueFalta(nivel)} Toca para ver cómo subir.`}
      style={styles.tarjeta}
      testID="nivel-card"
    >
      {cuerpo}
    </PressSurface>
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
  puntos: { alignItems: 'flex-end' },
});
