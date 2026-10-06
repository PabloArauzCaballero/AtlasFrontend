/**
 * La tarjeta del nivel Atlas: el escalón en el que está la persona y su barra de experiencia.
 *
 * Es la versión compacta, para Perfil e Inicio; toca para abrir «Tu nivel Atlas». Se parece a la barra de
 * experiencia de un juego a propósito: un número suelto («38») no dice nada, pero «Nivel 2 de 5 · te faltan 12
 * puntos para Establecido» dice qué hacer y cuánto falta.
 *
 * No habla de dinero ni de deuda: el nivel se gana con conducta (pagar a tiempo, verificarse, antigüedad), y
 * esta tarjeta nunca invita a pedir más crédito.
 */
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { calificacionDe } from '../features/calificacion';
import { fraseDeLoQueFalta, ICONO_DE_NIVEL, porcentajeDeBarra } from '../features/nivel';
import { color, radius, space, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface, Vivo } from './motion';
import { AtlasText, ProgressBar } from './primitives';

export function NivelCard({ progress, onPress }: { progress: Progress; onPress?: () => void }) {
  const { tier, nextTier, score } = progress;
  const cuerpo = (
    <>
      <View style={styles.cabecera}>
        {/* La insignia del nivel respira: es lo que se ha ganado y lo primero que se mira. */}
        <Vivo tipo="flota" periodo={3200}>
          <View style={styles.insignia}>
            <Icon name={ICONO_DE_NIVEL[tier.code]} size={26} tint={color.action.primary} />
          </View>
        </Vivo>
        <View style={styles.titulos}>
          <AtlasText variant="overline" tone="secondary">
            {`NIVEL ${tier.index} DE ${tier.of}`}
          </AtlasText>
          <AtlasText variant="h2">{tier.label}</AtlasText>
        </View>
        <View style={styles.puntos}>
          <AtlasText variant="amount">{String(calificacionDe(progress))}</AtlasText>
          <AtlasText variant="caption" tone="secondary">
            de 100
          </AtlasText>
        </View>
      </View>
      <ProgressBar value={porcentajeDeBarra(progress)} label={nextTier ? `Calificación ${score}; el siguiente nivel empieza en ${nextTier.from}` : 'Nivel máximo'} />
      <AtlasText variant="caption" tone="secondary">
        {fraseDeLoQueFalta(progress)}
      </AtlasText>
    </>
  );

  if (!onPress) return <View style={styles.tarjeta}>{cuerpo}</View>;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tu nivel Atlas: ${tier.label}, nivel ${tier.index} de ${tier.of}, calificación ${calificacionDe(progress)} de 100. ${fraseDeLoQueFalta(progress)} Toca para ver cómo subir.`}
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
