/**
 * El corte de marca: la transicion que saca al cliente de la bienvenida.
 *
 * ## Que hace
 *
 * Al pulsar cualquier boton de la bienvenida, la camara se acerca a la marca hasta atravesarla y
 * la pantalla de destino queda detras. No es un fundido con un logotipo encima: son tres fases
 * encadenadas que cuentan una sola cosa —«estas entrando en Atlas»— y por eso el logotipo crece
 * hasta salirse del encuadre en vez de quedarse quieto en el centro.
 *
 * ```
 *   0 ms ┃ RETROCESO  la marca se echa atras (1.0 -> 0.92) mientras el velo cubre
 * 240 ms ┃ CUBRIR     el velo ya es opaco y la marca empieza a venir hacia la camara
 *        ┃            └─ aqui se NAVEGA: la pantalla vieja ya no se ve y la nueva tiene
 *        ┃               el resto de la animacion para montarse sin que se vea montarse
 * 520 ms ┃ ATRAVESAR  aceleracion hasta escala 9, con estela, dispersion cromatica
 *        ┃            y lineas de velocidad radiales
 * 1700ms ┃ el velo se retira y debajo esta la app
 * ```
 *
 * ## Por que hay un RETROCESO antes del empuje
 *
 * Es anticipacion, el principio de animacion mas viejo que hay: un cuerpo que va a salir disparado
 * primero se comprime. Sin ese cuarto de segundo hacia atras, la marca arranca ya en movimiento y
 * el ojo no tiene con que comparar la velocidad — el zoom se intuye pero no se SIENTE. Con el
 * retroceso, el mismo recorrido se lee como el doble de rapido y no ha costado ni un pixel mas.
 *
 * ## Por que el momento de navegar esta en medio y no al principio
 *
 * Navegar antes de que el velo sea opaco deja ver el cambio de pantalla POR DEBAJO de la
 * animacion, y entonces se ven dos transiciones a la vez: la del corte y la del `Stack`. Navegar
 * al final obliga a esperar a que termine el movimiento para empezar a montar el destino, y ese
 * retraso se paga en un parpadeo al descubrir. En el punto de cobertura total ninguna de las dos
 * cosas se ve.
 *
 * ## Por que 1,7 s y no 560 ms
 *
 * Es, de lejos, el movimiento mas largo de la app. Se lo puede permitir porque ocurre **una sola
 * vez por sesion** —solo desde la bienvenida— y porque durante el la app no esta haciendo esperar
 * a nadie: el destino se monta debajo mientras cubre. Lo que se gana con el tiempo extra no es
 * lentitud, es detalle: la estela, la dispersion y las lineas de velocidad necesitan recorrido para
 * existir, y son ellas las que convierten un zoom en un plano.
 *
 * ## El sonido
 *
 * Pide el ta-dum, igual que el arranque. No suena dos veces: `useSonidoMarca().marca()` es
 * idempotente por apertura de app (ver `ui/brand-sound.tsx`), asi que si el arranque ya lo toco
 * —el caso normal, cinco segundos antes— aqui no hace nada. Suena cuando el arranque no pudo:
 * app ya abierta, vuelta desde segundo plano, recargado en caliente.
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
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color } from '../theme/tokens';
import { AtlasMark } from './brand';
import { useSonidoMarca } from './brand-sound';

/**
 * El guion, en milisegundos. Un solo reloj lineal y cada capa lee su tramo, por el mismo motivo que
 * en `ui/splash.tsx`: la estela, la dispersion y las lineas tienen que ir clavadas al mismo
 * movimiento, y seis animaciones con seis retardos se separan en cuanto se pierde un fotograma.
 */
const GUION = {
  retroceso: [0, 240],
  /** Cobertura total: el instante exacto en el que se puede navegar sin que se vea. */
  cubierto: 460,
  atravesar: [460, 1560],
  velo: [1420, 1700],
} as const;

const TOTAL = 1700;

/**
 * Escala final de la marca.
 *
 * A 9 la «A» es mas alta que la pantalla y el destino se descubre POR DENTRO de ella: por el hueco
 * del contador y por los lados, mientras los dos trazos siguen abriendose hacia afuera. Esto se
 * comprobo grabando el simulador —ver `docs/evidence/2026-08-24-arranque-cinematografico/`— porque
 * este mismo comentario afirmaba antes que a esta escala lo ultimo que se veia era «color de marca
 * plano», y es falso: la letra tiene un hueco, y el hueco es justamente por donde entra la pantalla
 * nueva. Subirla hasta que el trazo tapara el ancho entero convertiria el ultimo cuarto de segundo
 * en una pared verde lisa, que es menos interesante que lo que hace ahora.
 *
 * Quedarse corto —a 3, por ejemplo— deja ver un logotipo grande desvaneciendose, que se lee como una
 * marca de agua encima del contenido en vez de como una camara que lo atraviesa.
 */
const ESCALA_FINAL = 9;
const ESCALA_RETROCESO = 0.92;
const MARCA_PX = 116;

