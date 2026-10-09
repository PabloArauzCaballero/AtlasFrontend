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
  /** La frase bajo el logotipo en el acceso. `null` si la marca no lleva. */
  eslogan: 'Compra hoy, paga después' as string | null,
  /**
   * El SIMBOLO de la marca, en trazados SVG sobre un lienzo de `lienzo` x `lienzo`. Lo dibujan el logotipo, el
   * arranque, el corte de marca, el cargador, la tarjeta y la web: cambiarlo aqui lo cambia en todos.
   *
   * Se describe por PIEZAS para que el arranque pueda darle volumen y animarlo:
   * - `silueta`: la forma entera de una pieza. Es la que se usa para cortes, zooms y versiones planas.
   * - `luz` / `sombra`: las dos caras con las que se le da relieve (la que recibe la luz y la que no). Un simbolo plano
   *   pone la silueta entera en `luz` y deja `sombra` vacia.
   * - `detalle`: una pieza que se pinta encima con su propio tono (el travesano de la «A»). Vacia si no hay.
   * - `filo` / `cantoDetalle`: trazos finos de luz sobre el borde. Vacios si no hay.
   * El simbolo de una marca nueva se obtiene de su SVG: se reescala a este lienzo y se separan sus piezas.
   */
  simbolo: {
    lienzo: 48,
    silueta: 'M24 5 L43 43 H34 L24 21 L14 43 H5 Z',
    luz: 'M24 5 L24 21 L14 43 H5 Z',
    sombra: 'M24 5 L43 43 H34 L24 21 Z',
    detalle: 'M17.5 31 H30.5 L34 38 H14 Z',
    filo: 'M5 43 L24 5',
    cantoDetalle: 'M17.5 31 H30.5',
    /**
     * El perimetro de `silueta`, en unidades del lienzo: el arranque dibuja el simbolo trazo a trazo con un guion de
     * este largo. `scripts/generar-icono-arranque.mjs` lo mide y lo imprime al cambiar de simbolo.
     */
    contorno: 152,
  },
  /** Navy institucional: la accion principal. */
  principal: '#0B2545',
  /** Teal de la marca: lo que significa algo. */
  acento: '#0E7C7B',
  /**
   * Tipografia. `null` = la del sistema (SF Pro en iPhone, Roboto en Android), que es la opcion
   * recomendada para una interfaz sobria. Una marca con fuente propia la declara aqui por grosor,
   * cargada en `app/_layout.tsx` (ver `docs/marca-y-temas.md`).
   */
  /**
   * La PERSONALIDAD visual, independiente de los colores.
   * - `brillo` (0 a 1): cuanto «emite luz» la interfaz — halos de las perillas de progreso, el aura del boton
   *   principal, las particulas de las ilustraciones, el reflejo de cristal de los botones. 0 es sobrio (un banco); 1 es
   *   la identidad luminosa original de Atlas. Las ANIMACIONES no cambian con esto: solo cuanto brilla lo que se mueve.
   */
  estilo: {
    brillo: 0,
  },
  tipografia: {
    texto: null as null | { regular: string; medio: string; semi: string; negrita: string },
    titulares: null as null | { semi: string; negrita: string },
    /** El logotipo escrito (la palabra de la marca), cargado en `app/_layout.tsx`. `null` = la del sistema. */
    logotipo: 'Sora_800ExtraBold' as string | null,
  },
} as const;
