/**
 * Materiales de los OBJETOS ilustrados (pedestal del trofeo, caras de medalla, la carta de insignia).
 *
 * Igual que `metal`, no son interfaz: no cambian con el tema, como una foto no cambia con el modo
 * oscuro. Se nombran por el ROL dentro del objeto, no por el tono.
 */
export const objeto = {
  /** La base oscura sobre la que se apoya el trofeo. */
  pedestal: { claro: '#1E2C40', oscuro: '#0A1424' },
  /** El fondo profundo de una cara de medalla o del arte de una carta. */
  fondoProfundo: '#050B16',
  /** El interior del escudo de nivel, al pie del degradado. */
  escudoInterior: '#050C18',
  /** La carta de insignia: arte, cara, rotulo apagado y su tinta. */
  carta: {
    arte: '#071426',
    cara: { arriba: '#0C1B30', abajo: '#08111F' },
    rotuloApagado: { borde: '#16263D', centro: '#22364F' },
    tintaApagada: '#C9D6E8',
    /**
     * Las tintas del texto DENTRO de la carta. La carta es un objeto oscuro en los dos temas, así que no puede usar las
     * tintas del tema: en claro salían casi negras sobre azul noche (el «6 de 12» del avance no se veía). Medidas contra
     * `cara.arriba`: primaria 15:1, secundaria 9:1, terciaria 5,6:1.
     */
    tinta: { primaria: '#F3F6FB', secundaria: '#BAC6D8', terciaria: '#91A0B6' },
    /** El carril de la barra de avance dentro de la carta. */
    pista: '#1C2C45',
  },
  /** Las caras metalizadas de la medalla de riesgo y la tinta de su letra. */
  riesgo: {
    marca: { cara: { luz: '#7DF6D8', sombra: '#0E8C7B' } },
    alerta: { cara: { luz: '#FFE0A6', sombra: '#C9862A' } },
    tinta: '#05223A',
  },
} as const;
