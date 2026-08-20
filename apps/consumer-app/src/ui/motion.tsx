/**
 * Movimiento de ATLAS.
 *
 * ## Para que sirve el movimiento aqui
 *
 * Para responder dos preguntas que el usuario se hace sin darse cuenta: «¿de donde salio esto?» y
 * «¿me hizo caso?». Una pantalla que aparece deslizandose desde la derecha dice que se entro a un
 * detalle; un boton que se hunde bajo el dedo dice que el toque llego. Todo lo que no responda a una
 * de esas dos preguntas es decoracion, y la decoracion en una app de dinero se paga en segundos de
 * espera.
 *
 * ## Movimiento reducido
 *
 * `useReducedMotion` no es una casilla de accesibilidad que se marca y se olvida: hay gente a la que
 * el movimiento le produce mareo real. Cuando esta activo, las duraciones valen **cero** y las
 * animaciones se convierten en cambios instantaneos. El contenido nunca depende de la animacion para
 * mostrarse: si el movimiento no ocurre, la pantalla igual esta completa.
 *
 * ## Por que Reanimated y no `Animated`
 *
 * Las animaciones corren en el hilo de UI. Durante una decision de credito el hilo de JS esta
 * ocupado —peticion, parseo, re-render— y con `Animated` sin `useNativeDriver` eso se ve como
 * tirones justo en el momento en que el usuario mas atento esta.
 */
import React from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { easing, motion, press } from '../theme/tokens';

const CURVE = Easing.bezier(easing.decelerate[0], easing.decelerate[1], easing.decelerate[2], easing.decelerate[3]);

/**
 * Entrada de un elemento de contenido: sube unos pixeles mientras aparece.
 *
 * El desplazamiento es pequeno —12 px— a proposito. Lo que se busca es que el ojo perciba que el
 * bloque *llego*, no que viaje: un recorrido largo obliga a seguirlo y retrasa la lectura.
 *
 * `index` escalona varios hermanos. El escalonado da orden de lectura sin dibujar ningun numero: el
 * ojo entiende «primero esto, luego esto» porque lo vio ocurrir en ese orden.
 */
export function Appear({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <Animated.View style={style}>{children}</Animated.View>;

  return (
    <Animated.View
      style={style}
      entering={FadeInUp.duration(motion.base)
        .delay(index * motion.stagger)
        .easing(CURVE)
        .withInitialValues({ transform: [{ translateY: 12 }] })}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Superficie que responde al dedo hundiendose.
 *
 * Es lo que separa una tarjeta que se puede tocar de una que no: sin realimentacion tactil el
 * usuario toca dos veces «por si acaso», y en una pantalla de pago eso importa.
 *
 * La escala vuelve con `withTiming` corto en vez de un muelle. Un rebote en una lista de cuotas se
 * lee como juguete; aqui se quiere precision, no simpatia.
 */
export function PressSurface({
  children,
  style,
  scaleTo = press.scale,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: ViewStyle; scaleTo?: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const settle = (to: number) => {
    if (reduced) return;
    scale.value = withTiming(to, { duration: motion.fast, easing: CURVE });
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        settle(scaleTo);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        settle(1);
        rest.onPressOut?.(event);
      }}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Numero que cuenta hasta su valor.
 *
 * Solo para importes que **cambian** delante del usuario —el desglose 60/40 mientras teclea el
 * monto—. Animar una cifra que ya estaba ahi al abrir la pantalla la vuelve ilegible durante el
 * primer instante, que es justo cuando se la quiere leer.
 */
export function useCountUp(value: number, enabled = true): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value);

  React.useEffect(() => {
    if (!enabled || reduced) {
      progress.value = value;
      return;
    }
    progress.value = withTiming(value, { duration: motion.base, easing: CURVE });
  }, [value, enabled, reduced, progress]);

  return progress;
}

export { Animated as MotionView };
