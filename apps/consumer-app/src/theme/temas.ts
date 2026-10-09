/**
 * Los TEMAS: el mismo juego de roles, calculado desde la MARCA para claro y para oscuro.
 *
 * Nada aqui es especifico de Atlas. `crearTema(esquema, marca)` toma el color principal y el acento
 * de `marca.ts`, los coloca sobre neutros de sistema (grises de iOS, sin tinte) y corrige cada tono
 * hasta que cumple su contraste con el motor de `color.ts`. Cambiar de marca es cambiar `marca.ts`;
 * la prueba `temas-contraste.test.ts` comprueba los dos temas con esa marca y con marcas extremas.
 *
 * Criterio (pedido de Pablo, 2026-10-09: «limpio, minimalista, que de una imagen seria»):
 * - UN color con intencion por pantalla: la accion principal. El acento solo donde significa algo.
 * - Neutros de verdad: fondos agrupados grises, tarjetas que se separan por tono y no por sombra.
 * - Claro y oscuro con la MISMA jerarquia: lo que es secundario en uno lo es en el otro.
 * - El oscuro es casi negro neutro (no navy): sobrio, y la marca se reconoce por el acento.
 *
 * Las dos ramas tienen la MISMA forma (`Tema`): si a una le falta un rol, TypeScript lo canta.
 */
import { aOklch, conContraste, conLuz, desdeOklch, sobre, tintaSobre } from './color';
import { marca as marcaActual } from './marca';
import { blanco, negro, terceros } from './palette';

/** `#RRGGBB` + alfa -> `rgba()`. La unica forma de escribir una transparencia fuera de la paleta. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Un degradado: al menos dos paradas, como lo pide `expo-linear-gradient`. */
export type Degradado = readonly [string, string, ...string[]];

export type Esquema = 'claro' | 'oscuro';
export type Marca = { principal: string; acento: string };

/**
 * Neutros de sistema. Son los grises de iOS (`systemGroupedBackground`, `label`, `secondaryLabel`,
 * `separator`), con el texto terciario subido hasta pasar AA en la peor superficie: el gris claro
 * «elegante» que no llega a contraste es una de las marcas de una interfaz sin terminar.
 */
const NEUTROS = {
  claro: {
    fondo: '#F5F5F7',
    superficie: '#FFFFFF',
    superficie2: '#FAFAFC',
    hundido: '#F5F5F7',
    tinta1: '#1D1D1F',
    tinta2: '#48484D',
    /** 4,7:1 sobre el fondo agrupado, la peor superficie. */
    tinta3: '#6E6E73',
    /** Ejemplo dentro de un campo vacio: legible, sin competir con un dato. */
    tinta4: '#8E8E93',
    /** Contorno de un control: 3,3:1 sobre el fondo y 3,6:1 sobre blanco (WCAG 1.4.11). */
    control: '#86868B',
    linea: '#3C3C43',
    relleno: '#767680',
    velo: '#000000',
  },
  oscuro: {
    fondo: '#0A0A0B',
    superficie: '#161617',
    superficie2: '#1C1C1E',
    hundido: '#0F0F10',
    tinta1: '#F5F5F7',
    tinta2: '#AEAEB2',
    /** 5,9:1 sobre la superficie mas clara del tema. */
    tinta3: '#98989D',
    tinta4: '#636366',
    /** 3,6:1 sobre la tarjeta. */
    control: '#6E6E73',
    linea: '#FFFFFF',
    relleno: '#787880',
    velo: '#000000',
  },
} as const;

/** Estados: matices de sistema, corregidos al contraste del tema. Verde, ambar y rojo, nunca el acento. */
const ESTADOS = {
  claro: { exito: '#248A3D', aviso: '#B25000', peligro: '#D70015' },
  oscuro: { exito: '#30D158', aviso: '#FF9F0A', peligro: '#FF453A' },
} as const;

/** La rampa de la marca: tonos del acento a luminosidades fijas, para ilustraciones y progreso. */
function rampa(acento: string, principal: string, esquema: Esquema) {
  const t = (l: number, c = 1) => conLuz(acento, l, c);
  return esquema === 'claro'
    ? { navy: principal, navyProfundo: conLuz(principal, Math.max(0.12, aOklch(principal).l - 0.06)), b900: t(0.24), b700: t(0.4), b600: t(0.47), b500: t(0.5), b400: t(0.56), b300: t(0.63), tint: t(0.47) }
    : { navy: principal, navyProfundo: conLuz(principal, Math.max(0.12, aOklch(principal).l - 0.06)), b900: t(0.22), b700: t(0.46), b600: t(0.62), b500: t(0.68), b400: t(0.76), b300: t(0.84, 0.8), tint: t(0.88, 0.6) };
}

