/**
 * Marca ATLAS en movil.
 *
 * El logotipo se dibuja con SVG y el degradado de marca en vez de incrustar un PNG: escala sin
 * perder nitidez en cualquier densidad y no obliga a mantener seis tamanos del mismo archivo.
 * El degradado teal -> menta es el mismo de `AtlasLandingPage`.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color, palette, radius, space } from '../theme/tokens';
import { AtlasText } from './primitives';

export function AtlasMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Logotipo de Atlas">
      <Defs>
        <LinearGradient id="atlas-brand" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.brand500} />
          <Stop offset="0.55" stopColor={palette.brand400} />
          <Stop offset="1" stopColor={palette.brand300} />
        </LinearGradient>
      </Defs>
      {/* La "A" de Atlas: dos trazos ascendentes y el travesano. */}
      <Path d="M24 5 L43 43 H34 L24 21 L14 43 H5 Z" fill="url(#atlas-brand)" />
      <Path d="M17.5 31 H30.5 L34 38 H14 Z" fill={palette.brand900} opacity={0.55} />
    </Svg>
  );
}

export function AtlasLogo({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.logo, style]}>
      <AtlasMark size={44} />
      <View>
        <AtlasText variant="h2">ATLAS</AtlasText>
        <AtlasText variant="micro" tone="brand">
          COMPRA HOY, PAGA DESPUÉS
        </AtlasText>
      </View>
    </View>
  );
}

/**
 * Distintivo del origen de datos de compra.
 *
 * Se muestra siempre que la pantalla no este hablando con el backend real. Es una exigencia del
 * propio metodo de trabajo: nunca presentar datos simulados como si fueran de produccion.
 */
export function DataSourceBadge({ label = 'Entorno sandbox' }: { label?: string }) {
  return (
    <View style={styles.sandbox}>
      <View style={styles.sandboxDot} />
      <AtlasText variant="micro" tone="warning">
        {label}
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sandbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.feedbackBorder.warning,
    backgroundColor: color.feedbackSoft.warning,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  sandboxDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.feedback.warning },
});
