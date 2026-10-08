/**
 * Las piezas de movimiento de un número que se gana: la cifra que CUENTA hacia arriba y la barra que SUBE con un punto
 * vivo en la punta. Las usan el desglose de la calificación y la carta de una insignia.
 *
 * Comparten un solo valor compartido 0→1 (`useAvance`): cifra y barra son lo mismo visto de dos maneras, y si cada una
 * llevara su reloj acabarían desfasadas. Con movimiento reducido todo nace en su valor final.
 */
import { useEffect, useRef, useState } from 'react';
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
 * El valor compartido 0→1 que mueven a la vez la barra y la cifra. Arranca CADA VEZ que `activa` pasa a verdadero:
 * volver a una página del desglose la vuelve a contar desde cero. Antes arrancaba una sola vez por componente, y como
 * las páginas quedan montadas al pasar de una a otra, la segunda visita no hacía nada (Pablo, 2026-10-08). Con
 * movimiento reducido vale 1 desde el principio. `retardo` escalona varias en una misma tarjeta (una escalera de
 * barras que se llenan una tras otra).
 */
export function useAvance(activa: boolean, retardo: number = motion.base): SharedValue<number> {
  const reducido = useReducedMotion();
  const avance = useSharedValue(reducido ? 1 : 0);
  const estabaActiva = useRef(false);
  // En un efecto y no en el render: escribir un valor compartido mientras se renderiza es lo que Reanimated 4 desaconseja.
  useEffect(() => {
    if (!activa) {
      estabaActiva.current = false;
      return;
    }
    if (estabaActiva.current) return;
    estabaActiva.current = true;
    if (reducido) {
      avance.value = 1;
      return;
    }
    avance.value = 0;
    avance.value = withDelay(retardo, withTiming(1, { duration: SUBIDA, easing: CURVA }));
    // `retardo` fuera a propósito: es el desfase de cada ARRANQUE, no un motivo para volver a arrancar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, avance, reducido]);
  return avance;
}

/** La cifra que sube de 0 a `hasta`. Sólo re-renderiza cuando el texto CAMBIA, no en cada fotograma. */
export function CuentaArriba({
  avance,
  hasta,
  formato,
  tamano = 'display',
  color: tinta,
  testID,
}: {
  avance: SharedValue<number>;
  hasta: number;
  formato: (n: number) => string;
  /** `amountHero` es la cifra protagonista de una tarjeta: una sola por tarjeta. */
  tamano?: 'display' | 'h1' | 'h2' | 'amount' | 'amountHero';
  color?: string;
  testID?: string;
}) {
  /*
    A JS sólo vuelve el NÚMERO. `formato` es una función normal de JS: llamarla desde la reacción (hilo de UI) funciona
    en el navegador, donde no hay dos hilos, y tumba la app en el teléfono. El texto se compone aquí, en el render.
  */
  const [valor, setValor] = useState(() => (avance.value >= 1 ? hasta : 0));
  useAnimatedReaction(
    () => Math.round(hasta * avance.value * 10) / 10,
    (actual, previo) => {
      if (actual !== previo) runOnJS(setValor)(actual);
    },
  );
  const texto = formato(valor);
  return (
    // En una línea y encogiendo si no cabe: una cifra larga (un tope de crédito) nunca se parte ni empuja a su vecina.
    <AtlasText
      variant={tamano}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      style={[styles.numero, tinta ? { color: tinta } : null]}
      accessibilityLabel={formato(hasta)}
      testID={testID}
    >
      {texto}
    </AtlasText>
  );
}

/**
 * La barra: un relleno de degradado que ENTRA desde la izquierda (transform, no ancho) y un punto vivo en la punta.
 * El punto es la lectura: dónde está la persona en esta parte. Lleva halo; el halo no se anima solo.
 */
export function Barra({
  valor,
  avance,
  etiqueta,
  grosor = 'md',
  tono = 'marca',
  punto: conPunto = true,
}: {
  valor: number;
  avance: SharedValue<number>;
  etiqueta: string;
  /** `lg` es la barra protagonista de una tarjeta: más alta y con un filo de luz, para que se lea como un material. */
  grosor?: 'md' | 'lg';
  /** `apagado` es un tramo que todavía no se alcanzó: sin degradado y sin punto vivo, que es la marca de «estás aquí». */
  tono?: 'marca' | 'apagado';
  /** El punto vivo de la punta. Fuera cuando varias barras comparten tarjeta y sólo una es «aquí estás». */
  punto?: boolean;
}) {
  const [pista, setPista] = useState(0);
  const fraccion = Math.max(0, Math.min(100, valor)) / 100;
  const grande = grosor === 'lg';
  const apagado = tono === 'apagado';
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
      <View style={[styles.pista, grande && styles.pistaGrande]}>
        <Animated.View style={[styles.relleno, relleno]}>
          {apagado ? (
            <View style={[StyleSheet.absoluteFill, styles.rellenoApagado]} />
          ) : (
            <LinearGradient colors={[palette.brand700, palette.brand500, palette.brand300]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          )}
          {/* El filo de luz: la mitad de arriba un punto más clara, como el canto de una pieza iluminada desde arriba. */}
          {grande && !apagado ? <View style={styles.filo} /> : null}
        </Animated.View>
      </View>
      {apagado || !conPunto ? null : (
        <Animated.View pointerEvents="none" style={[styles.punto, punto]}>
          <View style={styles.halo} />
          <View style={styles.nucleo} />
        </Animated.View>
      )}
    </View>
  );
}


/** La barra de siempre (`ProgressBar`) con el movimiento: sube al llegar y lleva el punto vivo. Mismo rol y etiqueta para los lectores de pantalla. */
export function BarraViva({
  value,
  label,
  grosor,
  tono,
  retardo,
  punto,
}: {
  value: number;
  label?: string;
  grosor?: 'md' | 'lg';
  tono?: 'marca' | 'apagado';
  retardo?: number;
  punto?: boolean;
}) {
  const avance = useAvance(true, retardo);
  const v = Math.max(0, Math.min(100, value));
  return <Barra valor={v} avance={avance} etiqueta={label ?? `Avance ${v}%`} grosor={grosor} tono={tono} punto={punto} />;
}

const styles = StyleSheet.create({
  numero: { color: color.text.primary, fontVariant: ['tabular-nums'] },

  // Sangrado de medio punto a cada lado: con el valor en 0 o en 100 el punto y su halo no se salen del margen de la tarjeta.
  barra: { height: PUNTO + 6, justifyContent: 'center', marginVertical: space.xs, marginHorizontal: PUNTO / 2 },

  pista: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },

  pistaGrande: { height: 10 },

  rellenoApagado: { backgroundColor: color.border.strong },

  filo: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: palette.white, opacity: 0.22 },

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
