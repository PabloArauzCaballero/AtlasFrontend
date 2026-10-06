/**
 * La «A» de Atlas en piezas: geometría y degradados, sin ningún componente de la app.
 *
 * Vive aparte de `brand.tsx` para que la puedan dibujar `primitives.tsx` (el cargador) y la marca sin
 * importarse en círculo: `brand.tsx` usa `AtlasText` de `primitives.tsx`.
 */
import { LinearGradient, Stop } from 'react-native-svg';
import { palette } from '../theme/tokens';

/**
 * La geometria de la «A», en unidades de un `viewBox` de 48 x 48. La leen la marca de aqui y la
 * secuencia de arranque (`splash.tsx`), que la dibuja por partes.
 *
 * La letra se parte por su eje en dos caras: la izquierda recibe la luz y la derecha queda en
 * sombra. Es lo que la saca del plano. Con un solo degradado era una silueta recortada en papel, y
 * junto al rotulo se leia como un icono de sistema, no como una marca.
 */
export const LETRA_A = {
  silueta: 'M24 5 L43 43 H34 L24 21 L14 43 H5 Z',
  caraLuz: 'M24 5 L24 21 L14 43 H5 Z',
  caraSombra: 'M24 5 L43 43 H34 L24 21 Z',
  travesano: 'M17.5 31 H30.5 L34 38 H14 Z',
  /** El filo que recibe la luz: el borde exterior de la cara izquierda. */
  filo: 'M5 43 L24 5',
  /** El canto superior del travesano. */
  cantoTravesano: 'M17.5 31 H30.5',
} as const;

/**
 * Los degradados de las caras. `prefijo` hace unicos los `id`: en la web todos los SVG comparten
 * documento, y dos degradados con el mismo `id` y distinto contenido se pisan.
 */
export function DegradadosLetraA({ prefijo }: { prefijo: string }) {
  return (
    <>
      <LinearGradient id={`${prefijo}-luz`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.brand300} />
        <Stop offset="1" stopColor={palette.brand400} />
      </LinearGradient>
      <LinearGradient id={`${prefijo}-sombra`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.brand500} />
        <Stop offset="1" stopColor={palette.brand700} />
      </LinearGradient>
      {/* El travesano cruza de la luz a la sombra, como las dos caras que une. */}
      <LinearGradient id={`${prefijo}-travesano`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={palette.brand400} />
        <Stop offset="0.5" stopColor={palette.brand500} />
        <Stop offset="1" stopColor={palette.brand700} />
      </LinearGradient>
    </>
  );
}
