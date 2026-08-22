/**
 * El corte de marca: la transicion que saca al cliente de la bienvenida.
 *
 * ## Que hace
 *
 * Al pulsar cualquier boton de la bienvenida, la camara se acerca a la marca hasta atravesarla y
 * la pantalla de destino queda detras. No es un fundido con un logotipo encima: son dos fases
 * encadenadas que cuentan una sola cosa —«estas entrando en Atlas»— y por eso el logotipo crece
 * hasta salirse del encuadre en vez de quedarse quieto en el centro.
 *
 * ```
 *  fase 1  CUBRIR (300 ms)          fase 2  ATRAVESAR (260 ms)
 *  velo    0 -> 1                   velo    1 -> 0   (con retardo)
 *  marca   1.0 -> 1.55              marca   1.55 -> 7.5
 *  marca   opacidad 0 -> 1          marca   opacidad 1 -> 0
 *                    |
 *                    +-- aqui se navega: la pantalla vieja ya no se ve y la nueva
 *                        tiene los 260 ms de la fase 2 para montarse sin que se vea montarse.
 * ```
 *
 * ## Por que el momento de navegar esta en medio y no al principio
 *
 * Navegar antes de que el velo sea opaco deja ver el cambio de pantalla POR DEBAJO de la
 * animacion, y entonces se ven dos transiciones a la vez: la del corte y la del `Stack`. Navegar
 * al final obliga a esperar a que termine el movimiento para empezar a montar el destino, y ese
 * retraso se paga en un parpadeo al descubrir. En el punto de cobertura total ninguna de las dos
 * cosas se ve.
 *
 * ## Por que 560 ms y no 300
 *
 * Es el unico movimiento de la app que se pasa del cuarto de segundo (`motion.brandCut`). Se lo
 * puede permitir porque ocurre **una sola vez por sesion** —solo desde la bienvenida— y porque
 * durante el la app no esta haciendo esperar a nadie: el destino se monta debajo mientras cubre.
 * Un corte mas rapido no da tiempo a reconocer la marca, que es justo para lo que existe.
 *
 * ## Movimiento reducido
 *
 * Con el ajuste del sistema activo **no hay corte**: la accion se ejecuta en el acto. No es una
 * version corta de la animacion, es ninguna. Una capa que tapa la pantalla entera es exactamente
 * el tipo de movimiento que provoca mareo, y degradarla a «lo mismo pero rapido» no lo arregla.
 */
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { color } from '../theme/tokens';
import { AtlasMark } from './brand';
import { EMPHASIZED } from './motion';

/**
 * Reparto de `motion.brandCut` entre las dos fases.
 *
 * ATRAVESAR se lleva mas que CUBRIR, al reves que antes. Cubrir solo tiene que ocultar el cambio de
 * pantalla —en cuanto el velo es opaco ya cumplio— mientras que atravesar ES el efecto: es donde la
 * marca crece hasta pasar de largo, y es lo que hay que dar tiempo a ver. Con 260 ms el zoom se
 * intuia; con 520 se sigue.
 */
const CUBRIR = 380;
const ATRAVESAR = 520;

/**
 * Escala final de la marca.
 *
 * A 7.5 el trazo de la «A» ya es mas ancho que la pantalla, asi que lo ultimo que se ve antes de
 * descubrir es color de marca plano y no un dibujo reconocible. Quedarse corto —a 3, por ejemplo—
 * deja ver un logotipo grande desvaneciendose, que se lee como una marca de agua encima del
 * contenido en vez de como una camara que lo atraviesa.
 *
 * La escala de cobertura subio de 1.55 a 1.9 al alargar la fase: con mas tiempo por delante, un
 * primer tramo corto dejaba la marca casi quieta y el movimiento parecia arrancar tarde. Lo que se
 * busca es velocidad CRECIENTE de principio a fin —una camara que acelera hacia la marca—, y para
 * eso el primer tramo tambien tiene que recorrer distancia.
 */
const ESCALA_FINAL = 7.5;
const ESCALA_COBERTURA = 1.9;

type Ejecutar = (accion: () => void) => void;

const BrandCutContext = React.createContext<Ejecutar | null>(null);

/**
 * Lanza una navegacion a traves del corte de marca.
 *
 * Devuelve siempre una funcion utilizable: fuera del proveedor —o con movimiento reducido— ejecuta
 * la accion directamente. Una pantalla nunca tiene que preguntar si el corte esta disponible, y
 * por eso ninguna se queda sin navegar si alguien la monta fuera del arbol.
 */
export function useBrandCut(): Ejecutar {
  const ejecutar = React.useContext(BrandCutContext);
  return React.useCallback<Ejecutar>((accion) => (ejecutar ? ejecutar(accion) : accion()), [ejecutar]);
}

export function BrandCutProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  /** 0 = en reposo, 1 = cobertura total, 2 = atravesada. Una sola magnitud para las dos fases. */
  const fase = useSharedValue(0);
  const [activo, setActivo] = React.useState(false);

  const ejecutar = React.useCallback<Ejecutar>(
    (accion) => {
      if (reduced) {
        accion();
        return;
      }
      setActivo(true);
      fase.value = 0;
      fase.value = withTiming(1, { duration: CUBRIR, easing: EMPHASIZED }, (terminada) => {
        if (!terminada) return;
        // La navegacion ocurre con el velo ya opaco: ni se ve salir la pantalla vieja ni entrar la
        // nueva, que es lo unico que hace que las dos transiciones no se pisen.
        runOnJS(accion)();
        fase.value = withTiming(2, { duration: ATRAVESAR, easing: EMPHASIZED }, (fin) => {
          if (fin) runOnJS(setActivo)(false);
        });
      });
    },
    [fase, reduced],
  );

  const veloStyle = useAnimatedStyle(() => ({
    // El velo se retira con retardo: si se va a la vez que la marca, durante un instante se ven las
    // dos cosas medio transparentes superpuestas al destino y la pantalla parece sucia.
    opacity: interpolate(fase.value, [0, 1, 1.45, 2], [0, 1, 1, 0]),
  }));

  const marcaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fase.value, [0, 0.6, 1.35, 2], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(fase.value, [0, 1, 2], [1, ESCALA_COBERTURA, ESCALA_FINAL]) }],
  }));

  return (
    <BrandCutContext.Provider value={ejecutar}>
      {children}
      {activo ? (
        /*
          `pointerEvents="none"` aunque cubra la pantalla: el corte no es un dialogo y no tiene que
          capturar el dedo. Lo que evita el doble toque es que el boton de origen ya navego.
        */
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.velo, veloStyle]} />
          <Animated.View style={[styles.centro, { width, height }, marcaStyle]}>
            <AtlasMark size={112} />
          </Animated.View>
        </View>
      ) : null}
    </BrandCutContext.Provider>
  );
}

const styles = StyleSheet.create({
  velo: { backgroundColor: color.surface.primary },
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
