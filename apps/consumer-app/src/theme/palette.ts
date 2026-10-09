/**
 * Valores CRUDOS que no son de la marca ni del tema: los metales de los logros, los colores de
 * terceros y la luz. La marca vive en `marca.ts`; los roles de interfaz, en `temas.ts`.
 *
 * Una pantalla o una primitiva nunca importa de aqui: consume `color` desde `tokens.ts`. La prueba
 * `__tests__/sin-colores-sueltos.test.ts` falla si un archivo fuera de `src/theme/` escribe un color
 * literal o importa la paleta.
 */

/**
 * Metales de los logros (trofeos, medallas, chip de la tarjeta). Son OBJETOS ilustrados, no
 * interfaz: no cambian con el tema ni con la marca, igual que una foto no cambia con el modo oscuro.
 */
export const metal = {
  bronce: { luz: '#F6C79B', medio: '#C9834B', sombra: '#7A4522', halo: '#E19A5C', tinta: '#3B1F0C' },
  plata: { luz: '#FFFFFF', medio: '#C3CEDB', sombra: '#6E7D91', halo: '#D5E1EE', tinta: '#253244', extra: '#9FB4CC' },
  oro: { luz: '#FFF4B8', medio: '#F2C14E', sombra: '#9A6A12', halo: '#FFD36A', tinta: '#3D2A04', extra: '#FFB020' },
  platino: { luz: '#F2FFFC' },
  diamante: { luz: '#F4FBFF', medio: '#8FD8FF', sombra: '#4B4FD6', halo: '#8FB8FF', tinta: '#0B1B4D', violeta: '#C7A6FF', rosa: '#FF9EE0' },
  /** El chip dorado de la tarjeta. */
  chip: { claro: '#F6E3A1', medio: '#D9B45A', brillo: '#F2D98C', oscuro: '#A9802F', grabado: '#8C6A24' },
} as const;

/** Colores de terceros que no son nuestros y no se tematizan. */
export const terceros = {
  whatsapp: '#128C7E',
} as const;

export const blanco = '#FFFFFF';
export const negro = '#000000';
