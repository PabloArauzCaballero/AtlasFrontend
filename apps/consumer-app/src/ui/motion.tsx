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
import { Platform, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easing, motion, press, spring } from '../theme/tokens';
import { webData } from '../web/estilo';
import { conToqueWeb } from './hit-slop';
import { useTramo } from './responsive';

const CURVE = Easing.bezier(easing.decelerate[0], easing.decelerate[1], easing.decelerate[2], easing.decelerate[3]);

/**
 * Un `Pressable` que se anima en el hilo de UI.
 *
 * El `pressed` que expone `Pressable` es estado de React: entra y sale de golpe, sin fotogramas
 * intermedios, y se pierde si algo re-renderiza en medio del toque —que es justo lo que pasa cuando
 * el control dispara una peticion—. Con un valor compartido el hundimiento tiene recorrido y
 * sobrevive al re-render.
 *
 * Se anima el propio pulsable y no una vista interior a proposito: asi el elemento que lleva los
 * estilos ES el que recibe el toque. Con la envoltura, un estilo de reparto —un ancho en
 * porcentaje, un `flex`— se aplicaba a un hijo dentro de un padre sin medidas, y la celda de una
 * rejilla acababa midiendo lo que midiera su contenido.
 */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** La curva simetrica de `easing.emphasized`, lista para pasar a `withTiming`. */
export const EMPHASIZED = Easing.bezier(
  easing.emphasized[0],
  easing.emphasized[1],
  easing.emphasized[2],
  easing.emphasized[3],
);

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
  // En web va siempre por `AppearWeb`: marca el bloque para la rejilla de escritorio aunque no se anime.
  if (Platform.OS === 'web') return <AppearWeb index={index} style={style} reducido={reduced}>{children}</AppearWeb>;
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
 * La misma entrada escalonada, para el NAVEGADOR.
 *
 * En web la animacion de montaje `entering` de Reanimated deja los bloques de la pantalla unos
 * encima de otros: mientras la anima, la vista sale del flujo del documento y el formulario se
 * pinta con el titulo, los campos y el boton apilados en el mismo sitio (se vio en el ingreso y en
 * el inicio, en la primera captura de la web). Aqui se anima lo mismo —opacidad y doce pixeles de
 * subida— con un valor compartido y `useAnimatedStyle`, que en web es un `transform` de CSS sobre
 * una vista que nunca abandona el flujo.
 */
function AppearWeb({
  children,
  index,
  style,
  reducido,
}: {
  children: React.ReactNode;
  index: number;
  style?: ViewStyle;
  reducido: boolean;
}) {
  /*
    A partir de 600 px la entrada la hace la hoja de estilo web (`estilo.ts`): subir + escalar +
    salir de un desenfoque, escalonada por posicion, con el resorte de la landing. Por debajo, la
    entrada corta del telefono, con un valor compartido (ver arriba por que no `entering`).
  */
  const avance = useSharedValue(reducido ? 1 : 0);
  React.useEffect(() => {
    if (reducido) return;
    avance.value = withTiming(1, { duration: motion.base + index * motion.stagger, easing: CURVE });
  }, [avance, index, reducido]);
  const animado = useAnimatedStyle(() => ({
    opacity: avance.value,
    transform: [{ translateY: 12 * (1 - avance.value) }],
  }));
  // El mismo umbral que la hoja de estilo (`@media (min-width: TRAMO.tableta)`), sin repetir el número.
  const escritorio = useTramo() !== 'telefono';
  if (escritorio) {
    return (
      <View style={style} {...webData('aparece', { indice: String(Math.min(index, 11)) })}>
        {children}
      </View>
    );
  }
  return <Animated.View style={[style, animado]}>{children}</Animated.View>;
}

/**
 * Superficie que responde al dedo hundiendose.
 *
 * Es lo que separa una tarjeta que se puede tocar de una que no: sin realimentacion tactil el
 * usuario toca dos veces «por si acaso», y en una pantalla de pago eso importa.
 *
 * ## Por que muelle y no `withTiming`
 *
 * Antes la escala volvia con una curva de 140 ms, por miedo a que un muelle metiera rebote en una
 * lista de cuotas. El miedo era correcto y la conclusion no: lo que hace juguete a un muelle es
 * estar SUBAMORTIGUADO, no ser un muelle. `spring.press` esta sobreamortiguado —llega a 1 y se
 * queda, sin rebasarlo—, y a cambio la desaceleracion deja de ser una rampa.
 *
 * La diferencia se nota justo donde importa: al soltar el dedo. Con la curva, el elemento sube a
 * velocidad constante y se para en seco; con el muelle, frena solo. Es la misma distancia recorrida
 * y se lee como un material distinto.
 */
