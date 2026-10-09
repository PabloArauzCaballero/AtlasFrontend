/**
 * LA MARCA. El unico archivo que se edita para cambiar de marca.
 *
 * Todo lo demas —los dos temas, los contrastes, las rampas de las ilustraciones, la hoja web, la
 * barra de estado— se DERIVA de estos valores en `temas.ts`. El procedimiento completo para cambiar
 * de marca (colores, logotipo, nombre, iconos de la tienda) esta en `docs/marca-y-temas.md`.
 *
 * Reglas para elegir los valores:
 * - `principal` es el color de la ACCION: el boton que manda en cada pantalla. Suele ser el color
 *   mas institucional de la marca (el navy de un banco, el rojo de una aerolinea). Se usa tal cual
 *   en claro si deja leer texto blanco encima (4,5:1); si no, el motor lo oscurece lo justo.
 * - `acento` es el color que SIGNIFICA algo: progreso, seleccion, enlace, logro. Puede ser el mismo
 *   que `principal` si la marca tiene un solo color.
 * - Los grises NO son de la marca: son neutros de sistema a proposito. Una interfaz seria lleva un
 *   solo color con intencion; los grises tintados hacen que todo parezca «coloreado».
 * - No hace falta comprobar contrastes a mano: el motor los corrige y `temas-contraste.test.ts` falla
 *   si algun rol no llega.
 */
export const marca = {
  nombre: 'Atlas',
  /** Navy institucional: la accion principal. */
  principal: '#0B2545',
  /** Teal de la marca: lo que significa algo. */
  acento: '#0E7C7B',
  /**
   * Tipografia. `null` = la del sistema (SF Pro en iPhone, Roboto en Android), que es la opcion
   * recomendada para una interfaz sobria. Una marca con fuente propia la declara aqui por grosor,
   * cargada en `app/_layout.tsx` (ver `docs/marca-y-temas.md`).
   */
  tipografia: {
    texto: null as null | { regular: string; medio: string; semi: string; negrita: string },
    titulares: null as null | { semi: string; negrita: string },
    /** El logotipo escrito (la palabra de la marca). */
    logotipo: 'Sora_800ExtraBold',
  },
} as const;
