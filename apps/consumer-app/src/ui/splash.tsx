/**
 * El arranque: la secuencia de marca de ATLAS.
 *
 * ## Que problema resuelve
 *
 * El splash nativo es una IMAGEN: no se puede animar, y desaparece de golpe en el fotograma en que
 * la app esta lista. El resultado era un corte seco entre el logotipo quieto y la primera pantalla,
 * y ese corte es lo primero que ve cualquiera al abrir. Una app que arranca con un salto se siente
 * mas lenta de lo que es, aunque tarde exactamente lo mismo.
 *
 * El splash nativo se oculta EN CUANTO hay algo que dibujar, y esta capa toma el relevo con el
 * mismo navy: el cambio no se ve porque no hay cambio. A partir de ahi ocurre una secuencia con
 * principio, golpe y final.
 *
 * ## La coreografia
 *
 * ```
 *    0 ms  ┃ polvo de luz: catorce chispas dispersas por la pantalla giran en espiral hacia el centro
 *  560 ms  ┃ al llegar encienden un núcleo de luz: el punto exacto donde nace la letra
 *  700 ms  ┃ de ahí la «A» SE DIBUJA sola, trazo a trazo
 * 1340 ms  ┃ el relleno de marca aparece por debajo del trazo y el travesaño cierra la letra
 * 1640 ms  ┃ barrido especular: una banda de luz cruza el metal en diagonal
 * 1800 ms  ┃ ▶ IMPACTO — destello, rayos de luz que se abren girando, DOS ondas expansivas · suena el ta-dum
 * 1860 ms  ┃ un punto da una vuelta alrededor de la «A» dejando la órbita dibujada (`ui/orbita-arranque.tsx`)
 * 1960 ms  ┃ A·T·L·A·S aparecen una a una y el tracking se cierra hacia el centro
 * 2600 ms  ┃ el respiro: todo quieto salvo los rayos, que siguen girando despacio
 * 2900 ms  ┃ (si la app está lista) la cámara acelera hacia la marca y la atraviesa
 * ```
 *
 * ## Por qué ya no hay globo (2026-10-08)
 *
 * Pablo: «quitemos la animación del mundo y que sólo quede la de Atlas, ultra HD, que impacte». El globo
 * ocupaba el primer segundo y medio con algo que no era la marca, y en los iPhone viejos era lo más caro
 * de dibujar (cientos de puntos con su propia opacidad por fotograma). Ahora todo el arranque es la
 * marca: la luz se junta, la letra nace de ella y estalla. Es más corto (2,9 s contra 3,56 s) y cada
 * capa nueva se anima con transformaciones y opacidad, que el compositor resuelve sin volver a dibujar.
 *
 * ## Por que el intro NO espera a que la app este lista
 *
 * Al reves que antes. La secuencia arranca en el fotograma en que se monta esta capa y corre
 * entera, pase lo que pase por debajo: si esperara a `listo`, en un arranque frio —que es cuando
 * mas tarda la sesion en restaurarse— la marca se quedaria congelada varios segundos antes de
 * empezar a moverse, y una imagen quieta durante tres segundos se lee como una app colgada.
 *
 * Lo que SI espera a `listo` es la salida. Los dos relojes estan separados justamente por eso: el
 * intro es un tiempo fijo que se puede ensayar, y la salida es un tiempo que depende de la red.
 * Cuando la sesion tarda menos que el intro —el caso normal— no se nota ninguna espera, porque la
 * app termino de cargar mientras se dibujaba la letra.
 *
 * ## Por que se va hacia ADELANTE y no se desvanece
 *
 * La salida escala la marca hasta salirse del encuadre mientras se apaga: la camara se acerca y la
 * atraviesa, que es el mismo lenguaje que el corte de marca de la bienvenida (`ui/brand-cut.tsx`).
 * Un fundido a secas diria «se acabo el logo»; acercandose dice «estas entrando», y las dos
 * transiciones de la app cuentan entonces la misma historia.
 *
 * ## Movimiento reducido
 *
 * No hay secuencia: la capa se retira en cuanto la app esta lista, y **tampoco suena el ta-dum**.
 * Una marca que crece ocupando la pantalla entera es exactamente lo que el ajuste del sistema pide
 * no hacer, y un golpe de sonido sin nada que lo justifique en pantalla es un ruido a secas.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, font, marca as laMarca } from '../theme/tokens';
import { useSonidoMarca } from './brand-sound';
import { acelera, frena, frenaMucho, suave, tramo } from './curvas-arranque';
import { DegradadosLetraA, LETRA_A, LIENZO_SIMBOLO } from './brand';
import { OrbitaDelante, OrbitaDetras } from './orbita-arranque';
import { AtlasText } from './primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * El guion, en milisegundos desde que se monta la capa.
 *
 * Todo el resto del fichero lee de aqui. Tener los tiempos sueltos por el codigo —que es como
 * estaba— obliga a recorrer seis funciones para responder «¿cuando entra el rotulo?», y basta con
 * tocar uno para que dos tramos se solapen sin que nadie lo note hasta verlo en el telefono.
 */
