/**
 * La tarjeta Atlas: un objeto que se parece a una tarjeta de banco, con el acabado de su categoría.
 *
 * Los colores NO están escritos aquí: vienen del catálogo (`theme`), así que Atlas puede cambiar el aspecto de «Gold»
 * sin publicar la app. Lo que sí es de la app es el comportamiento:
 *  - un destello diagonal cruza la tarjeta cada pocos segundos (se ve «metálica», se mueve sola a propósito: es la
 *    señal de que esta tarjeta se ha ganado),
 *  - la tarjeta flota apenas, como si estuviera en la mano.
 * Con «reducir movimiento» las dos cosas se apagan y la tarjeta queda quieta y completa.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { CardTier } from '../api/endpoints/credit-line';
import { etiquetaAccesible } from '../features/tarjeta';
import { radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface, Vivo } from './motion';
import { AtlasText } from './primitives';

/** Proporción de una tarjeta de crédito (ISO/IEC 7810 ID-1: 85,60 × 53,98 mm). */
const PROPORCION = 1.586;

type Props = {
  tier: Pick<CardTier, 'label' | 'theme'>;
  /** `mini` es la miniatura de la escalera: sin destello ni flotación, sólo el color y el nombre. */
  tamano?: 'grande' | 'mini';
  /** Desbloqueada = a color; si no, apagada con un candado. */
  bloqueada?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function TarjetaAtlas({ tier, tamano = 'grande', bloqueada = false, onPress, testID }: Props) {
  const grande = tamano === 'grande';
  const { gradient, ink, accent } = tier.theme;
  const colores = (gradient.length >= 2 ? gradient : [gradient[0] ?? accent, gradient[0] ?? accent]) as [string, string, ...string[]];

  const cuerpo = (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${etiquetaAccesible(tier)}${bloqueada ? ', todavía bloqueada' : ''}`}
      testID={testID}
      style={[grande ? styles.grande : styles.mini, bloqueada && styles.bloqueada]}
    >
      <LinearGradient
        colors={colores}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.cara, { borderColor: accent }]}
      >
        <View style={grande ? styles.contenido : styles.contenidoMini}>
          <View style={styles.fila}>
            <AtlasText variant={grande ? 'overline' : 'micro'} style={{ color: ink, letterSpacing: grande ? 3 : 1.5 }}>
              ATLAS
            </AtlasText>
            {grande ? <Chip accent={accent} ink={ink} /> : null}
            {bloqueada ? <Icon name="candado" size={grande ? 20 : 14} tint={ink} /> : null}
          </View>
          <AtlasText variant={grande ? 'h1' : 'caption'} style={{ color: ink }}>
            {tier.label}
          </AtlasText>
        </View>
        {grande && !bloqueada ? <Destello /> : null}
      </LinearGradient>
    </View>
  );

  const flotante =
    grande && !bloqueada ? (
      <Vivo tipo="flota" periodo={4200}>
        {cuerpo}
      </Vivo>
    ) : (
      cuerpo
    );

  if (!onPress) return flotante;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiquetaAccesible(tier)}. Toca para ver tus tarjetas.`}
      testID={testID ? `${testID}-boton` : undefined}
    >
      {flotante}
    </PressSurface>
  );
}

/** El chip de la tarjeta, dibujado con vistas: un rectángulo con las líneas de contactos. */
function Chip({ accent, ink }: { accent: string; ink: string }) {
  return (
    <View style={[styles.chip, { borderColor: ink, backgroundColor: accent }]}>
      <View style={[styles.chipLinea, { backgroundColor: ink }]} />
      <View style={[styles.chipLinea, { backgroundColor: ink }]} />
    </View>
  );
}

/** Una banda clara e inclinada que cruza la tarjeta de lado a lado y espera antes de repetir. */
function Destello() {
  const reducido = useReducedMotion();
  const [ancho, setAncho] = useState(0);
  const avance = useSharedValue(0);

  useEffect(() => {
    if (reducido || ancho === 0) return;
    avance.value = withRepeat(
      withSequence(withDelay(2400, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })),
      -1,
    );
    return () => cancelAnimation(avance);
  }, [ancho, avance, reducido]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: -ancho * 0.5 + avance.value * ancho * 1.6 }, { rotate: '18deg' }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} testID="tarjeta-destello">
      {reducido ? null : <Animated.View style={[styles.banda, estilo]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grande: {
    width: '100%',
    aspectRatio: PROPORCION,
    borderRadius: radius.xxl,
    overflow: 'hidden',
  },
  mini: {
    width: 86,
    aspectRatio: PROPORCION,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bloqueada: { opacity: 0.45 },
  cara: { borderRadius: radius.xxl, borderWidth: 1, overflow: 'hidden' },
  contenido: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  contenidoMini: {
    flex: 1,
    padding: space.sm,
    justifyContent: 'space-between',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    width: 44,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    opacity: 0.85,
  },
  chipLinea: { height: 1, opacity: 0.5 },
  banda: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 46,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