export const PressSurface = React.forwardRef<View, Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }>(
  // El ref se reenvía al pulsable de verdad: el botón flotante del asistente lo usa para DEVOLVER
  // el foco al cerrar su hoja con Escape en web. Sin ref, el foco caía al body.
  function PressSurface({ children, style, scaleTo = press.scale, ...rest }, ref) {
    const reduced = useReducedMotion();
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const settle = (to: number) => {
      if (reduced) return;
      scale.value = withSpring(to, spring.press);
    };

    return (
      <AnimatedPressable
        ref={ref}
        // En el navegador `hitSlop` no existe: `data-toque` le da el mismo área (ver `ui/hit-slop.ts`).
        {...conToqueWeb(rest as PressableProps & { dataSet?: Record<string, string> }, rest.hitSlop)}
        onPressIn={(event) => {
          settle(scaleTo);
          rest.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          settle(1);
          rest.onPressOut?.(event);
        }}
        style={[style, animated]}
      >
        {children}
      </AnimatedPressable>
    );
  },
);

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

/**
 * Movimiento CONSTANTE y discreto para lo que tiene que sentirse vivo: la insignia de nivel, las medallas, un icono
 * clave. No es adorno que se mueve sin motivo: es la señal de «esto está ganado» o «esto es lo que sigue».
 *
 * Reglas que lo hacen aguantable:
 *  - Sólo `transform` y `opacity`, en el hilo de UI (Reanimated): no cuesta nada aunque el hilo de JS esté ocupado.
 *  - Amplitud pequeña: 3 px, 6 % de escala. Se nota al mirar y no se persigue con la vista.
 *  - Con movimiento reducido NO se mueve (el contenido nunca depende de la animación).
 *  - `retardo` descompasa varios a la vez: diez medallas que respiran en fase se leen como un parpadeo.
 *
 *   `flota`  sube y baja despacio        (medallas, nivel)
 *   `pulsa`  respira creciendo y volviendo (icono principal)
 *   `late`   latido más vivo, con brillo  (algo recién ganado o pendiente)
 *   `oscila` se mece de lado a lado       (insignia sin ganar que invita a ganarla)
 */
export type TipoDeVida = 'flota' | 'pulsa' | 'late' | 'oscila';

/**
 * La curva de la vida: 0 → 1 → 0 a lo largo de una fase que corre de 0 a 1, desplazada por `retardo`.
 *
 * Es periódica y continua en TODO su dominio, incluido el cierre del ciclo: `suavidad(1) === suavidad(0)` para cualquier
 * desfase. Está aparte (y con `'worklet'`) para poder probarla: la versión anterior usaba `(fase + retardo / periodo) % 1`,
 * que salta de ~1 a ~0 al envolverse, y ninguna prueba lo veía porque la fórmula vivía dentro de un hook de animación.
 */
export function suavidad(fase: number, retardo: number, periodo: number): number {
  'worklet';
  return 0.5 - 0.5 * Math.cos((fase + retardo / periodo) * 2 * Math.PI);
}

export function Vivo({
  children,
  tipo = 'flota',
  periodo = 2600,
  retardo = 0,
  style,
}: {
  children: React.ReactNode;
  tipo?: TipoDeVida;
  /** Un ciclo completo (ida y vuelta), en ms. La curva es un coseno continuo: sin saltos al cerrar el ciclo. */
  periodo?: number;
  retardo?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const fase = useSharedValue(0);

  React.useEffect(() => {
    if (reduced) {
      cancelAnimation(fase);
      fase.value = 0;
      return;
    }
    /*
      La fase corre de 0 a 1 en línea recta y vuelve a empezar SIN ida y vuelta, y la curva la pone un coseno (abajo).

      Antes la fase iba y volvía con `reverse` y el desfase se aplicaba con `(fase + retardo / periodo) % 1`. Ese `% 1` hace
      que, cuando la suma pasa de 1, el valor SALTE de ~1 a ~0 de golpe: la casa se sacudía 6 px, el escudo cambiaba de
      tamaño en seco, en cada ciclo y en todo icono con desfase. Con un coseno sobre una fase lineal la curva es continua
      y su velocidad también: no hay un solo instante en que algo arranque o se detenga de golpe.
    */
    fase.value = 0;
    fase.value = withRepeat(withTiming(1, { duration: periodo, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(fase);
  }, [fase, periodo, reduced]);

  const animado = useAnimatedStyle(() => {
    if (reduced) return {};
    // El retardo desplaza la fase sin esperar, y como la curva es periódica no hace falta envolverla.
    const t = suavidad(fase.value, retardo, periodo); // 0 → 1 → 0, continua y suave en los extremos
    switch (tipo) {
      case 'pulsa':
        return { transform: [{ scale: 1 + t * 0.06 }] };
      case 'late':
        return { opacity: 0.82 + t * 0.18, transform: [{ scale: 1 + t * 0.1 }] };
      case 'oscila':
        return { transform: [{ rotate: `${(t - 0.5) * 8}deg` }] };
      default:
        return { transform: [{ translateY: (t - 0.5) * 6 }] };
    }
  });

  return <Animated.View style={[style, animado]}>{children}</Animated.View>;
}

export { Animated as MotionView };
