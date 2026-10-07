/**
 * Tokens de diseno de ATLAS.
 *
 * La fuente de verdad visual es la identidad ya publicada en `AtlasLandingPage`
 * (`assets/css/style.css`): navy profundo, degradado teal -> menta, tipografia Sora/Manrope y
 * radios generosos. Aqui se portan como TOKENS, no como CSS: React Native no consume clases, y
 * duplicar hojas de estilo entre web y movil es justo lo que hace divergir a los dos productos.
 *
 * Regla: ningun componente escribe un color literal. Si un color no esta aqui, no existe.
 */

import { StyleSheet } from 'react-native';

/** Paleta cruda de marca. No usar directamente en pantallas: usar los tokens semanticos. */
export const palette = {
  navy: '#0C2C50',
  brand900: '#052033',
  brand700: '#0E7377',
  brand500: '#14A894',
  brand400: '#2BE0A8',
  brand300: '#5CF0CC',
  tint: '#7FEFD6',

  bg: '#061426',
  bgElevated: '#0A1C33',
  bgSheet: '#0B2138',
  /**
   * Superficie de tarjeta. OPACA, no un velo blanco.
   *
   * Antes las tarjetas eran `rgba(255,255,255,0.04)` sobre el fondo: a esa alfa, sobre un navy tan
   * profundo, la tarjeta no llega a separarse del papel y la pantalla entera se lee como un solo
   * plano con texto suelto encima. Una superficie propia —tres pasos por encima del fondo— es lo
   * que convierte una lista de textos en objetos que se pueden tocar.
   */
  bgCard: '#0B1E36',
  /** Filo superior iluminado de una superficie elevada: la luz cae desde arriba, y se nota. */
  edgeLit: 'rgba(255,255,255,0.10)',

  ink04: 'rgba(255,255,255,0.04)',
  ink07: 'rgba(255,255,255,0.07)',
  /** Lavado sobre una superficie que ya es de color, donde 0.07 se pierde. Hoy: el banner de partner. */
  ink10: 'rgba(255,255,255,0.10)',
  line: 'rgba(255,255,255,0.09)',
  line2: 'rgba(255,255,255,0.16)',

  text1: '#EDF3F9',
  text2: '#94A8BF',
  /**
   * El tercer nivel de texto, SUBIDO hasta pasar AA.
   *
   * Estaba en `#5F7591`: 3,9:1 sobre el fondo y 3,5:1 sobre una tarjeta, por debajo del 4,5:1 que
   * pide WCAG para texto normal. Y no lo llevaba texto decorativo: lo llevan las leyendas —la
   * explicacion que hay bajo cada campo, la nota legal del registro, la etiqueta de un boton
   * apagado—, o sea justo el texto que alguien lee cuando algo no le encaja. «Gris claro que se ve
   * elegante y no llega a contraste» es una de las marcas de fabrica de una interfaz sin terminar.
   *
   * `#7489A6` mide 5,2:1 sobre el fondo y 4,7:1 sobre la tarjeta, y sigue claramente por debajo de
   * `text2` (7,6:1): la jerarquia de tres niveles se conserva entera.
   */
  text3: '#7489A6',

  danger: '#FF8A8A',
  dangerDeep: '#B23A3A',
  warning: '#FFC46B',
  success: '#2BE0A8',
  info: '#7FEFD6',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/**
 * Tokens semanticos: lo que las pantallas consumen.
 *
 * El nombre describe el ROL, no el color. Cambiar la marca o anadir tema claro se hace aqui y en
 * ningun otro sitio.
 */
export const color = {
  surface: {
    primary: palette.bg,
    secondary: palette.bgElevated,
    /** Tarjetas y cualquier cosa que deba leerse POR ENCIMA del fondo. Ver `palette.bgCard`. */
    raised: palette.bgCard,
    raisedStrong: palette.ink07,
    sheet: palette.bgSheet,
    inverse: palette.white,
    /** Filo superior de una superficie elevada. */
    edge: palette.edgeLit,
    /**
     * Superficie HUNDIDA: campos de texto, opciones, cajas de importe.
     *
     * Un campo es un hueco donde se escribe, no un pedestal. Cuando comparte color con la tarjeta
     * que lo contiene deja de leerse como una zona editable y la pantalla se vuelve una lista de
     * etiquetas con rectangulos al lado. Mas oscuro que la tarjeta, el hueco se ve hueco.
     */
    sunken: palette.bg,
  },
  text: {
    primary: palette.text1,
    secondary: palette.text2,
    tertiary: palette.text3,
    onBrand: palette.brand900,
    onInverse: palette.brand900,
    /**
     * Texto de ejemplo dentro de un campo vacio.
     *
     * Mas apagado que `tertiary` a proposito. Cuando el ejemplo tiene la forma exacta del valor
     * —`1996-04-12` en una fecha, `2031-03-10` en un vencimiento— y comparte color con el resto de
     * los textos secundarios, el campo se lee como relleno. Eso dejaba el boton principal apagado
     * con la pantalla aparentemente completa, sin nada que indicara donde estaba el hueco.
     *
     * El contraste sigue por encima del minimo de texto no esencial: un ejemplo tiene que poder
     * leerse, solo que no tiene que competir con un dato.
     */
    placeholder: '#41546E',
  },
  border: {
    subtle: palette.line,
    strong: palette.line2,
    focus: palette.brand400,
    /**
     * El color de una linea de UN PIXEL FISICO. Ver `stroke.hairline`.
     *
     * Va mas subido que `subtle` porque cubre la tercera parte de superficie: en un telefono a 3x,
     * `subtle` a un pixel fisico se queda por debajo del umbral en el que el ojo distingue una
     * linea de un cambio de tono, y el separador desaparece. Mismo peso percibido, un tercio de
     * grosor: eso es lo que se lee como «nitido» y no como «fino».
     */
    hairline: 'rgba(255,255,255,0.20)',
    /**
     * El contorno de un control donde se ESCRIBE o se elige: campos, casillas del PIN, opciones.
     *
     * Existe porque todos ellos usaban `subtle` —el mismo blanco al 9 % que separa dos filas de una
     * lista— y ahi la medida no da: 1,3:1 contra la tarjeta que los contiene, cuando WCAG 2.2 pide
     * 3:1 para lo que identifica un control (1.4.11). No es un tecnicismo: era la razon de que un
     * formulario de esta app se leyera como texto flotando sobre un fondo oscuro, con las cuatro
     * casillas del PIN practicamente invisibles dentro de su tarjeta.
     *
     * Al 34 % mide 3,2:1 sobre una tarjeta y 3,1:1 sobre el fondo, que son los dos sitios donde se
     * pintan. Un separador NO debe usar esto: una lista con contornos al 34 % seria una reja.
     */
    field: 'rgba(255,255,255,0.34)',
  },
  action: {
    primary: palette.brand400,
    primaryPressed: palette.brand500,
    secondary: palette.ink07,
    destructive: palette.danger,
    disabled: 'rgba(255,255,255,0.10)',
  },
  feedback: {
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    info: palette.info,
  },
  /** Fondos tenues para chips/estados. Mantienen contraste AA sobre `surface.primary`. */
  feedbackSoft: {
    success: 'rgba(43,224,168,0.14)',
    warning: 'rgba(255,196,107,0.14)',
    danger: 'rgba(255,138,138,0.14)',
    info: 'rgba(127,239,214,0.12)',
    neutral: 'rgba(255,255,255,0.07)',
  },
  /**
   * Velo para superponer contenido sobre la pantalla.
   *
   * A 0.72 el fondo sigue reconociendose —el usuario no pierde el contexto de donde estaba— pero ya
   * no compite con lo que se le esta senalando. Por debajo de 0.6 el texto de la tarjeta se lee peor
   * segun lo que quede debajo, que es una lectura distinta en cada pantalla.
   */
  overlay: { scrim: 'rgba(3,10,20,0.72)' },
  /**
   * El PAPEL desvaneciendose. Del fondo de pantalla opaco al mismo fondo con opacidad cero.
   *
   * Es lo que se pone donde el contenido pasa por debajo de algo: la barra de estado arriba, la
   * accion fija abajo. Sin el, un parrafo que se desplaza se mete DEBAJO del reloj y de la isla
   * dinamica y las dos cosas se leen a la vez, superpuestas; y el pie corta la frase que tiene
   * encima por la mitad, con un filo duro que parece un fallo de dibujo.
   *
   * El color de destino se escribe con alfa cero SOBRE EL MISMO NAVY y no como `transparent`:
   * `transparent` es negro con alfa cero, asi que el degradado pasa por grises sucios antes de
   * desaparecer y el desvanecido se ve como una mancha oscura en vez de como nada.
   */
  paperFade: { from: palette.bg, to: 'rgba(6,20,38,0)' },
  brandGradient: [palette.brand500, palette.brand400, palette.brand300] as const,
  /**
   * Lavado de marca para superficies grandes.
   *
   * Es el degradado de la identidad rebajado a un tinte: destaca la superficie sin obligar a
   * cambiar el color del texto que va encima, que es lo que pasa con el degradado pleno.
   */
  brandWash: { from: 'rgba(20,168,148,0.16)', to: 'rgba(43,224,168,0.06)' },
  /**
   * Contornos de los avisos. Es el mismo color del estado a un tercio de opacidad: el borde
   * delimita sin competir con el texto que encierra.
   */
  feedbackBorder: {
    warning: 'rgba(255,196,107,0.35)',
    danger: 'rgba(255,138,138,0.35)',
    success: 'rgba(43,224,168,0.32)',
    /** Para la tarjeta que la pantalla quiere destacar sin gastarse el degradado de marca. */
    brand: 'rgba(43,224,168,0.28)',
  },
} as const;

/** Escala de espaciado en multiplos de 4. Evita el "casi alineado". */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

/**
 * Radios.
 *
 * ## La regla concentrica
 *
 * Un radio interior tiene que ser el exterior MENOS el relleno que los separa, o las dos curvas no
 * son paralelas y la esquina se ve torcida aunque nadie sepa por que. De ahi que la escala baje de
 * cuatro en cuatro: una tarjeta a `xxl` con `space.sm` de relleno pide `xl` dentro, y con
 * `space.md`, `lg`.
 *
 * ## Por que el radio de tarjeta bajo de 28 a 24
 *
 * A 28 px sobre una tarjeta del ancho de la pantalla la curva se come casi un tercio de la altura
 * de la cabecera de la tarjeta: el bloque deja de leerse como una superficie y empieza a leerse
 * como una pastilla. Es la diferencia entre una app de banca y una app de mensajeria. 24 mantiene
 * la generosidad de la identidad —el landing usa 22 px en sus paneles— sin redondear el contenido.
 */
export const radius = {
  /** Adornos pequenos: el punto de un estado, la marca de un paso. */
  xs: 6,
  sm: 8,
  md: 12,
  /** Campos, chips de icono y cualquier hueco dentro de una tarjeta. */
  lg: 16,
  xl: 20,
  /** Tarjetas y paneles. */
  xxl: 24,
  pill: 999,
} as const;

/**
 * Tipografia: `Sora` para lo que se lee de un vistazo, `Manrope` para lo que se lee de verdad.
 *
 * Se nombra la FAMILIA CONCRETA de cada grosor en vez de combinar una familia con `fontWeight`.
 * En Android `fontWeight` no interpola sobre una fuente cargada: o existe el archivo de ese
 * grosor, o el sistema finge la negrita engordando los trazos, y ese engorde es exactamente lo
 * que hace que una app se vea barata al lado de su propia web.
 *
 * Por eso ningun estilo de `type` lleva `fontWeight`: el grosor viaja en el nombre de la familia.
 *
 * ## El grosor 800 no es un capricho
 *
 * La identidad publicada dibuja TODOS sus titulares con `--display` a `font-weight: 800`
 * (`AtlasLandingPage/assets/css/style.css`). La app se habia quedado en 700, que en Sora es un
 * grosor claramente mas ligero, y con ello los titulos de las veinte pantallas se leian medio paso
 * por debajo de los de la web. Es el tipo de diferencia que nadie sabe nombrar y todo el mundo nota:
 * la app parecia el borrador del sitio.
 */
export const font = {
  displaySemi: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  /** El grosor de titular de la marca. El mismo 800 que la web. */
  displayBlack: 'Sora_800ExtraBold',
  bodyRegular: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  /** Solo para versalitas: a 11 px el 700 no llega a separarse del cuerpo. */
  bodyBlack: 'Manrope_800ExtraBold',
} as const;

/**
 * Interletraje OPTICO: el mismo porcentaje, no el mismo numero de pixeles.
 *
 * Es la correccion que faltaba y la que mas hacia que la tipografia se leyera «de plantilla». El
 * interletraje se percibe en proporcion al tamano: -0.5 px sobre 26 px es un -1,9 %, y sobre 11 px
 * seria un -4,5 %. Escribir el mismo numero en toda la escala deja los titulares SUELTOS —que es
 * como se ve una fuente puesta por defecto— y las etiquetas pequenas APRETADAS.
 *
 * La identidad publicada cierra sus titulares al -4,5 % y abre sus versalitas al +14 %. Aqui se
 * calcula desde el porcentaje para que la escala entera respete esa misma curva y para que anadir
 * un tamano nuevo no obligue a adivinar su interletraje.
 */
const track = (size: number, percent: number) => Math.round(size * percent) / 100;

/**
 * Escala tipografica.
 *
 * La regla de reparto: `Sora` manda en lo que se lee de un vistazo —titulos e importes— y
 * `Manrope` en lo que se lee de verdad, que es todo lo demas. Mezclar al reves cansa: Sora tiene
 * demasiada personalidad para un parrafo y Manrope demasiada poca para un titular.
 *
 * ## Los titulos de seccion cambiaron de familia, y era el fallo mas repetido
 *
 * `h3` es el estilo mas usado de la app despues del cuerpo —titula casi todas las tarjetas— y
 * estaba en **Manrope Bold a 17 px**, es decir, la fuente del parrafo un punto mas grande y en
 * negrita. Un titulo que solo se distingue de su texto por el grosor no crea jerarquia: crea
 * texto en negrita. Al pasar a Sora, la tarjeta recupera el contraste de familia que la marca ya
 * tenia, y la pantalla deja de leerse como una lista de parrafos.
 *
 * Lo que ANTES hacia `h3` en una fila de lista —titular una fila, no una seccion— tiene ahora su
 * propio estilo, `title`: ahi el contraste de familia sobra, porque una fila no encabeza nada.
 */
export const type = {
  /** Momentos de marca: bienvenida, exito de un alta. Se usa una vez por pantalla o ninguna. */
  display: { fontFamily: font.displayBlack, fontSize: 38, lineHeight: 44, letterSpacing: track(38, -4.5) },
  hero: { fontFamily: font.displayBlack, fontSize: 32, lineHeight: 38, letterSpacing: track(32, -4.5) },
  /** Titulo de pantalla. Uno por pantalla, en la cabecera. */
  h1: { fontFamily: font.displayBlack, fontSize: 25, lineHeight: 31, letterSpacing: track(25, -4) },
  /** Titulo de bloque grande dentro de una pantalla. */
  h2: { fontFamily: font.displayBold, fontSize: 20, lineHeight: 26, letterSpacing: track(20, -3.5) },
  /** Titulo de tarjeta o de seccion. */
  h3: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 23, letterSpacing: track(17, -2.5) },
  /** Titulo de FILA: nombra un elemento de una lista, no encabeza una seccion. Va en Manrope. */
  title: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 20, letterSpacing: track(15, -1) },
  /*
    El cuerpo era el UNICO hueco de la curva: no declaraba interletraje.

    Sin `letterSpacing`, `body` se dibuja con el que trae Manrope de fabrica, que es el de una fuente
    pensada para texto pequeno en pantallas anchas y a 15 px se lee suelto. Se notaba justo donde
    peor: `title` —que va al lado, en la misma fila y al mismo tamano— si estaba corregido al -1 %,
    asi que el titulo de una fila y su descripcion tenian dos ritmos distintos en el mismo renglon.
    El mismo -1 % los pone en la misma retícula.
  */
  body: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 23, letterSpacing: track(15, -1) },
  bodyStrong: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 23, letterSpacing: track(15, -1) },
  /*
    Aqui la curva se APLANA, y a proposito.

    Por debajo de 14 px la correccion cambia de signo: lo que ayuda a un titular —cerrar el espacio
    para que las letras formen una palabra— perjudica a un apunte, porque el ojo necesita separar
    las formas antes de reconocerlas, y sobre fondo oscuro todavia mas: el texto claro «engorda»
    opticamente sobre el navy y se come su propio espacio entre letras. Cero es el valor correcto,
    no el valor que falta; se escribe para que nadie lo complete «por coherencia» con la escala.
  */
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 19, letterSpacing: 0 },
  /** El dato de un par etiqueta/valor cuando no es dinero: se lee como valor, no como parrafo. */
  captionStrong: { fontFamily: font.bodyBold, fontSize: 13, lineHeight: 19, letterSpacing: 0 },
  /** Etiquetas y estados. Va en versalita espaciada: a 11 px el peso solo no basta para jerarquia. */
  micro: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: track(11, 5) },
  /**
   * Antetitulo: la etiqueta que dice de QUE es el bloque que viene debajo.
   *
   * Existe porque la app la estaba escribiendo a mano —`variant="caption"` con el texto ya en
   * mayusculas dentro del literal, «FINANCIADO», «POR PAGAR»—. Escribir mayusculas en el contenido
   * las mete en el lector de pantalla, que las deletrea, y deja el interletraje sin corregir: una
   * palabra en versalitas con el espaciado del texto normal se lee apretada y sucia. Aqui la caja
   * la pone el componente y el espaciado lo pone el token.
   */
  overline: { fontFamily: font.bodyBlack, fontSize: 11, lineHeight: 14, letterSpacing: track(11, 14) },
  /** Etiqueta de un control. Ligeramente abierta: compite con el borde del campo, no con un parrafo. */
  label: { fontFamily: font.bodySemi, fontSize: 13, lineHeight: 18, letterSpacing: track(13, 1) },
  /**
   * Importes. Cifras TABULARES a proposito.
   *
   * Con cifras proporcionales el «1» es mas estrecho que el «8», asi que una columna de importes
   * baila de fila en fila y el ojo deja de poder compararlos de un vistazo. En dinero eso no es
   * un detalle tipografico: es la diferencia entre leer un saldo y tener que releerlo.
   */
  amountHero: {
    fontFamily: font.displayBlack,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: track(40, -4.5),
    fontVariant: ['tabular-nums'] as const,
  },
  amount: {
    fontFamily: font.displayBlack,
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: track(31, -4),
    fontVariant: ['tabular-nums'] as const,
  },
  amountSmall: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: track(17, -2.5),
    fontVariant: ['tabular-nums'] as const,
  },
  /** El importe de una fila, donde `amountSmall` ya pesa demasiado al lado del titulo. */
  amountMicro: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: track(14, -2),
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

