/**
 * El brillo del botón: una respuesta al toque y una vida propia, las dos en el hilo de UI.
 *
 * ## Reactivo (todas las variantes)
 *
 * Al tocar, una capa de luz sube con el MISMO progreso que el hundimiento (`pressProgress`): el botón no sólo cede,
 * se ilumina por dentro. Sin timers propios: es el mismo valor compartido, así que no hay forma de que el destello y
 * el hundimiento se desincronicen.
 *
 * ## Autónomo y constante (sólo la acción principal)
 *
 * Un barrido de luz cruza el botón cada ~5 s y el halo respira despacio. Es lo que hace que el botón que hay que
 * pulsar se lea como «lo siguiente» sin que nadie lo toque.
 *
 * Esto contradice una regla anterior de `atlas-movimiento` («nada se mueve solo»), que nació de un destello en bucle
 * en TODOS los botones a la vez. Se concede con las condiciones que hacían daño a aquella versión:
 *  - SÓLO la acción principal con relleno de marca; si dos cosas brillan, no brilla ninguna (ver `Button`).
 *  - Cada botón tiene su fase (`desfase`): dos botones principales jamás barren a la vez.
 *  - Es sosegado: 1,3 s de barrido, 3,9 s de reposo, 38 % de blanco como máximo, 1,2 % de respiración.
 *  - Sólo `transform` y `opacity` (y la opacidad de la sombra), nunca geometría.
 *  - Se apaga con movimiento reducido, bloqueado y cargando: un botón apagado que sigue brillando invita a pulsarlo.
 *  - En la web NO corre: react-native-web repinta sin parar y esa capa ya tiene su propio temperamento CSS.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '../theme/tokens';

/** Un ciclo completo: barrido + reposo. */
export const CICLO_MS = 5200;
/** Fracción del ciclo en la que la luz está cruzando; el resto es reposo. */
export const FRACCION_BARRIDO = 0.25;
/** Ancho de la banda de luz, en puntos. */
export const ANCHO_BANDA = 64;
/** Cuánto crece el botón al «respirar». Se nota al mirar y no se persigue con la vista. */
export const RESPIRACION = 0.012;

/**
 * Interruptor global de la parte AUTÓNOMA. Apagado en pruebas: un bucle infinito bajo temporizadores falsos hace que
 * `jest.runAllTimers()` no termine nunca. La prueba del propio brillo lo enciende.
 */
export const autonomia = { activa: process.env.NODE_ENV !== 'test' };

/**
 * Dónde está la banda de luz para una fase `q` de 0 a 1.
 *
 * Entra por la izquierda y sale por la derecha durante `FRACCION_BARRIDO` del ciclo y se queda fuera el resto. Fuera
 * por los dos lados, así que el salto de `q` al envolverse (1 → 0) ocurre donde no hay nada que ver. Aparte y con
 * `'worklet'` para poder probarla sin montar nada.
 */
export function posicionDelBarrido(q: number, ancho: number): number {
  'worklet';
  const p = Math.min(q / FRACCION_BARRIDO, 1);
  // Arranca despacio, pasa rápido por el centro y se va: sin arranque ni parada en seco.
  const suave = p * p * (3 - 2 * p);
  return -ANCHO_BANDA + suave * (ancho + ANCHO_BANDA * 2);
}

/** Opacidad de la banda: nace y se apaga en los bordes para que no «aparezca» de golpe. */
export function opacidadDelBarrido(q: number): number {
  'worklet';
  const p = q / FRACCION_BARRIDO;
  if (p >= 1) return 0;
  return Math.sin(p * Math.PI);
}

/** ¿Debe moverse solo este botón? Una sola decisión para el barrido, la respiración y las pruebas. */
export function vivaPorSiSola(opciones: { principal: boolean; bloqueado: boolean; reducido: boolean }): boolean {
  return autonomia.activa && Platform.OS !== 'web' && opciones.principal && !opciones.bloqueado && !opciones.reducido;
}

/**
 * La fase del botón: corre de 0 a 1 en línea recta, desplazada por un desfase propio.
 *
 * Devuelve la fase YA desplazada y envuelta (`q`) —para el barrido, donde el salto cae fuera de la vista— y el desfase
 * crudo para la respiración, que usa `suavidad` y es continua sin envolver.
 */
export function useFaseDelBoton(viva: boolean): { fase: SharedValue<number>; desfase: number } {
  const fase = useSharedValue(0);
  // Aleatorio por botón y estable mientras viva: dos botones principales no barren a la vez.
  const [desfase] = React.useState(() => Math.random());
  React.useEffect(() => {
    if (!viva) {
      cancelAnimation(fase);
      fase.value = 0;
      return;
    }
    fase.value = 0;
    fase.value = withRepeat(withTiming(1, { duration: CICLO_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(fase);
  }, [fase, viva]);
  return { fase, desfase };
}

/** La banda de luz que cruza el botón. Va DENTRO del botón, que recorta con `overflow: hidden`. */
export function BarridoDeLuz({ fase, desfase, ancho }: { fase: SharedValue<number>; desfase: number; ancho: number }) {
  const estilo = useAnimatedStyle(() => {
    const q = (fase.value + desfase) % 1;
    return {
      opacity: opacidadDelBarrido(q),
      transform: [{ translateX: posicionDelBarrido(q, ancho) }, { skewX: '-20deg' }],
    };
  });
  return (
    <Animated.View pointerEvents="none" testID="boton-brillo" style={[styles.banda, estilo]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * La luz que sube al tocar. `progreso` es el del hundimiento: 0 en reposo, 1 con el dedo abajo.
 * Blanca sobre la marca, verde de marca sobre el resto (que son superficies oscuras o transparentes).
 */
export function DestelloDeToque({ progreso, principal }: { progreso: SharedValue<number>; principal: boolean }) {
  const estilo = useAnimatedStyle(() => ({ opacity: progreso.value * (principal ? 0.2 : 0.12) }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="boton-destello"
      style={[StyleSheet.absoluteFill, { backgroundColor: principal ? palette.white : palette.brand400 }, estilo]}
    />
  );
}

const styles = StyleSheet.create({
  // Más alta que el botón: con la inclinación, los extremos de la banda no dejan hueco arriba ni abajo.
  banda: { position: 'absolute', top: -12, bottom: -12, left: 0, width: ANCHO_BANDA },
});