export function crearTema(esquema: Esquema, marca: Marca = marcaActual) {
  const n = NEUTROS[esquema];
  const claro = esquema === 'claro';
  const superficies = [n.fondo, n.superficie, n.superficie2, n.hundido];

  // La ACCION principal. En claro, la marca tal cual si deja leer blanco encima. En oscuro, la marca
  // ACLARADA: un navy sobre casi negro no se ve, y un boton que no se ve no manda.
  const primaria = claro
    ? conContraste(marca.principal, [blanco], 4.5)
    : conContraste(desdeOklch({ l: 0.84, c: Math.min(aOklch(marca.principal).c, 0.06), h: aOklch(marca.principal).h }), [n.fondo, n.superficie2], 7);
  const sobrePrimaria = tintaSobre(primaria);
  const presionada = conLuz(primaria, aOklch(primaria).l + (claro ? -0.06 : -0.08));

  // El ACENTO: lo que significa algo. Texto legible sobre cualquier superficie del tema.
  const acento = conContraste(claro ? marca.acento : conLuz(marca.acento, 0.76), superficies, 4.5);
  const acentoFuerte = conLuz(acento, aOklch(acento).l + (claro ? -0.07 : 0.06));
  const sobreAcento = tintaSobre(acento);

  const e = ESTADOS[esquema];
  const exito = conContraste(e.exito, superficies, 4.5);
  const aviso = conContraste(e.aviso, superficies, 4.5);
  const peligro = conContraste(e.peligro, superficies, 4.5);
  const brand = rampa(acento, marca.principal, esquema);

  return {
    surface: {
      primary: n.fondo,
      secondary: n.superficie2,
      /** Tarjetas y cualquier cosa que deba leerse POR ENCIMA del fondo. */
      raised: n.superficie,
      raisedStrong: alpha(n.relleno, claro ? 0.08 : 0.16),
      sheet: claro ? n.superficie : n.superficie2,
      inverse: n.tinta1,
      /** El canto superior de una tarjeta: el mismo contorno tenue que los demas lados. */
      edge: alpha(n.linea, claro ? 0.12 : 0.1),
      /** Superficie HUNDIDA: campos, opciones, cajas de importe. Un campo es un hueco, no un pedestal. */
      sunken: n.hundido,
    },
    text: {
      primary: n.tinta1,
      secondary: n.tinta2,
      tertiary: n.tinta3,
      /** Texto sobre la accion principal. */
      onBrand: sobrePrimaria,
      onInverse: claro ? blanco : '#0B0B0D',
      placeholder: n.tinta4,
      /** Texto sobre una superficie que es oscura en CUALQUIER tema (la camara, una foto). */
      onDark: blanco,
    },
    border: {
      subtle: alpha(n.linea, claro ? 0.12 : 0.1),
      strong: alpha(n.linea, claro ? 0.2 : 0.16),
      focus: acento,
      /** Linea de un pixel fisico: mas subida que `subtle` porque cubre un tercio de superficie. */
      hairline: alpha(n.linea, claro ? 0.29 : 0.22),
      /** Contorno de un control donde se escribe o se elige: 3:1 (WCAG 1.4.11). Nunca en un separador. */
      field: n.control,
    },
    /** Rellenos translucidos neutros: lavados sobre una superficie, en tres intensidades. */
    fill: {
      subtle: alpha(n.relleno, claro ? 0.06 : 0.12),
      base: alpha(n.relleno, claro ? 0.12 : 0.2),
      strong: alpha(n.relleno, claro ? 0.18 : 0.28),
    },
    action: {
      primary: primaria,
      primaryPressed: presionada,
      /** Un relleno casi plano: el boton se reconoce por ser el unico solido de color de la pantalla. */
      primaryGradient: [primaria, primaria, presionada] as Degradado,
      glow: primaria,
      glowSoft: alpha(primaria, 0),
      /** El barrido de luz que cruza el boton principal: un matiz, no un destello. */
      sheen: alpha(sobrePrimaria, claro ? 0.2 : 0.28),
      shade: negro,
      glassTop: alpha(blanco, claro ? 0.1 : 0.16),
      glassLine: alpha(blanco, claro ? 0.16 : 0.3),
      secondary: alpha(n.relleno, claro ? 0.12 : 0.24),
      destructive: peligro,
      disabled: alpha(n.relleno, claro ? 0.16 : 0.24),
    },
    /** El ACENTO: lo que es de la marca y significa algo (seleccion, progreso, enlace, logro). */
    accent: {
      base: acento,
      strong: acentoFuerte,
      soft: alpha(acento, claro ? 0.08 : 0.16),
      border: alpha(acento, claro ? 0.3 : 0.4),
      onAccent: sobreAcento,
      /** El segundo tono de un icono a dos tonos: el mismo matiz, mas suave (como la jerarquia de SF Symbols). */
      muted: claro ? brand.b300 : brand.b600,
    },
    /** La rampa de MARCA ajustada a la superficie del tema: logotipo, ilustraciones, progreso. */
    brand,
    feedback: { success: exito, warning: aviso, danger: peligro, dangerStrong: conLuz(peligro, aOklch(peligro).l + (claro ? -0.08 : 0.08)), info: acento },
    /** Fondos tenues para chips/estados. */
    feedbackSoft: {
      success: alpha(exito, claro ? 0.1 : 0.16),
      warning: alpha(aviso, claro ? 0.1 : 0.16),
      danger: alpha(peligro, claro ? 0.08 : 0.16),
      info: alpha(acento, claro ? 0.08 : 0.16),
      neutral: alpha(n.relleno, claro ? 0.1 : 0.2),
    },
    /** Velo para superponer contenido: el fondo se reconoce, pero no compite. */
    overlay: { scrim: alpha(n.velo, claro ? 0.4 : 0.6), scrimStrong: alpha(n.velo, claro ? 0.8 : 0.9) },
    /** El papel desvaneciendose: mismo color con alfa 0, nunca `transparent` (pasaria por gris sucio). */
    paperFade: { from: n.fondo, to: alpha(n.fondo, 0) },
    brandGradient: (claro ? [brand.b700, brand.b600, brand.b700] : [brand.b600, brand.b500, brand.b600]) as Degradado,
    /** Lavado de marca para superficies grandes: destaca sin obligar a cambiar el color del texto. */
    brandWash: { from: alpha(acento, claro ? 0.06 : 0.12), to: alpha(acento, claro ? 0.02 : 0.04) },
    /** El arranque de color de una cabecera ilustrada (Ayuda, Conoce Atlas), que se funde con la tarjeta. */
    heroWash: alpha(acento, claro ? 0.12 : 0.2),
    /** Contornos de los avisos: el color del estado a un tercio, delimita sin competir. */
    feedbackBorder: {
      warning: alpha(aviso, 0.3),
      danger: alpha(peligro, 0.3),
      success: alpha(exito, 0.28),
      brand: alpha(acento, 0.24),
    },
    /**
     * El ESCENARIO de marca: el arranque, la celebracion de un logro, la carta de una insignia. Sigue
     * al tema: blanco en claro (la entrada que pidio Pablo) y casi negro en oscuro.
     */
    stage: {
      brand,
      bg: claro ? blanco : n.fondo,
      bgElevated: n.superficie2,
      card: n.superficie,
      ink: n.tinta1,
      ink2: n.tinta2,
      ink3: n.tinta3,
      line: alpha(n.linea, claro ? 0.16 : 0.16),
      edge: alpha(n.linea, 0.1),
      scrim: alpha(claro ? n.fondo : n.fondo, 0.96),
      chip: alpha(n.relleno, claro ? 0.12 : 0.24),
      /** La viñeta que cierra los bordes del arranque: sombra en oscuro, nada en claro. */
      vignette: claro ? blanco : negro,
      /** El brillo de las chispas: luz blanca sobre oscuro, el tono claro de la marca sobre blanco. */
      glint: claro ? brand.b400 : blanco,
      /**
       * Cuanto brillan el halo y los rayos del arranque. Pleno sobre oscuro; sobre blanco, un tercio: la
       * entrada clara es limpia, la luz se insinua en vez de teñir la pantalla.
       */
      glow: claro ? 0.32 : 0.8,
      /** El destello del impacto: blanco puro en los dos (en claro funde con el fondo, que es lo buscado). */
      flash: blanco,
    },
    /** La camara: siempre sobre la imagen en vivo, que es oscura o impredecible. */
    camera: { bg: negro, bar: alpha(negro, 0.35), barStrong: alpha(negro, 0.6), ink: blanco, inkSoft: alpha(blanco, 0.86), guide: alpha(blanco, 0.85), ring: alpha(blanco, 0.35), ringFill: alpha(blanco, 0.08), mask: alpha('#06121F', 0.58) },
    /** Mapa: fondo de teselas mientras cargan y la marca del punto. */
    map: { streets: claro ? '#E9EEF1' : '#1E2124', satellite: '#1B2530', point: acento, pointSoft: alpha(acento, 0.2), chip: alpha(claro ? n.tinta1 : n.superficie2, 0.86), attribution: alpha(blanco, 0.75), attributionInk: '#22303C' },
    /**
     * Colores fijos que NO cambian con el tema: un QR es negro sobre blanco o no se lee. `brandOnDark`
     * es la marca sobre algo que es oscuro en cualquier tema (la camara, la tarjeta navy).
     */
    fixed: { white: blanco, black: negro, brandOnDark: conLuz(marca.acento, 0.78), brandOnDarkSoft: conLuz(marca.acento, 0.86, 0.7) },
    thirdParty: { ...terceros },
  };
}

export type Tema = ReturnType<typeof crearTema>;

/** Lo que vale de verdad sobre una superficie: util para medir rellenos translucidos en las pruebas. */
export { sobre };