/**
 * Motion.
 *
 * Las duraciones son cortas a proposito. En una app de dinero la animacion existe para explicar de
 * donde sale una pantalla y a donde va, no para lucirse: pasado el cuarto de segundo el movimiento
 * deja de leerse como continuidad y empieza a leerse como espera.
 *
 * Se respetan siempre salvo que el sistema pida movimiento reducido, en cuyo caso valen cero. Ver
 * `ui/motion.tsx`.
 */
export const motion = {
  /** Respuesta al toque: tiene que sentirse inmediata o no se percibe como respuesta. */
  fast: 140,
  /** Entradas y salidas de contenido. */
  base: 240,
  /** Recorridos largos: hojas, superposiciones a pantalla completa. */
  slow: 380,
  /** Retardo entre elementos de una misma entrada escalonada. */
  stagger: 45,
  /**
   * El paso de una pantalla a otra a traves de la marca.
   *
   * Es el unico movimiento de la app que se sale del cuarto de segundo, y se lo puede permitir
   * porque ocurre UNA vez —al salir de la bienvenida— y porque durante el la app no esta
   * esperando nada: el destino se monta detras mientras la marca cubre.
   *
   * Estuvo en 560 ms y el zoom no se apreciaba: a esa velocidad la marca pasa de tamano normal a
   * salirse del encuadre en poco mas de un parpadeo, y lo que queda en la retina es un destello
   * verde, no un recorrido. 900 ms es lo que tarda el ojo en seguir un objeto que se acerca y
   * reconocerlo mientras lo hace. Sigue siendo corto para una transicion que ocurre una vez por
   * sesion: la referencia son los ~800 ms de las aperturas de app del sistema.
   */
  brandCut: 900,
  /**
   * La celebración de un logro (`ui/celebracion-logro.tsx`): el otro movimiento que se sale del cuarto de segundo, y
   * también ocurre una vez por logro. Caída del trofeo, ráfaga de partículas y barrido de luz.
   */
  celebracion: { caida: 560, rafaga: 2600, barrido: 800, rayos: 16000 },
} as const;

