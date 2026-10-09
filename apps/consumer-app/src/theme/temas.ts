/**
 * Los TEMAS de ATLAS: el mismo juego de roles, dos juegos de valores.
 *
 * `claro` es el tema activo: minimalista y sobrio, a la manera de las apps de Apple — fondo
 * agrupado gris, tarjetas blancas, tinta casi negra, un solo color de accion (el navy de la marca) y
 * el teal reservado a lo que significa algo. `oscuro` es la identidad navy original, conservada
 * entera: cambiar `esquema` en `tokens.ts` la devuelve sin tocar una sola pantalla.
 *
 * Las dos ramas tienen la MISMA forma (`Tema`): si a una le falta un rol, TypeScript lo canta.
 */
import { blanco, estadoClaro, estadoOscuro, marca, negro, neutroClaro, neutroOscuro, terceros } from './palette';

/** `#RRGGBB` + alfa -> `rgba()`. La unica forma de escribir una transparencia fuera de la paleta. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Un degradado: al menos dos paradas, como lo pide `expo-linear-gradient`. */
export type Degradado = readonly [string, string, ...string[]];

type Profundo<T> = { [K in keyof T]: T[K] extends readonly string[] ? Degradado : T[K] extends object ? Profundo<T[K]> : string };

const oscuro = {
  surface: {
    primary: neutroOscuro.fondo,
    secondary: neutroOscuro.fondoElevado,
    /** Tarjetas y cualquier cosa que deba leerse POR ENCIMA del fondo. */
    raised: neutroOscuro.tarjeta,
    raisedStrong: alpha(blanco, 0.07),
    sheet: neutroOscuro.hoja,
    inverse: blanco,
    /** Filo superior de una superficie elevada: la luz cae desde arriba. */
    edge: alpha(blanco, 0.1),
    /** Superficie HUNDIDA: campos, opciones, cajas de importe. Un campo es un hueco, no un pedestal. */
    sunken: neutroOscuro.fondo,
  },
  text: {
    primary: neutroOscuro.tinta1,
    secondary: neutroOscuro.tinta2,
    tertiary: neutroOscuro.tinta3,
    onBrand: marca.b900,
    onInverse: marca.b900,
    /** Ejemplo dentro de un campo vacio: mas apagado que `tertiary` para que no se lea como relleno. */
    placeholder: neutroOscuro.tinta4,
    /** Texto sobre una superficie que es oscura en CUALQUIER tema (el banner de partner, la camara). */
    onDark: blanco,
  },
  border: {
    subtle: alpha(blanco, 0.09),
    strong: alpha(blanco, 0.16),
    focus: marca.b400,
    /** Linea de un pixel fisico: mas subida que `subtle` porque cubre un tercio de superficie. */
    hairline: alpha(blanco, 0.2),
    /** Contorno de un control donde se escribe o se elige: 3:1 (WCAG 1.4.11). Nunca en un separador. */
    field: alpha(blanco, 0.34),
  },
  /** Rellenos translucidos neutros: lavados sobre una superficie, en tres intensidades. */
  fill: {
    subtle: alpha(blanco, 0.04),
    base: alpha(blanco, 0.07),
    strong: alpha(blanco, 0.1),
  },
  action: {
    primary: marca.b400,
    primaryPressed: marca.b500,
    /** El relleno del boton principal, de arriba-izquierda a abajo-derecha. */
    primaryGradient: [marca.b300, marca.b400, marca.b500] as const,
    /** El halo del boton principal y su aura. */
    glow: marca.b400,
    glowSoft: alpha(marca.b400, 0.07),
    /** El color del barrido de luz que cruza el boton principal, en su punto mas intenso. */
    sheen: alpha('#BEFFEB', 0.55),
    /** La sombra interior del pie del boton principal: le da volumen. */
    shade: marca.b900,
    /** El reflejo de cristal en la mitad de arriba del boton principal, y su filo de luz. */
    glassTop: alpha(blanco, 0.42),
    glassLine: alpha(blanco, 0.7),
    secondary: alpha(blanco, 0.07),
    destructive: estadoOscuro.peligro,
    disabled: alpha(blanco, 0.1),
  },
  /** El ACENTO: lo que es de la marca y significa algo (seleccion, progreso, enlace, logro). */
  accent: {
    base: marca.b400,
    strong: marca.b500,
    soft: alpha(marca.b400, 0.1),
    border: alpha(marca.b300, 0.35),
    onAccent: marca.b900,
  },
  /**
   * La rampa de MARCA tal como se pinta sobre la superficie del tema: logotipo, ilustraciones,
   * degradados de progreso. En claro se oscurece un paso para que la menta no se pierda sobre blanco.
   */
  brand: { ...marca },
  feedback: {
    success: estadoOscuro.exito,
    warning: estadoOscuro.aviso,
    danger: estadoOscuro.peligro,
    dangerStrong: estadoOscuro.peligroFuerte,
    info: estadoOscuro.info,
  },
  /** Fondos tenues para chips/estados. Mantienen contraste AA sobre `surface.primary`. */
  feedbackSoft: {
    success: alpha(estadoOscuro.exito, 0.14),
    warning: alpha(estadoOscuro.aviso, 0.14),
    danger: alpha(estadoOscuro.peligro, 0.14),
    info: alpha(estadoOscuro.info, 0.12),
    neutral: alpha(blanco, 0.07),
  },
  /** Velo para superponer contenido: el fondo se reconoce, pero no compite. */
  overlay: { scrim: alpha('#030A14', 0.72), scrimStrong: alpha('#030A14', 0.94) },
  /** El papel desvaneciendose: mismo color con alfa 0, nunca `transparent` (pasaria por gris sucio). */
  paperFade: { from: neutroOscuro.fondo, to: alpha(neutroOscuro.fondo, 0) },
  brandGradient: [marca.b500, marca.b400, marca.b300] as const,
  /** Lavado de marca para superficies grandes: destaca sin obligar a cambiar el color del texto. */
  brandWash: { from: alpha(marca.b500, 0.16), to: alpha(marca.b400, 0.06) },
  /** El arranque de color de una cabecera ilustrada (Ayuda, Conoce Atlas), que se funde con la tarjeta. */
  heroWash: marca.b700,
  /** Contornos de los avisos: el color del estado a un tercio, delimita sin competir. */
  feedbackBorder: {
    warning: alpha(estadoOscuro.aviso, 0.35),
    danger: alpha(estadoOscuro.peligro, 0.35),
    success: alpha(estadoOscuro.exito, 0.32),
    brand: alpha(marca.b400, 0.28),
  },
  /**
   * El ESCENARIO de marca: el arranque, el corte de marca y la celebracion de un logro. Es oscuro en
   * los dos temas a proposito: son los momentos de identidad y su movimiento se diseno sobre navy.
   */
  stage: { brand: { ...marca }, scrim: alpha('#030A14', 0.94), chip: alpha('#050B16', 0.55), ink3: neutroOscuro.tinta3, bg: neutroOscuro.fondo, bgElevated: neutroOscuro.fondoElevado, card: neutroOscuro.tarjeta, ink: neutroOscuro.tinta1, ink2: neutroOscuro.tinta2, line: alpha(blanco, 0.16), edge: alpha(blanco, 0.1) },
  /** La camara: siempre sobre la imagen en vivo, que es oscura o impredecible. */
  camera: { bg: negro, bar: alpha(negro, 0.35), barStrong: alpha(negro, 0.6), ink: blanco, inkSoft: alpha(blanco, 0.86), guide: alpha(blanco, 0.85), ring: alpha(blanco, 0.35), ringFill: alpha(blanco, 0.08), mask: alpha('#06121F', 0.58) },
  /** Mapa: fondo de teselas mientras cargan y la marca del punto. */
  map: { streets: '#E9EEF1', satellite: '#1B2530', point: '#2BD9A1', pointSoft: alpha('#2BD9A1', 0.2), chip: alpha(neutroOscuro.fondo, 0.86), attribution: alpha(blanco, 0.75), attributionInk: '#22303C' },
  /** Colores fijos que NO cambian con el tema: un QR es negro sobre blanco o no se lee. */
  fixed: { white: blanco, black: negro },
  thirdParty: { ...terceros },
};

