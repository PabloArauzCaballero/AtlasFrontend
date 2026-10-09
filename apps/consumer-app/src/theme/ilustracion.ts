/**
 * Colores de ILUSTRACION: piel, pelo, ojos, el carnet de plastico, la mano de «toca aqui».
 *
 * Son OBJETOS dibujados, no interfaz (igual que `metal`): no cambian con el tema, como una foto no
 * cambia con el modo oscuro. Lo que en un dibujo SI depende del tema (el fondo de la ficha, la marca,
 * el contorno que lo separa del fondo) sale de `color`.
 */
export const ilustracion = {
  /** Piel clara: luz arriba a la izquierda, sombra y el trazo del borde. */
  piel: { luz: '#F8DCC6', media: '#E9B895', sombra: '#C98D68', borde: '#A9693F' },
  /** La misma piel apagada por un contraluz. */
  pielOscura: { luz: '#A58B7E', media: '#86695B', sombra: '#5A463D', borde: '#3D2F29' },
  pelo: { luz: '#7A5C47', medio: '#4A3527', oscuro: '#241A14' },
  ojo: { blanco: '#F6F2EC', iris: ['#9A744D', '#5B3F27', '#2E1D10'] as const, pupila: '#0F0A07', parpado: '#2F2018' },
  boca: { labio: '#C06E66', inferior: ['#C97A6E', '#A85C56'] as const, comisura: '#7E403C' },
  rubor: '#F08A7A',
  /** Lentes oscuros: el cristal en degradado y la montura. */
  lentes: { luz: '#3A4250', sombra: '#07090C', montura: '#06080B' },
  /** El carnet: plastico blanco que se enfria hacia la esquina, holograma violeta y chip dorado. */
  carnet: {
    cuerpo: ['#FFFFFF', '#EDF3F9', '#94A8BF'] as const,
    holograma: '#B9A4FF',
    chip: ['#F2D98D', '#D9AE4E', '#B8862E'] as const,
    chipGrabado: '#8C6620',
    /** El velo de una foto tomada con poca luz. */
    penumbra: '#061426',
  },
  /** La mano de «toca aqui»: blanca con sombras menta. */
  mano: {
    luz: '#FFFFFF',
    menta: '#E6FAF2',
    sombra: '#9ADBC4',
    ladoDedo: '#A9E2CF',
    sombraDedo: '#9FDCC6',
    yema: '#B7EAD8',
    pliegue: '#8CD3BA',
  },
} as const;
