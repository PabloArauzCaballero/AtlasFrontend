/**
 * Tokens de diseno.
 *
 * Tres capas, y solo la primera es de la marca:
 *  1. `marca.ts` — el nombre, el color principal, el acento y la tipografia. Cambiar de marca es
 *     cambiar ESE archivo (procedimiento en `docs/marca-y-temas.md`).
 *  2. `temas.ts` — los roles (fondo, texto, accion, acento, estado…) calculados desde la marca para
 *     claro y oscuro, con el contraste corregido por el motor de `color.ts`.
 *  3. Este archivo — lo que no es color: espacio, radios, tipografia, movimiento, sombras.
 *
 * Criterio visual (2026-10): sobrio y minimalista, a la manera de las apps de Apple, porque es una
 * entidad financiera. El MOVIMIENTO —duraciones, curvas, muelles— es el de siempre: no se toca en un
 * retoque visual.
 *
 * Regla: ningun componente escribe un color literal. Si un color no esta aqui, no existe.
 */

import { Platform, StyleSheet } from 'react-native';
import { marca } from './marca';
import { blanco, negro } from './palette';
import { leerEsquemaGuardado } from './preferencia';
import { crearTema, type Esquema, type Tema } from './temas';

/**
 * El esquema ACTIVO: el que eligio la persona en Perfil › Apariencia, o claro si nunca eligio.
 *
 * Se decide al arrancar y no cambia a mitad de sesion: las pantallas construyen sus estilos con
 * `StyleSheet.create` al cargar el modulo. Cambiarlo guarda la eleccion y recarga (`preferencia.ts`).
 */
export const esquema: Esquema = leerEsquemaGuardado() ?? 'claro';

/**
 * Tokens semanticos de color: lo que las pantallas consumen.
 *
 * El nombre describe el ROL, no el color. Ver `__tests__/sin-colores-sueltos.test.ts`.
 */
export const color: Tema = crearTema(esquema);

/** Valores que no son de interfaz sino de OBJETOS ilustrados (trofeos, medallas, el chip dorado). */
export { metal } from './palette';
export { ilustracion } from './ilustracion';
export { objeto } from './objetos';
export { marca } from './marca';

/** Cuanto emite luz la interfaz (`marca.estilo.brillo`): multiplica halos, auras y reflejos. 0 = sobrio. */
export const brillo = marca.estilo.brillo;
export { alpha } from './temas';
export type { Degradado, Esquema, Tema } from './temas';

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
 * Tipografia: la del SISTEMA. SF Pro en iPhone, Roboto en Android, la pila del sistema en la web.
 *
 * Es la decision que mas acerca la app al lenguaje de Apple, y la que mejor envejece: el sistema
 * ajusta el tamano optico (SF Text por debajo de 20 pt, SF Display por encima) y el interletraje por
 * si mismo, cosa que una fuente cargada no hace. Sora y Manrope siguen cargadas solo para el
 * logotipo y el escenario de marca (`font.brand*`).
 *
 * Con la fuente del sistema el grosor SI viaja en `fontWeight` —el sistema tiene todos los cortes y
 * no finge negritas—, asi que cada `font.*` tiene su peso en `weight.*` y los estilos de `type` ya
 * llevan los dos.
 */
const SISTEMA = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;
const texto = marca.tipografia.texto;
const titulares = marca.tipografia.titulares;

export const font = {
  displaySemi: titulares?.semi ?? SISTEMA,
  displayBold: titulares?.negrita ?? SISTEMA,
  displayBlack: titulares?.negrita ?? SISTEMA,
  bodyRegular: texto?.regular ?? SISTEMA,
  bodyMedium: texto?.medio ?? SISTEMA,
  bodySemi: texto?.semi ?? SISTEMA,
  bodyBold: texto?.negrita ?? SISTEMA,
  bodyBlack: texto?.negrita ?? SISTEMA,
  /** El logotipo escrito y el escenario de marca. */
  brand: marca.tipografia.logotipo ?? SISTEMA,
  brandBold: marca.tipografia.logotipo ?? SISTEMA,
} as const;

/** El grosor de cada `font.*`. Con la fuente del sistema, el peso va aqui y no en el nombre. */
/*
  Con una fuente PROPIA el grosor viaja en el nombre de la familia (un archivo por grosor) y el peso va
  vacio: en Android `fontWeight` sobre una fuente cargada finge la negrita engordando los trazos.
*/
const pesoSistema = <P extends '400' | '600' | '700'>(propia: unknown, p: P) => (propia ? undefined : p);
export const weight = {
  displaySemi: pesoSistema(titulares, '600'),
  displayBold: pesoSistema(titulares, '700'),
  displayBlack: pesoSistema(titulares, '700'),
  bodyRegular: pesoSistema(texto, '400'),
  bodyMedium: pesoSistema(texto, '400'),
  bodySemi: pesoSistema(texto, '600'),
  bodyBold: pesoSistema(texto, '600'),
  bodyBlack: pesoSistema(texto, '700'),
  brand: undefined,
  brandBold: undefined,
} as const;

/** `{ fontFamily, fontWeight }` de una familia: lo que se escribe cuando un estilo no sale de `type`. */
export const fuente = (f: keyof typeof font) => ({ fontFamily: font[f], fontWeight: weight[f] });

/** Interletraje OPTICO: el mismo porcentaje del tamano, no el mismo numero de pixeles. */
const track = (size: number, percent: number) => Math.round(size * percent) / 100;