/**
 * Curvas de aceleracion.
 *
 * `standard` para lo que entra y sale, `decelerate` para lo que aparece —arranca rapido y se posa—,
 * `spring` para lo que responde al dedo. Escribirlas aqui evita que cada pantalla invente la suya y
 * que dos elementos vecinos se muevan con temperamentos distintos.
 */
export const easing = {
  standard: [0.2, 0, 0, 1] as const,
  decelerate: [0.05, 0.7, 0.1, 1] as const,
  accelerate: [0.3, 0, 1, 1] as const,
  /**
   * Entrada y salida simetricas, para lo que CUBRE y luego DESCUBRE.
   *
   * `standard` arranca de golpe: perfecto para algo que responde al dedo, y justo lo contrario de
   * lo que necesita una capa que tapa la pantalla entera. Aqui el arranque tiene que ser suave
   * —si no, la marca da un tiron en el primer fotograma— y el final tambien.
   */
  emphasized: [0.4, 0, 0.2, 1] as const,
} as const;

/**
 * Muelles.
 *
 * Un muelle no es «lo mismo pero rebotando»: es la diferencia entre un elemento que se DETIENE y
 * uno que se ASIENTA, y el ojo distingue las dos cosas aunque nadie sepa nombrarlas. Por eso el
 * movimiento que responde al dedo va con muelle y el que cubre la pantalla con curva.
 *
 * Los tres estan **sobreamortiguados a proposito**: llegan y se quedan, sin rebasar el destino.
 * El rebote es lo que hace que una app parezca un juguete, y esta es una app donde la gente mira
 * cuanto debe. La ganancia no es el rebote: es que la desaceleracion no sea lineal.
 */