const GUION = {
  /** El polvo de luz que converge al centro, y el núcleo que enciende al llegar. */
  polvo: [0, 760],
  nucleo: [560, 1000],
  trazo: [700, 1340],
  relleno: [1300, 1640],
  barrido: [1640, 2300],
  impacto: 1800,
  onda: [1800, 2460],
  /** La segunda onda sale un poco después y más ancha: el eco del golpe. */
  eco: [1940, 2760],
  /** Los rayos se abren con el impacto y quedan girando, tenues, hasta la salida. */
  rayos: [1780, 2300],
  rotulo: [1960, 2600],
  /** El punto da una vuelta alrededor de la letra mientras se forma el rotulo, y se para. */
  orbita: [1860, 2680],
  respiro: [2600, 2900],
} as const;

/** Lo que dura el intro completo. La salida se encadena DESPUES, y solo si la app esta lista. */
const INTRO = 2900;
const SALIDA = 640;

/**
 * Las chispas del polvo de luz: ángulo y distancia de partida, tamaño y retardo. Con semilla fija,
 * como el grano: dos arranques son el mismo plano.
 */
const CHISPAS = (() => {
  let semilla = 20261008;
  const siguiente = () => {
    semilla = (semilla * 1664525 + 1013904223) % 4294967296;
    return semilla / 4294967296;
  };
  return Array.from({ length: 14 }, (_, i) => ({
    angulo: (i / 14) * Math.PI * 2 + siguiente() * 0.5,
    distancia: 150 + siguiente() * 190,
    tamano: 3 + siguiente() * 5,
    retardo: siguiente() * 220,
    giro: 0.9 + siguiente() * 0.8,
  }));
})();

/** Los rayos de luz del impacto: haces finos alrededor del centro, en un lienzo de 100×100. */
const RAYOS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const ancho = i % 2 === 0 ? 0.075 : 0.045;
  const largo = i % 2 === 0 ? 50 : 38;
  const punto = (ang: number, r: number) => `${(50 + Math.cos(ang) * r).toFixed(2)} ${(50 + Math.sin(ang) * r).toFixed(2)}`;
  return `M50 50 L${punto(a - ancho, largo)} L${punto(a + ancho, largo)} Z`;
});

/**
 * Longitud del contorno de la «A», en unidades del `viewBox`.
 *
 * Es lo que hace posible dibujarla trazo a trazo: `strokeDasharray` pinta un guion tan largo como
 * la letra entera y `strokeDashoffset` lo va corriendo. Un valor corto deja la letra a medias; uno
 * largo hace que el dibujo empiece tarde y termine de golpe. 152 es el perimetro real medido sobre
 * los seis vertices del trazado, redondeado hacia arriba.
 */
const CONTORNO = laMarca.simbolo.contorno;

/** El trazado de la marca, el mismo que dibuja `ui/brand.tsx`: aqui se dibuja por partes. */
const LETRA = LETRA_A.silueta;

const MARCA_PX = 132;
/** El lienzo del impacto: onda expansiva y resplandor. Mas grande que la marca, para que quepa lo que sale de ella. */
const ESCENA_PX = 360;
/** El lienzo de los rayos: más que la escena, para que los haces salgan de la marca y se pierdan. */
const RAYOS_PX = 520;

