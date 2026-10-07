/**
 * La espera de Atlas: la «A» de la marca con un anillo de luz que gira y una barra de carga.
 *
 * Pablo (2026-10-06): «que se pueda ver el cargando como una barra de carga o que mientras algo carga
 * hagamos una animación asombrosa y bonita renderizada en ultra HD». Antes la espera era el círculo
 * gris del sistema, igual en cualquier app: no decía que era Atlas quien estaba trabajando.
 *
 * ## Por qué es todo vectorial
 *
 * La letra, los anillos y el punto son SVG (`react-native-svg`) y la barra es un degradado nativo: se
 * dibujan a la densidad de la pantalla que los muestre —3x en un teléfono actual— sin pixelarse y sin
 * pesar nada. Un GIF o un vídeo se verían borrosos justo en las pantallas buenas.
 *
 * ## Por qué la barra no dice un porcentaje
 *
 * Casi ninguna espera de la app sabe cuánto le falta (una respuesta del servidor llega o no llega).
 * Una barra que se llena al 80 % y se queda ahí miente sobre el avance; ésta es INDETERMINADA: un tramo
 * de luz que la recorre, que es la forma honesta de decir «estoy trabajando».
 *
 * ## Movimiento
 *
 * Sólo se animan `transform` y `opacity`, en el hilo de UI (Reanimated): no recalcula el diseño y no se
 * entrecorta mientras la pantalla procesa justo la respuesta que se espera. Con movimiento reducido no
 * gira ni se desliza nada: el anillo queda dibujado y la barra quieta, que se siguen leyendo como
 * «cargando» sin moverse.
 */
import React, { useEffect, useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { color, palette, radius } from '../theme/tokens';
import { DegradadosLetraA, LETRA_A } from './marca-letra';

export type TamanoCargador = 'compacto' | 'fila' | 'bloque';

/** Lado del anillo y grosor de su trazo por tamaño. `compacto` cabe dentro de un botón redondo. */
const MEDIDAS: Record<TamanoCargador, { lado: number; trazo: number; letra: number }> = {
  compacto: { lado: 22, trazo: 2.4, letra: 0 },
  fila: { lado: 40, trazo: 2.6, letra: 20 },
  bloque: { lado: 96, trazo: 3.2, letra: 46 },
};

/** Una vuelta del anillo exterior. Lo bastante lenta para verse elegante, lo bastante rápida para no parecer colgada. */
const VUELTA_MS = 1400;

/** El anillo de luz con la «A» dentro. */
export function AnilloAtlas({ tamano = 'fila' }: { tamano?: TamanoCargador }) {
  const { lado, trazo, letra } = MEDIDAS[tamano];
  const reducido = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const giro = useSharedValue(0);
  const contragiro = useSharedValue(0);
  const respiro = useSharedValue(1);

  useEffect(() => {
    if (reducido) return;
    giro.value = withRepeat(withTiming(1, { duration: VUELTA_MS, easing: Easing.linear }), -1, false);
    contragiro.value = withRepeat(withTiming(1, { duration: VUELTA_MS * 1.7, easing: Easing.linear }), -1, false);
    respiro.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(giro);
      cancelAnimation(contragiro);
      cancelAnimation(respiro);
    };
  }, [reducido, giro, contragiro, respiro]);

  const exterior = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 360}deg` }] }));
  const interior = useAnimatedStyle(() => ({ transform: [{ rotate: `${-contragiro.value * 360}deg` }] }));
  const latido = useAnimatedStyle(() => ({ transform: [{ scale: respiro.value }], opacity: 0.55 + (respiro.value - 0.96) * 4 }));
  const marca = useAnimatedStyle(() => ({ transform: [{ scale: 0.98 + (respiro.value - 0.96) * 0.5 }] }));

  // El anillo exterior es un arco de ~70 % con un punto de luz en su extremo: el «satélite» de la marca.
  const r = lado / 2 - trazo;
  const circ = 2 * Math.PI * r;
  const ri = r - trazo * 2.2;
  const circi = 2 * Math.PI * ri;
  const c = lado / 2;

  return (
    <View style={{ width: lado, height: lado }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Halo que respira detrás: la luz de la marca. */}
      {letra > 0 ? <Animated.View style={[StyleSheet.absoluteFill, styles.halo, { borderRadius: lado / 2 }, latido]} /> : null}

      <Animated.View style={[StyleSheet.absoluteFill, exterior]}>
        <Svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`}>
          <Defs>
            <SvgGradient id={`${id}-arco`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.brand300} stopOpacity={0} />
              <Stop offset="0.55" stopColor={palette.brand400} stopOpacity={0.9} />
              <Stop offset="1" stopColor={palette.brand300} />
            </SvgGradient>
          </Defs>
          {/* La pista: el círculo entero, apenas visible, para que el arco se lea como avance sobre algo. */}
          <Circle cx={c} cy={c} r={r} stroke={palette.brand500} strokeOpacity={0.18} strokeWidth={trazo} fill="none" />
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={`url(#${id}-arco)`}
            strokeWidth={trazo}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circ * 0.7} ${circ}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
          {/* El punto de luz en la punta del arco. */}
          <Circle cx={c + r * Math.cos((0.7 * 2 - 0.5) * Math.PI)} cy={c + r * Math.sin((0.7 * 2 - 0.5) * Math.PI)} r={trazo * 1.05} fill={palette.white} />
        </Svg>
      </Animated.View>

      {letra > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, interior]}>
          <Svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`}>
            <Circle
              cx={c}
              cy={c}
              r={ri}
              stroke={palette.brand500}
              strokeOpacity={0.55}
              strokeWidth={trazo * 0.55}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circi * 0.18} ${circi * 0.12}`}
            />
          </Svg>
        </Animated.View>
      ) : null}

      {letra > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.centro, marca]}>
          <Svg width={letra} height={letra} viewBox="0 0 48 48">
            <Defs>
              <DegradadosLetraA prefijo={`${id}-a`} />
            </Defs>
            <Path d={LETRA_A.caraLuz} fill={`url(#${id}-a-luz)`} />
            <Path d={LETRA_A.caraSombra} fill={`url(#${id}-a-sombra)`} />
            <Path d={LETRA_A.travesano} fill={`url(#${id}-a-travesano)`} />
            <Path d={LETRA_A.filo} stroke={palette.white} strokeWidth={0.4} strokeLinecap="round" opacity={0.6} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Proporción de la barra que ocupa el tramo de luz. */
