/**
 * Paleta CRUDA de ATLAS: los valores, sin rol.
 *
 * Solo la leen los temas (`temas.ts`). Una pantalla o una primitiva nunca importa de aqui: consume
 * `color` desde `tokens.ts`, que nombra el ROL (fondo, texto, accion) y no el tono. Hay una prueba
 * (`__tests__/sin-colores-sueltos.test.ts`) que falla si un archivo fuera de `src/theme/` escribe un
 * color literal o importa la paleta.
 */

/** La rampa de marca: navy profundo y el degradado teal -> menta de la identidad publicada. */
export const marca = {
  navy: '#0C2C50',
  navyProfundo: '#081F3A',
  b900: '#052033',
  b700: '#0E7377',
  b600: '#0B6B6E',
  b500: '#14A894',
  b400: '#2BE0A8',
  b300: '#5CF0CC',
  tint: '#7FEFD6',
} as const;

/**
 * Neutros CLAROS, al estilo de los grises de sistema de iOS.
 *
 * Neutros de verdad, sin tinte azul: en una interfaz de banco el color es SENAL, y un gris tintado
 * convierte cada pantalla en «coloreada» sin que nadie haya elegido un color (la misma decision que
 * el Motor tomo en su `theme.css`).
 */
export const neutroClaro = {
  fondo: '#F2F2F7',
  fondoHundido: '#F4F4F7',
  superficie: '#FFFFFF',
  superficie2: '#FAFAFC',
  tinta1: '#0B0D12',
  /** 7,2:1 sobre blanco y 6,5:1 sobre el fondo agrupado. */
  tinta2: '#55575E',
  /** 5,2:1 sobre blanco y 4,6:1 sobre el fondo agrupado: el minimo AA en la peor superficie. */
  tinta3: '#6B6D74',
  /** Ejemplo dentro de un campo vacio: legible, pero sin competir con un dato. */
  tinta4: '#8E9097',
  /** Contorno de un control: 3,6:1 sobre blanco y 3,2:1 sobre el fondo (WCAG 1.4.11). */
  contornoControl: '#86868D',
  /** El gris de los separadores de iOS (`separator`), en RGB para mezclar con alfa. */
  separador: '#3C3C43',
  /** El gris de los rellenos de iOS (`systemFill`), en RGB para mezclar con alfa. */
  relleno: '#767680',
} as const;

/** Neutros OSCUROS: el navy de la identidad original. Se conservan enteros en el tema oscuro. */
export const neutroOscuro = {
  fondo: '#061426',
  fondoElevado: '#0A1C33',
  hoja: '#0B2138',
  tarjeta: '#0B1E36',
  tinta1: '#EDF3F9',
  tinta2: '#94A8BF',
  tinta3: '#7489A6',
  tinta4: '#41546E',
} as const;

/** Estados en claro: todos pasan 4,5:1 sobre blanco y sobre el fondo agrupado. */
export const estadoClaro = {
  exito: '#17784A',
  aviso: '#9A5800',
  peligro: '#C0362C',
  peligroFuerte: '#9E2A22',
  info: '#0B6B6E',
} as const;

export const estadoOscuro = {
  exito: '#2BE0A8',
  aviso: '#FFC46B',
  peligro: '#FF8A8A',
  peligroFuerte: '#B23A3A',
  info: '#7FEFD6',
} as const;

/**
 * Metales de los logros (trofeos, medallas, chip de la tarjeta). Son OBJETOS ilustrados, no
 * interfaz: no cambian con el tema, igual que una foto no cambia con el modo oscuro.
 */
export const metal = {
  bronce: { luz: '#F6C79B', medio: '#C9834B', sombra: '#7A4522', halo: '#E19A5C', tinta: '#3B1F0C' },
  plata: { luz: '#FFFFFF', medio: '#C3CEDB', sombra: '#6E7D91', halo: '#D5E1EE', tinta: '#253244', extra: '#9FB4CC' },
  oro: { luz: '#FFF4B8', medio: '#F2C14E', sombra: '#9A6A12', halo: '#FFD36A', tinta: '#3D2A04', extra: '#FFB020' },
  platino: { luz: '#F2FFFC' },
  diamante: { luz: '#F4FBFF', medio: '#8FD8FF', sombra: '#4B4FD6', halo: '#8FB8FF', tinta: '#0B1B4D', violeta: '#C7A6FF', rosa: '#FF9EE0' },
  /** El chip dorado de la tarjeta ATLAS. */
  chip: { claro: '#F6E3A1', medio: '#D9B45A', brillo: '#F2D98C', oscuro: '#A9802F', grabado: '#8C6A24' },
} as const;

/** Colores de terceros que no son nuestros y no se tematizan. */
export const terceros = {
  whatsapp: '#128C7E',
} as const;

export const blanco = '#FFFFFF';
export const negro = '#000000';