/**
 * Escala tipografica: la de iOS (Large Title, Title 1-3, Headline, Body, Subheadline, Footnote,
 * Caption), con los interletrajes de SF Pro.
 *
 * La jerarquia se construye con PESO y color antes que con tamano: seminegrita para el titulo de una
 * fila, el gris secundario para su detalle. Los titulos se cierran un poco (-1 a -2 %) y el texto
 * pequeno se abre, como hace SF por si misma.
 */
export const type = {
  /** Momentos de marca: bienvenida, exito de un alta. Una vez por pantalla o ninguna. */
  display: { ...fuente('displayBlack'), fontSize: 34, lineHeight: 41, letterSpacing: track(34, -1.2) },
  hero: { ...fuente('displayBlack'), fontSize: 30, lineHeight: 36, letterSpacing: track(30, -1.2) },
  /** Titulo de pantalla (Large Title compacto). Uno por pantalla, en la cabecera. */
  h1: { ...fuente('displayBlack'), fontSize: 28, lineHeight: 34, letterSpacing: track(28, -1.2) },
  /** Titulo de bloque grande dentro de una pantalla (Title 2). */
  h2: { ...fuente('displayBold'), fontSize: 22, lineHeight: 28, letterSpacing: track(22, -1) },
  /** Titulo de tarjeta o de seccion (Headline). */
  h3: { ...fuente('displaySemi'), fontSize: 17, lineHeight: 22, letterSpacing: track(17, -2.4) },
  /** Titulo de FILA: nombra un elemento de una lista. */
  title: { ...fuente('bodySemi'), fontSize: 16, lineHeight: 21, letterSpacing: track(16, -2) },
  /** Cuerpo (Callout): un punto por debajo del Body de iOS para que las tarjetas densas respiren. */
  body: { ...fuente('bodyMedium'), fontSize: 16, lineHeight: 22, letterSpacing: track(16, -2) },
  bodyStrong: { ...fuente('bodyBold'), fontSize: 16, lineHeight: 22, letterSpacing: track(16, -2) },
  /** Footnote. */
  caption: { ...fuente('bodyMedium'), fontSize: 13, lineHeight: 18, letterSpacing: track(13, -0.6) },
  captionStrong: { ...fuente('bodyBold'), fontSize: 13, lineHeight: 18, letterSpacing: track(13, -0.6) },
  /** Caption 2: etiquetas y estados. */
  micro: { ...fuente('bodyBold'), fontSize: 11, lineHeight: 13, letterSpacing: track(11, 0.6) },
  /**
   * Antetitulo: la cabecera de un grupo, como las de las listas agrupadas de Ajustes. Mayusculas
   * puestas por el componente, no por el texto (el lector de pantalla las deletrearia).
   */
  overline: { ...fuente('bodySemi'), fontSize: 12, lineHeight: 16, letterSpacing: track(12, 3) },
  /** Etiqueta de un control (Subheadline). */
  label: { ...fuente('bodySemi'), fontSize: 14, lineHeight: 19, letterSpacing: track(14, -1.2) },
  /**
   * Importes. Cifras TABULARES: con proporcionales el «1» es mas estrecho que el «8» y una columna
   * de importes baila de fila en fila. En dinero, eso es releer un saldo.
   */
  amountHero: {
    ...fuente('displayBold'),
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: track(40, -1.5),
    fontVariant: ['tabular-nums'] as const,
  },
  amount: {
    ...fuente('displayBold'),
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: track(30, -1.2),
    fontVariant: ['tabular-nums'] as const,
  },
  amountSmall: {
    ...fuente('displaySemi'),
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: track(17, -2.4),
    fontVariant: ['tabular-nums'] as const,
  },
  amountMicro: {
    ...fuente('displaySemi'),
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: track(15, -1.5),
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
  keyboardAppearance: esquema === 'claro' ? 'light' : 'dark',
  selectionColor: color.accent.base,
  cursorColor: color.accent.base,
} as const;

/**
 * Area tactil minima. 44 es el minimo de iOS HIG; 48 el de Material. Se toma 48 para no tener dos
 * criterios distintos segun plataforma.
 */
export const touch = {
  minSize: 48,
  minSpacing: 8,
} as const;

type Sombra = { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number };

/**
 * En oscuro una sombra no separa nada (negro sobre casi negro): la tarjeta se separa por TONO, como
 * en iOS. La sombra queda corta y solo da un poco de peso; el neon del boton se apaga.
 */
const sombrasOscuras: Record<'card' | 'brandGlow' | 'sheet' | 'neon' | 'neonAura', Sombra> = {
  card: { shadowColor: negro, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  brandGlow: { shadowColor: negro, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sheet: { shadowColor: negro, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  neon: { shadowColor: negro, shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  neonAura: { shadowColor: negro, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
};

/**
 * En claro las sombras son CORTAS y casi transparentes, como en iOS: la tarjeta blanca ya se separa
 * del fondo gris por tono, y la sombra solo confirma que esta por encima. Una sombra larga sobre
 * blanco es lo primero que hace que una interfaz se vea «de plantilla». El neon se apaga: un banco
 * no brilla; el boton principal se reconoce por ser el unico solido de color de la pantalla.
 */
const sombrasClaras: typeof sombrasOscuras = {
  card: { shadowColor: negro, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  brandGlow: { shadowColor: color.action.primary, shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sheet: { shadowColor: negro, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  neon: { shadowColor: color.action.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  neonAura: { shadowColor: color.action.primary, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
};

export const shadow = esquema === 'claro' ? sombrasClaras : sombrasOscuras;

/** Luz blanca: brillos, reflejos y barridos. Es luz, no tema: no cambia con el esquema. */
export const luz = { blanco, negro } as const;
