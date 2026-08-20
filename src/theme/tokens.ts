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

  ink04: 'rgba(255,255,255,0.04)',
  ink07: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.09)',
  line2: 'rgba(255,255,255,0.16)',

  text1: '#EDF3F9',
  text2: '#94A8BF',
  text3: '#5F7591',

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
    raised: palette.ink04,
    raisedStrong: palette.ink07,
    sheet: palette.bgSheet,
    inverse: palette.white,
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

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/**
 * Tipografia: `Sora` para display, `Manrope` para texto.
 *
 * Se nombra la FAMILIA CONCRETA de cada grosor en vez de combinar una familia con `fontWeight`.
 * En Android `fontWeight` no interpola sobre una fuente cargada: o existe el archivo de ese
 * grosor, o el sistema finge la negrita engordando los trazos, y ese engorde es exactamente lo
 * que hace que una app se vea barata al lado de su propia web.
 *
 * Por eso ningun estilo de `type` lleva `fontWeight`: el grosor viaja en el nombre de la familia.
 */
export const font = {
  displaySemi: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  bodyRegular: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

/**
 * Escala tipografica.
 *
 * La regla de reparto: `Sora` manda en lo que se lee de un vistazo —titulos e importes— y
 * `Manrope` en lo que se lee de verdad, que es todo lo demas. Mezclar al reves cansa: Sora tiene
 * demasiada personalidad para un parrafo y Manrope demasiada poca para un titular.
 */
export const type = {
  hero: { fontFamily: font.displayBold, fontSize: 34, lineHeight: 42, letterSpacing: -0.8 },
  h1: { fontFamily: font.displayBold, fontSize: 26, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: font.displaySemi, fontSize: 20, lineHeight: 27, letterSpacing: -0.3 },
  h3: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 19 },
  /** Etiquetas y estados. Va en versalita espaciada: a 11 px el peso solo no basta para jerarquia. */
  micro: { fontFamily: font.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.6 },
  /**
   * Importes. Cifras TABULARES a proposito.
   *
   * Con cifras proporcionales el «1» es mas estrecho que el «8», asi que una columna de importes
   * baila de fila en fila y el ojo deja de poder compararlos de un vistazo. En dinero eso no es
   * un detalle tipografico: es la diferencia entre leer un saldo y tener que releerlo.
   */
  amount: {
    fontFamily: font.displayBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'] as const,
  },
  amountSmall: {
    fontFamily: font.displaySemi,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.3,
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
} as const;

/** Escala del elemento presionado. Suficiente para notarse en el pulgar, no para saltar a la vista. */
export const press = {
  scale: 0.97,
  scaleSubtle: 0.985,
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
  card: {
    shadowColor: palette.black,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  sheet: {
    shadowColor: palette.black,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
} as const;
