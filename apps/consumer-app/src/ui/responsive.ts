/**
 * Los tres anchos en los que vive la app, con nombre.
 *
 * En el teléfono no hay decisión: la pantalla es la pantalla. En el navegador la misma app se abre
 * en una ventana de 1.400 px, y ahí hay que decidir QUÉ cambia. La respuesta es: lo menos posible.
 * El contenido sigue siendo la columna de lectura que ya limita `Screen` (560 px); lo que se
 * reparte de otra manera es lo que rodea a esa columna: la barra de pestañas, que en escritorio
 * pasa a un carril lateral, y las hojas, que en vez de subir desde el borde de abajo se centran.
 *
 * Tres tramos y sólo tres, con nombre y no con números sueltos por las pantallas: si mañana el
 * tramo de tableta empieza en 640 en vez de 600, se cambia aquí y no en veinte sitios. La hoja de
 * estilo web (`web/estilo.ts`) genera sus `@media` desde estos mismos números, y `Appear` y la
 * bienvenida preguntan por el tramo en vez de comparar con un literal.
 */
import { useWindowDimensions } from 'react-native';

export type Tramo = 'telefono' | 'tableta' | 'escritorio';

export const TRAMO = {
  /** Desde aquí la ventana ya no es un teléfono: hay aire a los lados de la columna. */
  tableta: 600,
  /**
   * Desde aquí cabe la SEGUNDA columna del acceso y del registro (la tarjeta 3D, la cita y los
   * pasos) sin robarle ancho al formulario. No es un tramo con nombre porque no cambia nada más.
   */
  panelLateral: 940,
  /** Desde aquí cabe un carril de navegación al lado del contenido sin robarle ancho. */
  escritorio: 1024,
} as const;

/** Ancho de la columna de contenido; el mismo que `Screen` ya aplica como `maxWidth`. */
export const ANCHO_COLUMNA = 560;

/** Ancho de la rejilla de escritorio (la de la landing): a partir de aquí sólo crece el aire. */
export const ANCHO_REJILLA = 1220;

/** Ancho del carril lateral de pestañas en escritorio. */
export const ANCHO_CARRIL = 220;

export function tramoPara(ancho: number): Tramo {
  if (ancho >= TRAMO.escritorio) return 'escritorio';
  if (ancho >= TRAMO.tableta) return 'tableta';
  return 'telefono';
}

export function useTramo(): Tramo {
  const { width } = useWindowDimensions();
  return tramoPara(width);
}

/**
 * Ancho útil para una pantalla que se dibuja por PÁGINAS (la bienvenida): la columna de lectura o
 * la ventana entera, lo que sea menor. Se lee de `useWindowDimensions` y no de `Dimensions.get`
 * porque en el navegador la ventana cambia de tamaño sin que la app se reinicie.
 */
export function useAnchoDeColumna(): number {
  const { width } = useWindowDimensions();
  return Math.min(width, ANCHO_COLUMNA);
}