export const spring = {
  /** Respuesta bajo el dedo: hundirse y volver. Rapido y seco. */
  press: { damping: 26, stiffness: 420, mass: 0.7 } as const,
  /** Un elemento que se coloca en su sitio: seleccion, aparicion de un bloque. */
  settle: { damping: 24, stiffness: 260, mass: 0.9 } as const,
  /** Recorridos amplios que deben sentirse conducidos, no disparados. */
  glide: { damping: 30, stiffness: 170, mass: 1 } as const,
  /**
   * El golpe de un trofeo al caer. Es el ÚNICO muelle subamortiguado de la app, a propósito: rebasa el destino y vuelve,
   * que es lo que se siente como peso y como premio. En una celebración, no en un control.
   */
  logro: { damping: 9, stiffness: 190, mass: 0.9 } as const,
} as const;

/** Escala del elemento presionado. Suficiente para notarse en el pulgar, no para saltar a la vista. */
export const press = {
  scale: 0.97,
  scaleSubtle: 0.985,
} as const;

/**
 * Grosores de linea.
 *
 * ## Por que un separador no mide 1
 *
 * `1` en React Native es un punto logico, y en un telefono moderno un punto son TRES pixeles
 * fisicos. Es el grosor correcto para un CONTORNO —lo que dibuja el canto de un objeto y tiene que
 * sostener una esquina redondeada—, y es el triple de lo que necesita un SEPARADOR, que solo tiene
 * que decir «aqui acaba una fila y empieza otra». A tres pixeles, esa raya se lee como un borde
 * pintado; a uno, como un filo. Es literalmente la diferencia entre una interfaz de definicion
 * estandar y una de alta definicion, y es el detalle por el que las listas del sistema en iOS se
 * ven mas afiladas que las de las apps que las imitan.
 *
 * `hairline` vale 1 pixel FISICO en el telefono donde se ejecuta —0,33 a 3x, 0,5 a 2x, 1 a 1x—, asi
 * que la linea es siempre la mas fina que la pantalla puede dibujar sin difuminarla. Su color no es
 * el del contorno: ver `color.border.hairline`.
 */
