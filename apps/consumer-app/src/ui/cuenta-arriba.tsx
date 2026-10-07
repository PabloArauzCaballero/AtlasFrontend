/**
 * Las piezas de movimiento de un número que se gana: la cifra que CUENTA hacia arriba y la barra que SUBE con un punto
 * vivo en la punta. Las usan el desglose de la calificación y la carta de una insignia.
 *
 * Comparten un solo valor compartido 0→1 (`useAvance`): cifra y barra son lo mismo visto de dos maneras, y si cada una
 * llevara su reloj acabarían desfasadas. Con movimiento reducido todo nace en su valor final.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, easing, motion, palette, radius, space } from '../theme/tokens';
import { AtlasText } from './primitives';

/** Cuánto tarda la barra en subir y la cifra en contar: más que `slow`, porque es un recorrido que se quiere SEGUIR. */
const SUBIDA = 1100;
const CURVA = Easing.bezier(easing.emphasized[0], easing.emphasized[1], easing.emphasized[2], easing.emphasized[3]);
const PUNTO = 14;

/**
 * El valor compartido 0→1 que mueven a la vez la barra y la cifra. Arranca la primera vez que `activa` es verdadero;
 * con movimiento reducido vale 1 desde el principio.
 */
export function useAvance(activa: boolean): SharedValue<number> {
  const reducido = useReducedMotion();
  const avance = useSharedValue(reducido ? 1 : 0);
  const arrancado = useRef(false);
  if (activa && !arrancado.current) {
    arrancado.current = true;
    avance.value = reducido ? 1 : withDelay(motion.base, withTiming(1, { duration: SUBIDA, easing: CURVA }));
  }
  return avance;
}

/** La cifra que sube de 0 a `hasta`. Sólo re-renderiza cuando el texto CAMBIA, no en cada fotograma. */
export function CuentaArriba({
  avance,
  hasta,
  formato,
  tamano = 'display',
  color: tinta,
}: {
  avance: SharedValue<number>;
  hasta: number;
  formato: (n: number) => string;
  tamano?: 'display' | 'h2';
  color?: string;
}) {
  const [texto, setTexto] = useState(() => formato(avance.value >= 1 ? hasta : 0));
  useAnimatedReaction(
    () => Math.round(hasta * avance.value * 10) / 10,
    (actual, previo) => {
      if (actual !== previo) runOnJS(setTexto)(formato(actual));
    },
  );
  return (
    <AtlasText variant={tamano} style={[styles.numero, tinta ? { color: tinta } : null]} accessibilityLabel={formato(hasta)}>
      {texto}
    </AtlasText>
  );
}

/**
 * La barra: un relleno de degradado que ENTRA desde la izquierda (transform, no ancho) y un punto vivo en la punta.
 * El punto es la lectura: dónde está la persona en esta parte. Lleva halo; el halo no se anima solo.
 */
export function Barra({ valor, avance, etiqueta }: { valor: number; avance: SharedValue<number>; etiqueta: string }) {
  const [pista, setPista] = useState(0);
  const fraccion = Math.max(0, Math.min(100, valor)) / 100;
  const relleno = useAnimatedStyle(() => ({ transform: [{ translateX: (avance.value * fraccion - 1) * pista }] }));
  const punto = useAnimatedStyle(() => ({
    opacity: interpolate(avance.value, [0, 0.08], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: avance.value * fraccion * pista - PUNTO / 2 }],
  }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraccion * 100) }}
      accessibilityLabel={etiqueta}
      style={styles.barra}
      onLayout={(e) => setPista(e.nativeEvent.layout.width)}
    >
      <View style={styles.pista}>
        <Animated.View style={[styles.relleno, relleno]}>
          <LinearGradient colors={[palette.brand700, palette.brand500, palette.brand300]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.punto, punto]}>
        <View style={styles.halo} />
        <View style={styles.nucleo} />
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  numero: { color: color.text.primary, fontVariant: ['tabular-nums'] },

  barra: { height: PUNTO + 6, justifyContent: 'center', marginVertical: space.xs },

  pista: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },

  relleno: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.pill, overflow: 'hidden' },

  punto: { position: 'absolute', left: 0, width: PUNTO, height: PUNTO, alignItems: 'center', justifyContent: 'center' },

  nucleo: { width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: palette.brand300, borderWidth: 2, borderColor: palette.white },

  halo: {
    position: 'absolute',
    width: PUNTO * 2.6,
    height: PUNTO * 2.6,
    borderRadius: PUNTO * 1.3,
    backgroundColor: 'rgba(43,224,168,0.28)',
    shadowColor: palette.brand400,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