const TRAMO = 0.38;
const RECORRIDO_MS = 1500;

/** La barra de carga indeterminada: un tramo con el degradado de la marca que la recorre de lado a lado. */
export function BarraDeCarga({ ancho }: { ancho?: number | `${number}%` }) {
  const reducido = useReducedMotion();
  const [pista, setPista] = useState(0);
  const avance = useSharedValue(0);

  useEffect(() => {
    if (reducido || pista === 0) return;
    avance.value = 0;
    avance.value = withRepeat(withTiming(1, { duration: RECORRIDO_MS, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => cancelAnimation(avance);
  }, [reducido, pista, avance]);

  const tramo = useAnimatedStyle(() => {
    // De fuera por la izquierda a fuera por la derecha. Quieto (movimiento reducido): centrado.
    const x = reducido ? pista * (0.5 - TRAMO / 2) : -pista * TRAMO + avance.value * pista * (1 + TRAMO);
    return { transform: [{ translateX: x }] };
  });

  return (
    <View
      style={[styles.pista, { width: ancho ?? '100%' }]}
      onLayout={(e: LayoutChangeEvent) => setPista(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="barra-de-carga"
    >
      {pista > 0 ? (
        <Animated.View style={[styles.tramo, { width: pista * TRAMO }, tramo]}>
          <LinearGradient
            colors={[`${palette.brand500}00`, palette.brand400, palette.brand300, `${palette.brand300}00`]}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { backgroundColor: color.brandWash.from },
  centro: { alignItems: 'center', justifyContent: 'center' },
  pista: { height: 4, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },
  tramo: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.pill, overflow: 'hidden' },
});
