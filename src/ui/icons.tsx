/**
 * Iconografia de ATLAS.
 *
 * ## Por que un set propio y no una libreria
 *
 * Material e Ionicons son excelentes y se reconocen al instante… porque estan en todas partes. Un
 * producto financiero que quiere parecerse a si mismo no puede tomar prestada la voz grafica de
 * Google. Ademas cada libreria trae su propia rejilla, su propio grosor y sus propios remates, y en
 * cuanto conviven dos la barra de pestanas empieza a verse como un collage.
 *
 * Aqui todos los iconos comparten una sola rejilla de 24, un grosor de trazo y unos remates
 * redondeados que se corresponden con la curvatura de Sora. Ese acuerdo es lo que hace que un icono
 * junto a un titular parezca de la misma familia y no una pegatina encima.
 *
 * ## El grosor no se escala con el tamano
 *
 * `strokeWidth` se compensa contra `size` para que el trazo mida lo mismo en pantalla a 18 que a 28.
 * Sin esa compensacion, el icono pequeno se ve fino y desvaido y el grande se ve gordo, que es el
 * error mas comun al reutilizar SVG a varios tamanos.
 *
 * ## Sobre accesibilidad
 *
 * Un icono no es informacion por si mismo. Van marcados como decorativos salvo que se les pase
 * `label`: lo que el lector de pantalla debe anunciar es la accion, y esa vive en el control que lo
 * contiene, no en el dibujo.
 */
import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg';
import { color } from '../theme/tokens';

/** Rejilla comun. Cambiarla obliga a redibujar todo: es el contrato del set. */
const GRID = 24;
/** Grosor de referencia sobre la rejilla de 24. */
const STROKE = 1.75;

export type IconName =
  | 'inicio'
  | 'escanear'
  | 'pagos'
  | 'perfil'
  | 'atras'
  | 'adelante'
  | 'check'
  | 'alerta'
  | 'reloj'
  | 'candado'
  | 'escudo'
  | 'camara'
  | 'documento'
  | 'editar'
  | 'ayuda'
  | 'salir'
  | 'copiar'
  | 'ubicacion'
  | 'billetera'
  | 'chispa'
  | 'refrescar';

export type IconProps = {
  name: IconName;
  size?: number;
  /** Color del trazo. Por defecto sigue al texto secundario para no gritar mas que su etiqueta. */
  tint?: string;
  /** Texto para el lector de pantalla. Sin el, el icono se anuncia como decorativo. */
  label?: string;
};

/**
 * Trazados. Coordenadas sobre la rejilla de 24, sin relleno y con las uniones redondeadas.
 *
 * Se dibujan con la menor cantidad de trazos que conserva el significado: a 22 px de alto, cada
 * detalle de mas se convierte en ruido antes que en informacion.
 */
