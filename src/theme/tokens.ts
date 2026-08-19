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
  brandGradient: [palette.brand500, palette.brand400, palette.brand300] as const,
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
 * Tipografia. `Sora` para display y `Manrope` para texto, con fallback del sistema: la app debe
 * verse correcta aunque la fuente no llegue a cargar.
 */
export const font = {
  display: 'Sora_600SemiBold',
  displayFallback: undefined,
  body: 'Manrope_500Medium',
} as const;

export const type = {
  hero: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontWeight: '700' as const },
  h1: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5, fontWeight: '700' as const },
  h2: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontWeight: '700' as const },
  h3: { fontSize: 17, lineHeight: 23, letterSpacing: -0.2, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 15, letterSpacing: 0.3, fontWeight: '700' as const },
  /** Importes: tabulares para que las columnas de dinero no bailen entre filas. */
  amount: { fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '700' as const },
  amountSmall: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
} as const;

/** Duraciones de motion. Se respetan salvo que el sistema pida movimiento reducido. */
export const motion = {
  fast: 140,
  base: 240,
  slow: 380,
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
