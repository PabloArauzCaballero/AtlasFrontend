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
 *  - Es EXAGERADO a propósito (Pablo, 2026-10-07: «más exagerado ese brillo y ultra HD»): banda ancha con filo nítido por delante,
 *    1,3 s de barrido cada 3,8 s, 85 % de blanco en el centro, 2,2 % de respiración y un halo que sube hasta +38 % de opacidad
 *    y +14 pt de radio. Aun así: sólo la acción principal, una fase por botón y apagado cuando no debe moverse.
 *  - Sólo `transform` y `opacity` (y la opacidad de la sombra), nunca geometría.
 *  - Se apaga con movimiento reducido, bloqueado y cargando: un botón apagado que sigue brillando invita a pulsarlo.
 *  - En la web NO corre: react-native-web repinta sin parar y esa capa ya tiene su propio temperamento CSS.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
import { alpha, brillo, color, luz } from '../theme/tokens';

/** Un ciclo completo: barrido + reposo. */
export const CICLO_MS = 3800;
/** Fracción del ciclo en la que la luz está cruzando; el resto es reposo. */
export const FRACCION_BARRIDO = 0.34;
/** Ancho de la banda de luz, en puntos. */
export const ANCHO_BANDA = 110;
/** Ancho del filo: el destello fino y nítido que va por delante de la banda. */
export const ANCHO_FILO = 14;
/** Cuánto va el filo por delante de la banda, en puntos. */
export const ADELANTO_FILO = 62;
/** Cuánto crece el botón al «respirar». Se nota al mirar y no se persigue con la vista. */
export const RESPIRACION = 0.022;

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
  const banda = useAnimatedStyle(() => {
    const q = (fase.value + desfase) % 1;
    return {
      opacity: opacidadDelBarrido(q),
      transform: [{ translateX: posicionDelBarrido(q, ancho) }, { skewX: '-22deg' }],
    };
  });
  // El filo va por DELANTE de la banda y un poco más tarde en la curva: se lee como el borde brillante de un cristal.
  const filo = useAnimatedStyle(() => {
    const q = (fase.value + desfase) % 1;
    return {
      opacity: Math.min(1, opacidadDelBarrido(q) * 1.25),
      transform: [{ translateX: posicionDelBarrido(q, ancho) + ADELANTO_FILO }, { skewX: '-22deg' }],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" testID="boton-brillo" style={[styles.banda, banda]}>
        <LinearGradient
          colors={[alpha(luz.blanco, 0), color.action.sheen, alpha(luz.blanco, 0.85), color.action.sheen, alpha(luz.blanco, 0)]}
          locations={[0, 0.3, 0.55, 0.8, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.filo, filo]}>
        <LinearGradient
          colors={[alpha(luz.blanco, 0), luz.blanco, alpha(luz.blanco, 0)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
}

/**
 * El acabado de cristal del botón principal: luz de arriba, hilo de luz en el canto y sombra de abajo.
 *
 * ESTÁTICO —no se mueve, no cuesta nada— y por eso se queda también con movimiento reducido y en la web: es lo que hace
 * que el botón se lea como una pieza de cristal iluminada y no como un rectángulo pintado. Dibujado con degradados
 * vectoriales: nítido a cualquier densidad de pantalla.
 */
export function BrilloDeCristal() {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        testID="boton-cristal"
        colors={[color.action.glassTop, alpha(luz.blanco, 0.03), alpha(luz.blanco, 0)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.cristalArriba}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(color.action.shade, 0), alpha(color.action.shade, 0.22 * brillo)]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.sombraAbajo}
      />
      <View pointerEvents="none" style={styles.hiloDeLuz} />
    </>
  );
}

/**
 * La luz que sube al tocar. `progreso` es el del hundimiento: 0 en reposo, 1 con el dedo abajo.
 * Blanca sobre la marca, verde de marca sobre el resto (que son superficies oscuras o transparentes).
 */
export function DestelloDeToque({ progreso, principal }: { progreso: SharedValue<number>; principal: boolean }) {
  const estilo = useAnimatedStyle(() => ({ opacity: progreso.value * (principal ? 0.34 : 0.14) }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="boton-destello"
      style={[StyleSheet.absoluteFill, { backgroundColor: principal ? color.fixed.white : color.brand.b400 }, estilo]}
    />
  );
}

const styles = StyleSheet.create({
  // Más alta que el botón: con la inclinación, los extremos de la banda no dejan hueco arriba ni abajo.
  banda: { position: 'absolute', top: -12, bottom: -12, left: 0, width: ANCHO_BANDA },
  filo: { position: 'absolute', top: -12, bottom: -12, left: 0, width: ANCHO_FILO },
  cristalArriba: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  sombraAbajo: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%' },
  // El hilo de luz del canto superior: una línea de 1 punto que se apaga hacia los extremos de la píldora.
  hiloDeLuz: { position: 'absolute', top: 1, left: '12%', right: '12%', height: 1, borderRadius: 1, backgroundColor: color.action.glassLine },
});