/** Cuantas copias rezagadas forman la estela. Tres: con dos no se lee como estela y con cinco es niebla. */
const ESTELA = 3;
/** Cuantas lineas de velocidad salen del centro. */
const LINEAS = 16;

const LETRA = 'M24 5 L43 43 H34 L24 21 L14 43 H5 Z';

function tramo(reloj: number, desde: number, hasta: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (reloj - desde) / (hasta - desde)));
}

function frena(x: number): number {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}

function acelera(x: number): number {
  'worklet';
  return x * x * x;
}

function suave(x: number): number {
  'worklet';
  return x * x * (3 - 2 * x);
}

/**
 * El recorrido de la camara, en escala, para un reloj dado.
 *
 * Esta en una funcion suelta porque lo usan CINCO capas —la marca, sus dos copias cromaticas y las
 * tres de la estela—, cada una con su propio retardo. Duplicar la formula garantizaba que tarde o
 * temprano una de las seis se quedara con la version vieja, y una estela que no sigue exactamente
 * la misma trayectoria que su marca no parece una estela: parece un segundo logotipo.
 */
function escalaEn(reloj: number): number {
  'worklet';
  const atras = suave(tramo(reloj, GUION.retroceso[0], GUION.retroceso[1]));
  const adelante = acelera(tramo(reloj, GUION.atravesar[0], GUION.atravesar[1]));
  return 1 - atras * (1 - ESCALA_RETROCESO) + adelante * (ESCALA_FINAL - ESCALA_RETROCESO);
}

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
  const sonido = useSonidoMarca();

  /** El reloj del corte, en milisegundos. */
  const reloj = useSharedValue(0);
  const [activo, setActivo] = React.useState(false);

  const ejecutar = React.useCallback<Ejecutar>(
    (accion) => {
      if (reduced) {
        accion();
        return;
      }
      setActivo(true);
      reloj.value = 0;
      sonido.marca();
      /*
        El reloj se parte en dos tramos con el MISMO ritmo lineal, no en dos animaciones distintas.
        El corte en `GUION.cubierto` existe solo para tener un callback donde navegar; visualmente
        no hay ninguna juntura porque la curva de cada capa se calcula sobre el reloj completo.
      */
      reloj.value = withTiming(GUION.cubierto, { duration: GUION.cubierto, easing: Easing.linear }, (cubierto) => {
        if (!cubierto) return;
        // La navegacion ocurre con el velo ya opaco: ni se ve salir la pantalla vieja ni entrar la
        // nueva, que es lo unico que hace que las dos transiciones no se pisen.
        runOnJS(accion)();
        reloj.value = withTiming(TOTAL, { duration: TOTAL - GUION.cubierto, easing: Easing.linear }, (fin) => {
          if (fin) runOnJS(setActivo)(false);
        });
      });
    },
    [reloj, reduced, sonido],
  );

  const velo = useAnimatedStyle(() => ({
    // El velo se retira con retardo: si se va a la vez que la marca, durante un instante se ven las
    // dos cosas medio transparentes superpuestas al destino y la pantalla parece sucia.
    opacity: frena(tramo(reloj.value, 0, GUION.cubierto)) * (1 - suave(tramo(reloj.value, GUION.velo[0], GUION.velo[1]))),
  }));

  /**
   * Las lineas de velocidad.
   *
   * Salen del centro hacia afuera y solo existen mientras la camara acelera. Son lo que hace que el
   * movimiento se lea como VELOCIDAD y no como un objeto que se hace grande: sin ellas el ojo no
   * tiene ninguna referencia fija contra la que medir el desplazamiento, porque la marca ocupa cada
   * vez mas encuadre y todo lo demas es color plano.
   */
  const lineas = useAnimatedStyle(() => {
    const avance = acelera(tramo(reloj.value, GUION.atravesar[0], GUION.atravesar[1]));
    return {
      opacity: 0.45 * Math.sin(Math.PI * tramo(reloj.value, GUION.cubierto, GUION.velo[0])),
      transform: [{ scale: 0.3 + avance * 3.4 }],
    };
  });

  return (
    <BrandCutContext.Provider value={ejecutar}>
      {children}
      {activo ? (
        /*
          `pointerEvents="none"` aunque cubra la pantalla: el corte no es un dialogo y no tiene que
          capturar el dedo. Lo que evita el doble toque es que el boton de origen ya navego.
        */
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.velo, velo]} />

          <Animated.View style={[styles.centro, { width, height }, lineas]}>
            <Svg width={520} height={520} viewBox="0 0 100 100">
              <Defs>
                <LinearGradient id="corte-linea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color.brand.b300} stopOpacity="0" />
                  <Stop offset="1" stopColor={color.brand.b300} stopOpacity="0.9" />
                </LinearGradient>
              </Defs>
              {Array.from({ length: LINEAS }, (_, indice) => (
                <Rect
                  key={indice}
                  x={49.7}
                  y={2}
                  width={0.6}
                  height={26}
                  rx={0.3}
                  fill="url(#corte-linea)"
                  // Repartidas en circulo. La rotacion es estatica: lo que se mueve es la escala del
                  // grupo entero, que el compositor resuelve sin volver a dibujar nada.
                  transform={`rotate(${(indice * 360) / LINEAS} 50 50)`}
                />
              ))}
            </Svg>
          </Animated.View>

          {/*
            La estela va DEBAJO de la marca y en orden inverso: la copia mas rezagada es la mas
            tenue y la que queda mas al fondo. Dibujarlas despues las pondria por delante y la marca
            nitida quedaria enterrada bajo sus propios fantasmas.
          */}
          {Array.from({ length: ESTELA }, (_, indice) => (
            <CopiaRezagada key={indice} indice={indice} reloj={reloj} width={width} height={height} />
          ))}

          {/*
            Dispersion cromatica: dos copias planas, una fria y una calida, desplazadas en sentidos
            opuestos y separandose a medida que acelera. Es lo que hace una lente real cuando la luz
            la atraviesa deprisa por los bordes, y es el detalle que separa «un SVG escalando» de
            «un plano». A escala 1 estan exactamente encima de la marca y no se ven.
          */}
          <CopiaCromatica reloj={reloj} width={width} height={height} tinte={color.brand.b300} sentido={1} />
          <CopiaCromatica reloj={reloj} width={width} height={height} tinte={color.brand.b700} sentido={-1} />

          <MarcaEnMovimiento reloj={reloj} width={width} height={height} />
        </View>
      ) : null}
    </BrandCutContext.Provider>
  );
}

