/**
 * La letra de la categoría de riesgo, como una medalla.
 *
 * Era la letra suelta en una caja gris (`amount` sobre `surface.sunken`): se leía como un dato de
 * formulario, no como lo que es, el resumen de cómo paga la persona (Pablo, 2026-10-08: «la letra de la
 * categoría del riesgo debe ser mucho más bonita, así le falta bastante»). Ahora es una pieza de metal
 * de marca: disco con degradado, brillo arriba, aro interior y la letra en la tipografía de titulares,
 * hundida en el metal. Con atraso registrado el metal pasa a ámbar, como el resto de los avisos.
 *
 * Un barrido de luz cruza la medalla cada pocos segundos (transformación en el hilo de UI). Con
 * «reducir movimiento» queda quieta.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
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
import { font, palette } from '../theme/tokens';
import { AtlasText } from './primitives';

const LADO = 76;

const METAL = {
  marca: { cara: ['#7DF6D8', palette.brand400, '#0E8C7B'] as const, aro: 'rgba(255,255,255,0.5)', luz: palette.brand400 },
  alerta: { cara: ['#FFE0A6', palette.warning, '#C9862A'] as const, aro: 'rgba(255,255,255,0.5)', luz: palette.warning },
};

export function MedallaDeRiesgo({ letra, alerta = false }: { letra: string; alerta?: boolean }) {
  const metal = alerta ? METAL.alerta : METAL.marca;
  const reducido = useReducedMotion();
  const barrido = useSharedValue(0);

  useEffect(() => {
    if (reducido) return;
    barrido.value = withDelay(
      700,
      withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 3200 }), withTiming(0, { duration: 0 })), -1, false),
    );
    return () => cancelAnimation(barrido);
  }, [barrido, reducido]);

  const luz = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * barrido.value) * 0.85,
    transform: [{ translateX: -LADO + barrido.value * LADO * 2 }, { rotate: '22deg' }],
  }));

  // Dos letras («A+», «BB») no caben al mismo cuerpo que una.
  const cuerpo = letra.length > 1 ? 30 : 42;

  return (
    <View style={[styles.sombra, { shadowColor: metal.luz }]} accessibilityRole="image" accessibilityLabel={`Categoría ${letra}`} testID="medalla-riesgo">
      <LinearGradient colors={metal.cara} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.cara}>
        {/* El brillo de arriba: el metal recibe la luz desde encima. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 0.75]}
          style={styles.brillo}
        />
        <View pointerEvents="none" style={[styles.aro, { borderColor: metal.aro }]} />
        <AtlasText
          variant="hero"
          style={[styles.letra, { fontSize: cuerpo, lineHeight: cuerpo * 1.12 }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {letra}
        </AtlasText>
        {reducido ? null : (
          <Animated.View pointerEvents="none" style={[styles.barrido, luz]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  sombra: {
    width: LADO,
    height: LADO,
    borderRadius: LADO / 2,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cara: {
    width: LADO,
    height: LADO,
    borderRadius: LADO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  brillo: { position: 'absolute', top: 0, left: 0, right: 0, height: LADO * 0.6 },
  aro: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderRadius: (LADO - 12) / 2, borderWidth: 1.5 },
  letra: {
    fontFamily: font.displayBlack,
    color: '#05223A',
    textAlign: 'center',
    letterSpacing: 0,
    // Hundida en el metal: un filo de luz debajo de cada trazo.
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0.5,
  },
  barrido: { position: 'absolute', top: -20, bottom: -20, width: 26 },
});
