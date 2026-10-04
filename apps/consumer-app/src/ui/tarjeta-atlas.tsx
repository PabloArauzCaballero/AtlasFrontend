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
        {/* Luz de superficie: un velo claro arriba a la izquierda que se desvanece. Da volumen sin tapar el texto. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
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

  // La sombra necesita un padre SIN `overflow: hidden`: la tarjeta recorta su contenido y recortaría también su sombra.
  // Y `aire` le deja sitio: la tarjeta flota unos píxeles y su sombra se extiende 16 más; sin ese margen la animación
  // chocaba con lo de arriba, lo de abajo y los bordes de la pantalla y se sentía apretada.
  const conSombra = grande ? (
    <View style={styles.aire}>
      <View style={[styles.sombra, { backgroundColor: colores[0] }]}>{cuerpo}</View>
    </View>
  ) : (
    cuerpo
  );
  const flotante =
    grande && !bloqueada ? (
      <Vivo tipo="flota" periodo={5200}>
        {conSombra}
      </Vivo>
    ) : (
      conSombra
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

/**
 * Un destello suave que cruza la tarjeta y espera antes de repetir.
 *
 * Antes era una banda de 46 px con bordes duros que cruzaba en 1,3 s: se leía como una raya que pasa, no como luz sobre
 * metal. Ahora la banda es un degradado (transparente → luz → transparente), ancha, y cruza en 2 s con curva cúbica de
 * entrada y salida: acelera con suavidad, llega y se apaga, sin un solo borde que se vea pasar.
 */
function Destello() {
  const reducido = useReducedMotion();
  const [ancho, setAncho] = useState(0);
  const avance = useSharedValue(0);
  const banda = ancho * 0.7;

  useEffect(() => {
    if (reducido || ancho === 0) return;
    avance.value = 0;
    avance.value = withRepeat(
      // La espera va ANTES del recorrido y el regreso a 0 ocurre con la banda fuera de la tarjeta, así que no se ve.
      withSequence(withDelay(3200, withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.cubic) })), withTiming(0, { duration: 0 })),
      -1,
    );
    return () => cancelAnimation(avance);
  }, [ancho, avance, reducido]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: -banda * 1.2 + avance.value * (ancho + banda * 2.4) }, { rotate: '18deg' }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setAncho(e.nativeEvent.layout.width)} testID="tarjeta-destello">
      {reducido || ancho === 0 ? null : (
        <Animated.View style={[styles.banda, { width: banda }, estilo]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aire: { paddingVertical: space.lg, paddingHorizontal: space.sm },
  sombra: { borderRadius: radius.xxl, shadowColor: '#000000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
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