export const stroke = {
  /** Separadores: la linea mas fina que la pantalla puede dibujar. */
  hairline: StyleSheet.hairlineWidth,
  /** Contornos: el canto de un objeto. Un punto logico, en todas las pantallas. */
  edge: 1,
  /** Contorno con foco: engorda para que se vea cual de seis campos tiene el cursor. */
  focus: 1.5,
} as const;

/**
 * Cromo del SISTEMA dentro de un campo de texto.
 *
 * Todo lo que dibuja el sistema operativo encima de la app y que, si no se declara, sale con los
 * valores de fabrica: el teclado, el cursor, el asa de seleccion y el resaltado del texto elegido.
 * Son cuatro elementos pequenos y son los unicos pixeles de la pantalla que la marca no controla.
 *
 * ## El teclado claro es el fallo mas caro de la lista
 *
 * En iOS, `keyboardAppearance` vale `light` por defecto. En una app entera en navy, eso significa
 * que en cada uno de los treinta y tantos campos del alta sube desde abajo una lamina BLANCA que
 * ocupa media pantalla. No es un detalle de gusto: es el momento en que la app deja de parecer un
 * producto y pasa a parecer un formulario dentro de un navegador. Con `dark`, el teclado pertenece
 * a la misma pantalla que el campo que lo ha llamado.
 *
 * ## El cursor azul
 *
 * `selectionColor` sin declarar deja el cursor y la seleccion en el azul del sistema —#007AFF en
 * iOS, el acento del fabricante en Android—, que es el unico color de la app que no sale de esta
 * paleta y aparece justo donde la persona esta mirando mientras teclea. `cursorColor` es el mismo
 * ajuste para Android, donde el cursor y el resaltado se tinen por separado.
 */