/*
 * Sin grano de película (2026-10-08): eran 120 círculos SVG dibujados en el arranque, justo cuando el teléfono está más
 * ocupado, y en los iPhone viejos se notaba como tirones. La viñeta ya da profundidad al fondo.
 */

/** Las letras del rotulo: el nombre de la marca, en mayusculas. */
const LETRAS = laMarca.nombre.toUpperCase().split('');

/**
 * La capa de arranque. Se dibuja sobre todo lo demas y se retira sola.
 *
 * `onDone` avisa cuando ya no queda nada que ver, para que el arbol la desmonte: una vista a
 * pantalla completa con `pointerEvents: none` no molesta, pero seguir montada obliga a componerla
 * en cada fotograma de la app durante el resto de la sesion.
 */
export function AnimatedSplash({ listo, onDone }: { listo: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const sonido = useSonidoMarca();

  /** El reloj del intro, en milisegundos. Todas las capas leen de el. */
  const reloj = useSharedValue(0);
  /** La salida: 0 = la marca esta donde estaba, 1 = la camara ya la atraveso. */
  const salida = useSharedValue(0);
  /** El disparo del sonido. Es un reloj propio para que el ta-dum no dependa de que el intro termine. */
  const golpe = useSharedValue(0);

  const [introTerminado, setIntroTerminado] = React.useState(false);

  const terminar = React.useRef(onDone);
  terminar.current = onDone;
  // Estable: el callback que cruza al hilo de JS no puede cambiar de identidad en cada render, o el
  // efecto que lo usa se relanza y con el la animacion entera.
  const avisar = React.useCallback(() => terminar.current(), []);
  const marcarIntro = React.useCallback(() => setIntroTerminado(true), []);
  const tocarMarca = React.useCallback(() => sonido.marca(), [sonido]);

  /*
    El intro arranca al montar, una sola vez, y no depende de nada.

    `lanzado` existe porque el efecto se re-ejecutaba en cada render del arbol y `withTiming`
    volvia a empezar desde cero. El sintoma no se parecia a la causa: la marca se quedaba en
    pantalla indefinidamente, como si la app no arrancara, cuando lo que pasaba es que la animacion
    no llegaba nunca al final porque alguien la reiniciaba.
  */
  const lanzado = React.useRef(false);
  React.useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    if (reduced) {
      setIntroTerminado(true);
      return;
    }
    // Lineal a proposito: es un RELOJ, no un movimiento. Curvar el reloj curvaria a la vez las
    // ocho capas que leen de el, y la coreografia dejaria de caer donde dice el guion.
    reloj.value = withTiming(INTRO, { duration: INTRO, easing: Easing.linear }, (completo) => {
      if (completo) runOnJS(marcarIntro)();
    });
    /*
      El sonido va enganchado al MISMO reloj que la imagen, no a un `setTimeout`.

      Durante el arranque el hilo de JS esta restaurando la sesion, leyendo el almacen seguro y
      montando el arbol: un temporizador de JS ahi llega tarde y con retraso variable. El golpe
      sonoro separado del visual por cien milisegundos ya no se percibe como un golpe, sino como
      dos cosas.
    */
    golpe.value = withTiming(1, { duration: GUION.impacto, easing: Easing.linear }, (completo) => {
      if (completo) runOnJS(tocarMarca)();
    });
  }, [reduced, reloj, golpe, marcarIntro, tocarMarca]);

  /* La salida: cuando el intro termino Y la app esta lista. Las dos condiciones, en cualquier orden. */
  const saliendo = React.useRef(false);
  React.useEffect(() => {
    if (!introTerminado || !listo || saliendo.current) return;
    saliendo.current = true;
    if (reduced) {
      terminar.current();
      return;
    }
    salida.value = withTiming(1, { duration: SALIDA, easing: Easing.in(Easing.cubic) }, (completo) => {
      if (completo) runOnJS(avisar)();
    });
  }, [introTerminado, listo, reduced, salida, avisar]);

  /*
    Red de seguridad: pase lo que pase, esta capa se retira.

    Si la sesion no termina de restaurarse —el servidor no responde, el token esta corrupto— `listo`
    no llega nunca y la persona se queda mirando un logotipo sin saber que hacer. Un arranque
    bloqueado es el peor fallo posible de una app de dinero, porque no se distingue de que la app
    este rota. A los ocho segundos se descubre la interfaz: si debajo hay un error, al menos se lee.

    Ocho y no seis: el intro solo ya ocupa 2,9 s, y el margen tiene que seguir siendo para la RED,
    no para la animacion.
  */
  React.useEffect(() => {
    const alarma = setTimeout(() => {
      if (!saliendo.current) {
        saliendo.current = true;
        terminar.current();
      }
    }, 8000);
    return () => clearTimeout(alarma);
  }, []);

  /* ---- Las capas ---- */

  const capa = useAnimatedStyle(() => ({
    // La capa entera se apaga en el ULTIMO tercio de la salida. Antes no: mientras la marca crece,
    // lo que hay debajo todavia no debe verse o se ven dos pantallas superpuestas.
    opacity: 1 - frena(tramo(salida.value, 0.55, 1)),
  }));

  /** El resplandor de fondo. Nace tenue, se abre de golpe en el impacto y se queda respirando. */
  const resplandor = useAnimatedStyle(() => {
    const previo = suave(tramo(reloj.value, GUION.trazo[0], GUION.impacto)) * 0.45;
    const estallido = frenaMucho(tramo(reloj.value, GUION.impacto, GUION.impacto + 420));
    const escala = 0.55 + previo * 0.35 + estallido * 0.55 + salida.value * 1.6;
    return {
      // Acotado a 1: los dos sumandos pueden pasarse juntos, y una opacidad mayor que uno no es
      // «mas brillante», es un valor que cada plataforma decide recortar a su manera.
      opacity: Math.min(1, previo + estallido * 0.75) * (1 - acelera(tramo(salida.value, 0.3, 1))),
      transform: [{ scale: escala }],
    };
  });


  /*
   * Sin barras cinematográficas (Pablo, 2026-10-08: «que no se corte abajo en negro»). Eran dos franjas negras del 11 %
   * arriba y abajo; en un iPhone con la barra de inicio se leían como la pantalla recortada. El encuadre lo da la viñeta,
   * y la escena ocupa la pantalla entera desde el primer fotograma hasta que se atraviesa.
   */

  /**
   * El escenario: la camara.
   *
   * Un empuje LENTISIMO durante todo el intro —de 1.0 a 1.03— que la persona no ve pero si nota:
   * es lo que separa un plano fijo de un plano vivo. Y luego la aceleracion de la salida, que es la
   * misma idea llevada al extremo.
   */
  const escenario = useAnimatedStyle(() => {
    const deriva = suave(tramo(reloj.value, 0, INTRO)) * 0.03;
    const empuje = acelera(salida.value) * 0.55;
    return { transform: [{ scale: 1 + deriva + empuje }] };
  });

  /** La marca: entra con un empuje corto y sale atravesando la camara. */
  const marca = useAnimatedStyle(() => {
    const asentar = frena(tramo(reloj.value, GUION.trazo[0], GUION.relleno[1]));
    const golpeVisual = frenaMucho(tramo(reloj.value, GUION.impacto, GUION.impacto + 220)) * 0.06;
    const retroceso = frena(tramo(reloj.value, GUION.impacto + 220, GUION.impacto + 560)) * 0.06;
    const atravesar = acelera(salida.value) * 7.2;
    return {
      opacity: 1 - acelera(tramo(salida.value, 0.4, 1)),
      transform: [{ scale: 0.92 + asentar * 0.08 + golpeVisual - retroceso + atravesar }],
    };
  });

  /**
   * El trazo que se dibuja.
   *
   * `strokeDashoffset` va de la longitud entera —nada dibujado— a cero. La curva frena al final
   * para que la punta llegue al vertice de arriba desacelerando, que es como se termina un trazo
   * hecho a mano y no como se termina uno hecho por una maquina.
   */
  const trazoProps = useAnimatedProps(() => ({
    strokeDashoffset: CONTORNO * (1 - frena(tramo(reloj.value, GUION.trazo[0], GUION.trazo[1]))),
    // El contorno se apaga cuando el relleno ya esta: dejarlo encendido engorda la letra.
    opacity: 1 - suave(tramo(reloj.value, GUION.relleno[0], GUION.relleno[1] + 120)),
  }));

  const rellenoProps = useAnimatedProps(() => ({
    opacity: suave(tramo(reloj.value, GUION.relleno[0], GUION.relleno[1])),
  }));

  const travesanoProps = useAnimatedProps(() => ({
    // El travesano cierra la letra DESPUES del relleno. Es el ultimo trazo que da un rotulista.
    opacity: suave(tramo(reloj.value, GUION.relleno[1] - 80, GUION.relleno[1] + 220)),
  }));

  /**
   * El barrido especular: una banda de luz que cruza la letra en diagonal.
   *
   * Es lo que convierte el degradado plano en una superficie. Va recortada a la forma de la «A»
   * (`clipPath`), asi que la luz solo existe SOBRE el metal: una banda que se saliera de la letra
   * seria un reflejo en el aire, y se lee como un error de composicion.
   */
  const barridoProps = useAnimatedProps(() => ({
    x: -70 + frena(tramo(reloj.value, GUION.barrido[0], GUION.barrido[1])) * 140,
    opacity: 0.9 * Math.sin(Math.PI * tramo(reloj.value, GUION.barrido[0], GUION.barrido[1])),
  }));

  /**
   * La onda expansiva del impacto.
   *
   * Crece rapido y se apaga rapido: una onda que se demora se lee como un circulo que se hace
   * grande. El grosor tambien adelgaza mientras crece, que es lo que hace la energia al repartirse
   * sobre una circunferencia mas larga.
   */
  const ondaProps = useAnimatedProps(() => {
    const avance = frenaMucho(tramo(reloj.value, GUION.onda[0], GUION.onda[1]));
    /*
      La compuerta `nacida` es lo que impide que la onda exista ANTES del impacto.

      Sin ella, `1 - avance` vale uno desde el milisegundo cero: durante el segundo y medio que
      tarda la letra en dibujarse habia un anillo de radio 14 encendido en el centro de la pantalla,
      justo detras de la marca. Se veia en la grabacion del simulador como un circulito suelto en el
      primer fotograma del arranque. Que la opacidad estatica valga cero no arregla esto —lo que se
      pinta a partir del segundo fotograma es este calculo, no la prop estatica—.
    */
    const nacida = tramo(reloj.value, GUION.onda[0] - 30, GUION.onda[0]);
    return {
      r: 14 + avance * 120,
      strokeWidth: Math.max(0.4, 3.4 * (1 - avance)),
      opacity: 0.75 * (1 - avance) * nacida,
    };
  });

  /** El destello: blanco, dos fotogramas, y fuera. Es el golpe. */
  const destello = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - tramo(reloj.value, GUION.impacto, GUION.impacto + 150)) * tramo(reloj.value, GUION.impacto - 40, GUION.impacto),
  }));

  /** El eco: una segunda onda más ancha y más lenta, que hace que el golpe «suene» en la imagen. */
  const ecoProps = useAnimatedProps(() => {
    const avance = frena(tramo(reloj.value, GUION.eco[0], GUION.eco[1]));
    const nacida = tramo(reloj.value, GUION.eco[0] - 30, GUION.eco[0]);
    return {
      r: 20 + avance * 135,
      strokeWidth: Math.max(0.3, 1.6 * (1 - avance)),
      opacity: 0.5 * (1 - avance) * nacida,
    };
  });

  /**
   * Los rayos de luz. Se abren con el impacto —escala de 0,3 a 1 con un muelle corto— y se quedan
   * girando despacio y tenues mientras se forma el rótulo: el fondo sigue vivo en el respiro sin que
   * nada compita con la letra. Un solo dibujo que gira: el compositor lo mueve sin redibujar.
   */
  const rayos = useAnimatedStyle(() => {
    const abre = frenaMucho(tramo(reloj.value, GUION.rayos[0], GUION.rayos[1]));
    const pico = Math.sin(Math.PI * tramo(reloj.value, GUION.rayos[0], GUION.rayos[0] + 520));
    const visible = Math.max(abre * 0.32, pico * 0.85);
    return {
      opacity: visible * (1 - acelera(tramo(salida.value, 0, 0.7))),
      transform: [{ rotate: `${reloj.value * 0.012 + salida.value * 40}deg` }, { scale: 0.3 + abre * 0.7 + salida.value * 1.2 }],
    };
  });

  /** El núcleo: la luz que juntan las chispas y de la que nace el trazo. Se apaga cuando hay letra. */
  const nucleo = useAnimatedStyle(() => {
    const enciende = frenaMucho(tramo(reloj.value, GUION.nucleo[0], GUION.nucleo[0] + 200));
    const apaga = suave(tramo(reloj.value, GUION.nucleo[0] + 200, GUION.nucleo[1]));
    return {
      opacity: enciende * (1 - apaga * 0.85) * (1 - tramo(reloj.value, GUION.relleno[0], GUION.relleno[1])),
      transform: [{ scale: 0.4 + enciende * 0.9 - apaga * 0.3 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.capa, capa]}>
      <Animated.View style={[styles.centrado, resplandor]}>
        <Svg width={ESCENA_PX * 2.4} height={ESCENA_PX * 2.4} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="arranque-resplandor" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.stage.brand.b400} stopOpacity={0.55 * color.stage.glow} />
              <Stop offset="0.4" stopColor={color.stage.brand.b500} stopOpacity={0.18 * color.stage.glow} />
              <Stop offset="1" stopColor={color.stage.brand.b500} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#arranque-resplandor)" />
        </Svg>
      </Animated.View>

      {/* La vineta: oscurece las esquinas para que el ojo caiga al centro. Es fija; no se anima. */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="arranque-vineta" cx="50%" cy="50%" r="72%">
              <Stop offset="0.35" stopColor={color.stage.vignette} stopOpacity="0" />
              <Stop offset="1" stopColor={color.stage.vignette} stopOpacity="0.55" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#arranque-vineta)" />
        </Svg>
      </View>


      <Animated.View style={[StyleSheet.absoluteFill, styles.centro, escenario]}>
        <View style={styles.escena}>
          <Svg width={ESCENA_PX} height={ESCENA_PX} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
            <AnimatedCircle
              cx={150}
              cy={150}
              r={0}
              opacity={0}
              fill="none"
              stroke={color.stage.brand.b400}
              animatedProps={ecoProps}
            />
            {/*
              `r` y `opacity` en cero de partida, aunque `ondaProps` los sobreescriba.

              Reanimated aplica las props animadas DESPUES del primer dibujado, asi que lo que se
              pinta en ese fotograma son los valores estaticos. Sin estos dos, el primer fotograma
              del arranque era un anillo suelto de radio por defecto en mitad de una pantalla vacia
              —visible en la grabacion del simulador— un octavo de segundo antes de que la marca
              empezara siquiera a dibujarse. Vale para las cinco formas animadas de aqui.
            */}
            <AnimatedCircle
              cx={150}
              cy={150}
              r={0}
              opacity={0}
              fill="none"
              stroke={color.stage.brand.b300}
              animatedProps={ondaProps}
            />
          </Svg>

          <View style={styles.marcaCaja}>
            {/* Los rayos, centrados en la letra y detrás de todo lo demás de la marca. */}
            <Animated.View pointerEvents="none" style={[styles.rayos, rayos]}>
              <Svg width={RAYOS_PX} height={RAYOS_PX} viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id="arranque-rayo" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={color.stage.glint} stopOpacity="0.9" />
                    <Stop offset="0.25" stopColor={color.stage.brand.b300} stopOpacity="0.55" />
                    <Stop offset="1" stopColor={color.stage.brand.b400} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                {RAYOS.map((d, i) => (
                  <Path key={i} d={d} fill="url(#arranque-rayo)" />
                ))}
              </Svg>
            </Animated.View>
            {/* El polvo de luz converge al centro de la letra y enciende el núcleo del que nace el trazo. */}
            {CHISPAS.map((chispa, indice) => (
              <Chispa key={indice} chispa={chispa} reloj={reloj} />
            ))}
            <Animated.View pointerEvents="none" style={[styles.nucleo, nucleo]} />
            <Animated.View style={marca}>
              <OrbitaDetras reloj={reloj} guion={GUION.orbita} tamano={MARCA_PX} />
              <Svg width={MARCA_PX} height={MARCA_PX} viewBox={LIENZO_SIMBOLO} accessibilityLabel={`Logotipo de ${laMarca.nombre}`}>
                <Defs>
                  <DegradadosLetraA prefijo="arranque-marca" />
                  {/* La sombra en el suelo: sin ella la letra flota; con ella, esta apoyada en algo. */}
                  <RadialGradient id="arranque-suelo" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={color.stage.brand.b400} stopOpacity={0.45 * color.stage.glow} />
                    <Stop offset="1" stopColor={color.stage.brand.b400} stopOpacity="0" />
                  </RadialGradient>
                  <LinearGradient id="arranque-brillo" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={color.stage.glint} stopOpacity="0" />
                    <Stop offset="0.5" stopColor={color.stage.glint} stopOpacity="0.85" />
                    <Stop offset="1" stopColor={color.stage.glint} stopOpacity="0" />
                  </LinearGradient>
                  <ClipPath id="arranque-recorte">
                    <Path d={LETRA} />
                  </ClipPath>
                </Defs>

                <AnimatedPath
                  d={LETRA}
                  fill="none"
                  stroke={color.stage.brand.b300}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={CONTORNO}
                  strokeDashoffset={CONTORNO}
                  animatedProps={trazoProps}
                />
                {/* Las dos caras de la letra: la luz a la izquierda, la sombra a la derecha (ver `LETRA_A`). */}
                <AnimatedG opacity={0} animatedProps={rellenoProps}>
                  <Ellipse cx={24} cy={44.5} rx={21} ry={2.2} fill="url(#arranque-suelo)" />
                  <Path d={LETRA_A.caraLuz} fill="url(#arranque-marca-luz)" />
                  <Path d={LETRA_A.caraSombra} fill="url(#arranque-marca-sombra)" />
                  <Path
                    d={LETRA_A.filo}
                    stroke={color.stage.glint}
                    strokeWidth={0.35}
                    strokeLinecap="round"
                    opacity={0.55}
                  />
                </AnimatedG>
                <AnimatedG opacity={0} animatedProps={travesanoProps}>
                  <Path d={LETRA_A.travesano} fill="url(#arranque-marca-travesano)" />
                  <Path d={LETRA_A.cantoTravesano} stroke={color.stage.brand.b300} strokeWidth={0.35} opacity={0.8} />
                </AnimatedG>

                <G clipPath="url(#arranque-recorte)">
                  {/*
                    Inclinada 18 grados: una banda vertical se lee como una persiana. La diagonal es
                    la que parece luz rebotando en una superficie que no esta perfectamente de frente.
                  */}
                  <AnimatedRect
                    y={-30}
                    x={-70}
                    opacity={0}
                    width={16}
                    height={110}
                    fill="url(#arranque-brillo)"
                    transform="rotate(18 24 24)"
                    animatedProps={barridoProps}
                  />
                </G>
              </Svg>
              <OrbitaDelante reloj={reloj} guion={GUION.orbita} tamano={MARCA_PX} />
            </Animated.View>
          </View>

          <View style={styles.rotulo}>
            {LETRAS.map((letra, indice) => (
              <LetraDelRotulo key={`${letra}-${indice}`} letra={letra} indice={indice} reloj={reloj} salida={salida} />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.destello, destello]} />

    </Animated.View>
  );
}

/**
 * Una chispa del polvo de luz. Parte de lejos, gira en espiral hacia el centro acelerando —como algo que
 * cae en un remolino— y se apaga justo al llegar, cuando se enciende el núcleo. Una vista con
 * `translate`/`scale`/`opacity`: catorce de éstas cuestan menos que un solo trazo SVG animado.
 */
function Chispa({ chispa, reloj }: { chispa: (typeof CHISPAS)[number]; reloj: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => {
    const [desde, hasta] = GUION.polvo;
    const t = tramo(reloj.value, desde + chispa.retardo, hasta);
    const cae = acelera(t);
    const radio = chispa.distancia * (1 - cae);
    const angulo = chispa.angulo + cae * chispa.giro * Math.PI;
    const enciende = suave(Math.min(1, t * 4));
    const apaga = tramo(t, 0.82, 1);
    return {
      opacity: enciende * (1 - apaga),
      transform: [
        { translateX: Math.cos(angulo) * radio },
        { translateY: Math.sin(angulo) * radio },
        { scale: 0.6 + (1 - cae) * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.chispa, { width: chispa.tamano, height: chispa.tamano, borderRadius: chispa.tamano / 2 }, estilo]}
    />
  );
}

/**
 * Una letra del rotulo.
 *
 * ## Por que cada letra es su propio componente
 *
 * Porque cada una tiene su propio tiempo y su propio recorrido, y eso son cinco estilos animados.
 * Calcularlos en el padre significaria cinco `useAnimatedStyle` escritos a mano —o un array de
 * hooks, que React no permite—. Aqui el escalonado sale del indice y no hay nada que repetir.
 *
 * ## El tracking que se cierra
 *
 * Las letras nacen separadas y se juntan hacia el centro. Es el gesto tipografico de los titulos de
 * credito: el ojo lee primero las letras sueltas —que todavia no son una palabra— y ve como se
 * convierten en una. Se hace con `translateX` por letra y no animando `letterSpacing` porque el
 * espaciado de texto se resuelve en el motor de maquetado: animarlo obliga a remaquetar el rotulo
 * entero en cada fotograma, y en Android eso se ve.
 */
function LetraDelRotulo({
  letra,
  indice,
  reloj,
  salida,
}: {
  letra: string;
  indice: number;
  reloj: SharedValue<number>;
  salida: SharedValue<number>;
}) {
  /** Distancia al centro del rotulo, en «letras». Con cinco letras: -2, -1, 0, 1, 2. */
  const desdeCentro = indice - (LETRAS.length - 1) / 2;

  const estilo = useAnimatedStyle(() => {
    const [desde, hasta] = GUION.rotulo;
    // Cada letra arranca 70 ms despues de la anterior y todas terminan de recorrer lo mismo.
    const inicio = desde + indice * 70;
    const avance = frena(tramo(reloj.value, inicio, hasta));
    // El tracking se cierra mas despacio que la aparicion: la palabra termina de formarse despues
    // de que la ultima letra ya se lee.
    const apertura = 1 - frenaMucho(tramo(reloj.value, desde, hasta + 180));
    return {
      opacity: avance * (1 - acelera(tramo(salida.value, 0.25, 0.85))),
      transform: [
        { translateX: desdeCentro * apertura * 16 + desdeCentro * acelera(salida.value) * 190 },
        { translateY: (1 - avance) * 10 },
        { scale: 0.94 + avance * 0.06 + acelera(salida.value) * 0.9 },
      ],
    };
  });

  return (
    <Animated.View style={estilo}>
      <AtlasText variant="hero" style={styles.letra}>
        {letra}
      </AtlasText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // El mismo navy que el splash nativo (`app.json`): si no coinciden, el relevo se ve como un parpadeo de fondo.
  // Es el ESCENARIO de marca, oscuro en los dos temas; al terminar se desvanece sobre la app.
  capa: { backgroundColor: color.stage.bg, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', justifyContent: 'center' },
  centrado: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  escena: { width: ESCENA_PX, height: ESCENA_PX, alignItems: 'center', justifyContent: 'center', gap: 22 },
  marcaCaja: { width: MARCA_PX, height: MARCA_PX, alignItems: 'center', justifyContent: 'center' },
  rotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // El interletrado base del rotulo ya formado. El resto del recorrido lo pone `translateX`.
  letra: { letterSpacing: 6, textAlign: 'center', color: color.stage.ink, fontFamily: font.brand, fontWeight: undefined },
  destello: { backgroundColor: color.stage.flash },
  rayos: {
    position: 'absolute',
    width: RAYOS_PX,
    height: RAYOS_PX,
    top: (MARCA_PX - RAYOS_PX) / 2,
    left: (MARCA_PX - RAYOS_PX) / 2,
  },
  nucleo: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: color.stage.brand.b300,
    shadowColor: color.stage.brand.b400,
    shadowOpacity: color.stage.glow,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  chispa: {
    position: 'absolute',
    backgroundColor: color.stage.brand.b300,
    shadowColor: color.stage.brand.b400,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
});
