/**
 * La «A» de Atlas en piezas: geometría y degradados, sin ningún componente de la app.
 *
 * Vive aparte de `brand.tsx` para que la puedan dibujar `primitives.tsx` (el cargador) y la marca sin
 * importarse en círculo: `brand.tsx` usa `AtlasText` de `primitives.tsx`.
 */
import { LinearGradient, Stop } from 'react-native-svg';
import { color, marca } from '../theme/tokens';

/**
 * La geometria del SIMBOLO de la marca, por piezas. Sale de `theme/marca.ts › simbolo`: este archivo no
 * dibuja ninguna forma propia. Los nombres (`caraLuz`, `travesano`…) son los de la «A» de Atlas, la
 * primera marca; con otra marca, cada pieza es la que `marca.ts` declare.
 *
 * La letra se parte por su eje en dos caras: la izquierda recibe la luz y la derecha queda en
 * sombra. Es lo que la saca del plano. Con un solo degradado era una silueta recortada en papel, y
 * junto al rotulo se leia como un icono de sistema, no como una marca.
 */
export const LETRA_A = {
  silueta: marca.simbolo.silueta,
  caraLuz: marca.simbolo.luz,
  caraSombra: marca.simbolo.sombra,
  travesano: marca.simbolo.detalle,
  /** El filo que recibe la luz: el borde exterior de la cara izquierda. */
  filo: marca.simbolo.filo,
  /** El canto superior del travesano. */
  cantoTravesano: marca.simbolo.cantoDetalle,
} as const;

/** El `viewBox` del simbolo de la marca. */
export const LIENZO_SIMBOLO = `0 0 ${marca.simbolo.lienzo} ${marca.simbolo.lienzo}`;

/**
 * Los degradados de las caras. `prefijo` hace unicos los `id`: en la web todos los SVG comparten
 * documento, y dos degradados con el mismo `id` y distinto contenido se pisan.
 */
export function DegradadosLetraA({ prefijo }: { prefijo: string }) {
  return (
    <>
      <LinearGradient id={`${prefijo}-luz`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color.brand.b300} />
        <Stop offset="1" stopColor={color.brand.b400} />
      </LinearGradient>
      <LinearGradient id={`${prefijo}-sombra`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={color.brand.b500} />
        <Stop offset="1" stopColor={color.brand.b700} />
      </LinearGradient>
      {/* El travesano cruza de la luz a la sombra, como las dos caras que une. */}
      <LinearGradient id={`${prefijo}-travesano`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={color.brand.b400} />
        <Stop offset="0.5" stopColor={color.brand.b500} />
        <Stop offset="1" stopColor={color.brand.b700} />
      </LinearGradient>
    </>
  );
}