export const inputChrome = {
  keyboardAppearance: 'dark',
  selectionColor: palette.brand400,
  cursorColor: palette.brand400,
} as const;

/**
 * Area tactil minima. 44 es el minimo de iOS HIG; 48 el de Material. Se toma 48 para no tener dos
 * criterios distintos segun plataforma.
 */
export const touch = {
  minSize: 48,
  minSpacing: 8,
} as const;

export const shadow = {
  /**
   * Elevacion de una tarjeta.
   *
   * Profunda y muy difusa, como en la identidad publicada (`--sh` del landing es
   * `0 30px 80px -28px rgba(0,0,0,.8)`). Una sombra corta y dura sobre fondo oscuro no se ve
   * —no hay contraste entre negro y negro—; lo que separa la superficie del papel es el TAMANO
   * del desenfoque, no su opacidad.
   */
  card: {
    shadowColor: palette.black,
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  /**
   * Halo de marca bajo la accion principal.
   *
   * Es lo que hace que el boton se lea como fuente de luz y no como un rectangulo pintado, y es
   * la firma visual de la identidad en la web. Se reserva para UNA accion por pantalla: si
   * brillan dos, no brilla ninguna.
   */
  brandGlow: {
    shadowColor: palette.brand400,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sheet: {
    shadowColor: palette.black,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
} as const;
