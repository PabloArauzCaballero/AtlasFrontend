/**
 * El arranque: la marca respira una vez y entrega la app.
 *
 * ## Que problema resuelve
 *
 * El splash nativo es una IMAGEN: no se puede animar, y desaparece de golpe en el fotograma en que
 * la app esta lista. El resultado era un corte seco entre el logotipo quieto y la primera pantalla,
 * y ese corte es lo primero que ve cualquiera al abrir. Una app que arranca con un salto se siente
 * mas lenta de lo que es, aunque tarde exactamente lo mismo.
 *
 * ## Como esta resuelto
 *
 * El splash nativo se oculta EN CUANTO hay algo que dibujar, y esta capa toma el relevo con la
 * misma marca sobre el mismo navy: el cambio no se ve porque no hay cambio. A partir de ahi la
 * marca hace un solo gesto —entra, respira, se va— y descubre la app.
 *
 * ```
 *  entrada 420 ms         respiro 260 ms        salida 420 ms
 *  escala 0.86 -> 1       escala 1 -> 1.04      escala 1.04 -> 1.12
 *  opacidad 0 -> 1                              opacidad 1 -> 0
 * ```
 *
 * El respiro es lo que separa un logotipo animado de un logotipo que aparece y ya: sin el, la
 * entrada y la salida se leen como un unico movimiento de escala y la marca no llega a estar quieta
 * en ningun momento —justo el instante en el que se la reconoce—.
 *
 * ## Por que se va hacia ADELANTE y no se desvanece
 *
 * La salida escala a 1.12 mientras se apaga: la marca se acerca a la camara y la atraviesa, que es
 * el mismo lenguaje que el corte de marca de la bienvenida (`ui/brand-cut.tsx`). Un fundido a secas
 * diria «se acabo el logo»; acercandose dice «estas entrando», y las dos transiciones de la app
 * cuentan entonces la misma historia.
 *
 * ## Movimiento reducido
 *
 * No hay animacion: la capa se retira en cuanto la app esta lista. Una marca que crece ocupando la
 * pantalla entera es exactamente lo que el ajuste del sistema pide no hacer.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { color } from '../theme/tokens';
import { AtlasMark } from './brand';
import { AtlasText } from './primitives';

const ENTRADA = 420;
const RESPIRO = 260;
const SALIDA = 420;

/**
 * La capa de arranque. Se dibuja sobre todo lo demas y se retira sola.
 *
 * `onDone` avisa cuando ya no queda nada que ver, para que el arbol la desmonte: una vista a pantalla
 * completa con `pointerEvents: none` no molesta, pero seguir montada obliga a componerla en cada
 * fotograma de la app durante el resto de la sesion.
 */
export function AnimatedSplash({ listo, onDone }: { listo: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const paso = useSharedValue(0);
  /*
    La salida se lanza UNA vez.

    Sin esta guarda, el efecto se relanzaba en cada render del arbol —porque `onDone` es una funcion
    nueva cada vez— y `withSequence` volvia a empezar desde el principio. El sintoma no se parece a
    la causa: la marca se quedaba en pantalla indefinidamente, como si la app no arrancara, cuando
    lo que pasaba es que la animacion no llegaba nunca al final porque alguien la reiniciaba.
  */
  const lanzada = React.useRef(false);
  const terminar = React.useRef(onDone);
  terminar.current = onDone;
  // Estable: el callback que cruza al hilo de JS no puede cambiar de identidad en cada render, o el
  // efecto que lo usa se relanza y con el la animacion entera.
  const avisar = React.useCallback(() => terminar.current(), []);

  React.useEffect(() => {
    if (!listo || lanzada.current) return;
    lanzada.current = true;
    if (reduced) {
      terminar.current();
      return;
    }
    /*
      Una sola secuencia y no tres animaciones encadenadas con retardos: encadenar por tiempo
      obliga a que cada tramo conozca cuanto duran los anteriores, y basta con tocar uno para que
      los demas se solapen sin que nadie lo note hasta verlo.
    */
    paso.value = withSequence(
      withTiming(1, { duration: ENTRADA, easing: Easing.out(Easing.cubic) }),
      withDelay(RESPIRO, withTiming(2, { duration: SALIDA, easing: Easing.in(Easing.cubic) }, (terminado) => {
        if (terminado) runOnJS(avisar)();
      })),
    );
  }, [listo, reduced, paso, avisar]);

  /*
    Red de seguridad: pase lo que pase, esta capa se retira.

    Si la sesion no termina de restaurarse —el servidor no responde, el token esta corrupto— `listo`
    no llega nunca y la persona se queda mirando un logotipo sin saber que hacer. Un arranque
    bloqueado es el peor fallo posible de una app de dinero, porque no se distingue de que la app
    este rota. A los seis segundos se descubre la interfaz: si debajo hay un error, al menos se lee.
  */
  React.useEffect(() => {
    const alarma = setTimeout(() => {
      if (!lanzada.current) {
        lanzada.current = true;
        terminar.current();
      }
    }, 6000);
    return () => clearTimeout(alarma);
  }, []);

  const capa = useAnimatedStyle(() => ({
    opacity: interpolate(paso.value, [0, 1, 2], [1, 1, 0]),
  }));

  const marca = useAnimatedStyle(() => ({
    opacity: interpolate(paso.value, [0, 0.6, 1, 2], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(paso.value, [0, 1, 2], [0.86, 1, 1.12]) }],
  }));

  const rotulo = useAnimatedStyle(() => ({
    // El rotulo entra DESPUES de la marca —a partir del 55 % de la entrada— y sube seis pixeles. Es
    // el orden en que se lee un logotipo: primero el simbolo, luego el nombre.
    opacity: interpolate(paso.value, [0, 0.55, 1, 1.6], [0, 0, 1, 0]),
    transform: [{ translateY: interpolate(paso.value, [0, 1], [6, 0]) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.capa, capa]}>
      <View style={styles.centro}>
        <Animated.View style={marca}>
          <AtlasMark size={104} />
        </Animated.View>
        <Animated.View style={rotulo}>
          <AtlasText variant="hero" style={styles.rotulo}>
            ATLAS
          </AtlasText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // El mismo navy que el splash nativo y que el fondo de la app: los tres tienen que ser el mismo
  // color o el relevo se ve como un parpadeo de fondo.
  capa: { backgroundColor: color.surface.primary, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', gap: 20 },
  rotulo: { letterSpacing: 6, textAlign: 'center' },
});