const PATHS: Record<IconName, (stroke: string, width: number) => React.ReactNode> = {
  // Casa: el techo y la puerta. Nada de ventanas: desaparecen al tamano real.
  inicio: (s, w) => (
    <>
      <Path d="M3.5 10.2 12 3.8l8.5 6.4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M9.5 20.5v-5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.2" stroke={s} strokeWidth={w} strokeLinejoin="round" />
    </>
  ),
  // Escaner: las cuatro esquinas del visor y la linea de lectura. Es el gesto, no el aparato.
  escanear: (s, w) => (
    <>
      <Path d="M3.5 8.5v-3a2 2 0 0 1 2-2h3M15.5 3.5h3a2 2 0 0 1 2 2v3M20.5 15.5v3a2 2 0 0 1-2 2h-3M8.5 20.5h-3a2 2 0 0 1-2-2v-3" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.5 12h17" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Calendario de cuotas: la hoja y tres marcas. Las marcas son las cuotas, no adorno.
  pagos: (s, w) => (
    <>
      <Rect x={3.5} y={5.5} width={17} height={15} rx={2.5} stroke={s} strokeWidth={w} />
      <Path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M8 14.5h2M14 14.5h2M8 17.5h2" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  perfil: (s, w) => (
    <>
      <Circle cx={12} cy={8.5} r={3.75} stroke={s} strokeWidth={w} />
      <Path d="M4.5 20.5c0-3.6 3.4-5.75 7.5-5.75s7.5 2.15 7.5 5.75" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  atras: (s, w) => <Path d="M14.5 5 8 12l6.5 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  adelante: (s, w) => <Path d="M9.5 5 16 12l-6.5 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  check: (s, w) => <Path d="M5 12.8 9.7 17.5 19 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  alerta: (s, w) => (
    <>
      <Path d="M12 3.8 21.5 20a1 1 0 0 1-.87 1.5H3.37A1 1 0 0 1 2.5 20z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M12 9.5v5" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={18} r={0.9} fill={s} />
    </>
  ),
  reloj: (s, w) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={s} strokeWidth={w} />
      <Path d="M12 7v5.3l3.4 2" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  candado: (s, w) => (
    <>
      <Rect x={4.5} y={10.5} width={15} height={10} rx={2.5} stroke={s} strokeWidth={w} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  escudo: (s, w) => (
    <>
      <Path d="M12 3 19.5 6v6c0 4.4-3 7.7-7.5 9.2C7.5 19.7 4.5 16.4 4.5 12V6z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M9 12.2 11.3 14.5 15.4 10" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  camara: (s, w) => (
    <>
      <Path d="M3.5 8.8a2 2 0 0 1 2-2h1.9l1.3-2.1a1 1 0 0 1 .85-.47h4.9a1 1 0 0 1 .85.47l1.3 2.1h1.9a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={12} cy={13.2} r={3.6} stroke={s} strokeWidth={w} />
    </>
  ),
  documento: (s, w) => (
    <>
      <Path d="M6.5 3.5h7L19.5 9v11.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M13.5 3.5V9h6M9 13.5h6M9 17h4" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  editar: (s, w) => (
    <>
      <Path d="M15.6 4.9a2.1 2.1 0 0 1 3 3L9.7 16.8l-4 1 1-4z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M4.5 21h15" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  ayuda: (s, w) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={s} strokeWidth={w} />
      <Path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={16.4} r={0.9} fill={s} />
    </>
  ),
  salir: (s, w) => (
    <>
      <Path d="M14.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h8.5" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M16 8.5 19.5 12 16 15.5M19.5 12H9.5" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  copiar: (s, w) => (
    <>
      <Rect x={8.5} y={8.5} width={12} height={12} rx={2} stroke={s} strokeWidth={w} />
      <Path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  ubicacion: (s, w) => (
    <>
      <Path d="M12 21.2c4-4 6-7.1 6-9.7a6 6 0 1 0-12 0c0 2.6 2 5.7 6 9.7z" stroke={s} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={12} cy={11.2} r={2.4} stroke={s} strokeWidth={w} />
    </>
  ),
  billetera: (s, w) => (
    <>
      <Rect x={3.5} y={6.5} width={17} height={13} rx={2.5} stroke={s} strokeWidth={w} />
      <Path d="M3.5 10.5h17" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={16.5} cy={15} r={1.2} fill={s} />
    </>
  ),
  // Destello de cuatro puntas: lo nuevo, lo aprobado, lo que merece mirarse.
  chispa: (s, w) => (
    <Path
      d="M12 3.5c.5 4 1.5 5 5.5 5.5-4 .5-5 1.5-5.5 5.5-.5-4-1.5-5-5.5-5.5 4-.5 5-1.5 5.5-5.5zM18 15c.25 2 .75 2.5 2.75 2.75-2 .25-2.5.75-2.75 2.75-.25-2-.75-2.5-2.75-2.75 2-.25 2.5-.75 2.75-2.75z"
      stroke={s}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  refrescar: (s, w) => (
    <>
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M20.5 3.5v4.2h-4.2" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function Icon({ name, size = 22, tint = color.text.secondary, label }: IconProps) {
  // El grosor se compensa contra el tamano para que el trazo mida lo mismo en pantalla a cualquier
  // escala. Sin esto, el icono pequeno adelgaza y el grande engorda.
  const width = (STROKE * GRID) / size;
  const props: SvgProps = {
    width: size,
    height: size,
    viewBox: `0 0 ${GRID} ${GRID}`,
    fill: 'none',
    accessibilityRole: label ? 'image' : undefined,
    accessibilityLabel: label,
    accessibilityElementsHidden: !label,
    importantForAccessibility: label ? 'yes' : 'no-hide-descendants',
  };
  return <Svg {...props}>{PATHS[name](tint, width)}</Svg>;
}