export type Tema = Profundo<typeof oscuro>;

const claro: Tema = {
  surface: {
    primary: neutroClaro.fondo,
    secondary: neutroClaro.superficie2,
    raised: neutroClaro.superficie,
    raisedStrong: alpha(neutroClaro.relleno, 0.08),
    sheet: neutroClaro.superficie,
    inverse: neutroClaro.tinta1,
    /** En claro la luz no deja filo: el canto superior es el mismo contorno tenue que los demas. */
    edge: alpha(neutroClaro.separador, 0.12),
    sunken: neutroClaro.fondoHundido,
  },
  text: {
    primary: neutroClaro.tinta1,
    secondary: neutroClaro.tinta2,
    tertiary: neutroClaro.tinta3,
    /** Blanco sobre el navy de la accion principal: 14:1. */
    onBrand: blanco,
    onInverse: blanco,
    placeholder: neutroClaro.tinta4,
    onDark: blanco,
  },
  border: {
    subtle: alpha(neutroClaro.separador, 0.12),
    strong: alpha(neutroClaro.separador, 0.2),
    focus: marca.b600,
    hairline: alpha(neutroClaro.separador, 0.29),
    field: neutroClaro.contornoControl,
  },
  fill: {
    subtle: alpha(neutroClaro.relleno, 0.06),
    base: alpha(neutroClaro.relleno, 0.12),
    strong: alpha(neutroClaro.relleno, 0.18),
  },
  action: {
    /** Un banco: la accion principal es navy solido, sin degradado ni neon. */
    primary: marca.navy,
    primaryPressed: marca.navyProfundo,
    primaryGradient: [marca.navy, marca.navy, marca.navyProfundo],
    glow: marca.navy,
    glowSoft: alpha(marca.navy, 0),
    sheen: alpha(blanco, 0.22),
    shade: negro,
    /** En claro el boton es un solido navy: el cristal queda como un matiz, no como un reflejo. */
    glassTop: alpha(blanco, 0.1),
    glassLine: alpha(blanco, 0.16),
    secondary: alpha(neutroClaro.relleno, 0.12),
    destructive: estadoClaro.peligro,
    disabled: alpha(neutroClaro.relleno, 0.16),
  },
  accent: {
    base: marca.b600,
    strong: marca.b700,
    soft: alpha(marca.b600, 0.08),
    border: alpha(marca.b600, 0.3),
    onAccent: blanco,
  },
  /** La rampa de marca un paso mas oscura: sobre blanco, la menta original no llega a leerse. */
  brand: {
    navy: marca.navy,
    navyProfundo: marca.navyProfundo,
    b900: marca.b900,
    b700: '#0A5558',
    b600: marca.b600,
    b500: marca.b700,
    b400: '#0F8F84',
    b300: marca.b500,
    tint: marca.b600,
  },
  feedback: {
    success: estadoClaro.exito,
    warning: estadoClaro.aviso,
    danger: estadoClaro.peligro,
    dangerStrong: estadoClaro.peligroFuerte,
    info: estadoClaro.info,
  },
  feedbackSoft: {
    success: alpha(estadoClaro.exito, 0.1),
    warning: alpha(estadoClaro.aviso, 0.1),
    danger: alpha(estadoClaro.peligro, 0.08),
    info: alpha(estadoClaro.info, 0.08),
    neutral: alpha(neutroClaro.relleno, 0.1),
  },
  overlay: { scrim: alpha('#0B0D12', 0.4), scrimStrong: alpha('#0B0D12', 0.82) },
  paperFade: { from: neutroClaro.fondo, to: alpha(neutroClaro.fondo, 0) },
  brandGradient: [marca.b700, marca.b600, marca.b700],
  brandWash: { from: alpha(marca.b600, 0.06), to: alpha(marca.b600, 0.02) },
  heroWash: alpha(marca.b600, 0.14),
  feedbackBorder: {
    warning: alpha(estadoClaro.aviso, 0.3),
    danger: alpha(estadoClaro.peligro, 0.3),
    success: alpha(estadoClaro.exito, 0.28),
    brand: alpha(marca.b600, 0.24),
  },
  stage: oscuro.stage,
  camera: oscuro.camera,
  map: { ...oscuro.map, chip: alpha(neutroClaro.tinta1, 0.82) },
  fixed: oscuro.fixed,
  thirdParty: oscuro.thirdParty,
};

export const temas = { claro, oscuro: oscuro as Tema } as const;
export type Esquema = keyof typeof temas;