/** La marca nitida: la que de verdad se ve. */
function MarcaEnMovimiento({ reloj, width, height }: { reloj: SharedValue<number>; width: number; height: number }) {
  const estilo = useAnimatedStyle(() => ({
    opacity: suave(tramo(reloj.value, 0, 320)) * (1 - suave(tramo(reloj.value, GUION.velo[0] - 120, GUION.velo[1]))),
    transform: [{ scale: escalaEn(reloj.value) }],
  }));

  return (
    <Animated.View style={[styles.centro, { width, height }, estilo]}>
      <AtlasMark size={MARCA_PX} />
    </Animated.View>
  );
}

/**
 * Una copia rezagada de la marca: un fotograma del pasado.
 *
 * El rezago se consigue leyendo el MISMO reloj unos milisegundos antes, no escalando menos. La
 * diferencia importa: una copia mas pequena esta quieta detras; una copia atrasada en el tiempo
 * recorre la misma trayectoria con retraso, que es lo que hace un obturador lento.
 */
function CopiaRezagada({
  indice,
  reloj,
  width,
  height,
}: {
  indice: number;
  reloj: SharedValue<number>;
  width: number;
  height: number;
}) {
  /*
    El indice 0 es la copia MAS atrasada y la mas tenue, y se dibuja la primera: al fondo.

    Iba al reves —la mas rezagada era la mas opaca y quedaba encima— y el efecto no se leia como una
    estela sino como tres logotipos de tamanos distintos superpuestos. Una estela se apaga hacia
    atras; si el fotograma mas viejo es el que mas se ve, lo que se percibe es que la marca va hacia
    atras, no hacia adelante.
  */
  const rezago = (ESTELA - indice) * 46;
  const opacidadBase = 0.14 + indice * 0.06;

  const estilo = useAnimatedStyle(() => {
    const propio = reloj.value - rezago;
    // Solo existe mientras hay velocidad: una estela sobre un objeto quieto es un logotipo borroso.
    const velocidad = tramo(reloj.value, GUION.cubierto, GUION.atravesar[1]);
    return {
      opacity: opacidadBase * velocidad * (1 - suave(tramo(reloj.value, GUION.velo[0] - 160, GUION.velo[1]))),
      transform: [{ scale: escalaEn(Math.max(0, propio)) }],
    };
  });

  return (
    <Animated.View style={[styles.centro, { width, height }, estilo]}>
      <AtlasMark size={MARCA_PX} />
    </Animated.View>
  );
}

/** Una de las dos copias de la dispersion cromatica. Plana y de un solo color: no es un logotipo, es luz mal enfocada. */
function CopiaCromatica({
  reloj,
  width,
  height,
  tinte,
  sentido,
}: {
  reloj: SharedValue<number>;
  width: number;
  height: number;
  tinte: string;
  sentido: 1 | -1;
}) {
  const estilo = useAnimatedStyle(() => {
    const velocidad = acelera(tramo(reloj.value, GUION.cubierto, GUION.atravesar[1]));
    return {
      opacity: 0.5 * velocidad * (1 - suave(tramo(reloj.value, GUION.velo[0] - 120, GUION.velo[1]))),
      transform: [
        { translateX: sentido * velocidad * 26 },
        { translateY: sentido * velocidad * -14 },
        { scale: escalaEn(reloj.value) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.centro, { width, height }, estilo]}>
      <Svg width={MARCA_PX} height={MARCA_PX} viewBox="0 0 48 48">
        <Path d={LETRA} fill={tinte} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  velo: { backgroundColor: color.surface.primary },
  centro: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
