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
import { color, palette } from '../theme/tokens';
import { VidaDeIcono } from './icon-vivo';

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
  // La ayuda de un CAMPO. `ayuda` es la interrogacion del soporte —«tengo una duda»—; esta es la
  // «i» de «esto es lo que hay que poner aqui», que es otra cosa y va en otro sitio.
  | 'info'
  | 'salir'
  | 'copiar'
  | 'ubicacion'
  | 'billetera'
  | 'chispa'
  // El asistente de la app: la burbuja de chat con la chispa dentro. `ayuda` es la interrogación
  // del soporte estático y `chispa` la magia suelta; este es «escríbeme y te contesto al momento».
  | 'asistente'
  | 'refrescar'
  // Rubros de comercio. Uno por categoria del expediente del partner, y `comercio` para lo que no
  // encaje: un rubro sin icono propio es mejor con la tienda generica que con el de otro rubro.
  | 'educacion'
  | 'electronica'
  | 'celulares'
  | 'ropa'
  | 'hogar'
  | 'salud'
  | 'supermercado'
  | 'transporte'
  | 'servicios'
  | 'comercio'
  // Controles de las pantallas de gasto y pagos.
  | 'grafico'
  | 'filtro'
  | 'lista'
  | 'cuadricula'
  | 'descargar'
  | 'tendencia'
  | 'etiqueta'
  | 'estrella'
  // Mostrar y ocultar lo que se escribe en un campo protegido.
  | 'ojo'
  | 'ojo-tachado'
  // Correo. El documento generico servia de relleno y no dice «correo» a nadie.
  | 'sobre'
  // Telefono. La chincheta de mapa decia «donde vives», que es otro dato distinto del perfil.
  | 'telefono'
  | 'enviar'
  | 'cerrar'
  | 'clip'
  | 'chat'
  | 'galeria'
  | 'papelera';

/** Opacidad del relleno suave de la forma principal en un icono de dos tonos. Sutil a propósito: da cuerpo sin teñir. */
const RELLENO = 0.16;
/**
 * El acento de un icono de dos tonos, si no se pide otro: el ámbar de la marca.
 *
 * No el menta: el trazo YA es menta, y un acento del mismo color no se distingue (se probó: el detalle se perdía y el icono
 * parecía de un solo tono). El ámbar contrasta con el menta y con el fondo oscuro, y se lee como el brillo de una moneda.
 */
const ACENTO = palette.warning;

/** Lo que cada dibujo necesita saber para pintarse en uno o en dos tonos. */
type Dibujo = {
  /** Color del rasgo que da carácter (con `duo` es el acento; sin `duo` es el mismo trazo). */
  a: string;
  /** Opacidad del relleno suave (0 sin `duo`). */
  f: number;
  /** Con vida: algunos iconos ceden una parte a una animación propia (la línea del escáner). */
  vivo: boolean;
};

export type IconProps = {
  name: IconName;
  size?: number;
  /** Color del trazo. Por defecto sigue al texto secundario para no gritar mas que su etiqueta. */
  tint?: string;
  /** Texto para el lector de pantalla. Sin el, el icono se anuncia como decorativo. */
  label?: string;
  /**
   * Dos tonos: relleno suave en la forma principal, un rasgo en el color de acento y un destello en la esquina.
   * Para iconos protagonistas (chips, pestaña activa); en un botón o junto a un texto, sobrio.
   */
  duo?: boolean;
  /** Con vida: el icono se mueve solo, a su manera (ver `icon-vivo.tsx`). Quieto con «reducir movimiento». */
  vivo?: boolean;
  /** Color del acento de `duo`. Por defecto, el menta de la marca. */
  acento?: string;
};

/**
 * Trazados. Coordenadas sobre la rejilla de 24, sin relleno y con las uniones redondeadas.
 *
 * Se dibujan con la menor cantidad de trazos que conserva el significado: a 22 px de alto, cada
 * detalle de mas se convierte en ruido antes que en informacion.
 */
const PATHS: Record<IconName, (stroke: string, width: number, d: Dibujo) => React.ReactNode> = {
  // Casa: el techo y la puerta. Nada de ventanas: desaparecen al tamano real.
  inicio: (s, w, d) => (
    <>
      <Path d="M3.5 10.2 12 3.8l8.5 6.4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M9.5 20.5v-5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.2" stroke={d.a} strokeWidth={w} strokeLinejoin="round" />
    </>
  ),
  // Escaner: las cuatro esquinas del visor y la linea de lectura. Es el gesto, no el aparato.
  escanear: (s, w, d) => (
    <>
      <Path d="M3.5 8.5v-3a2 2 0 0 1 2-2h3M15.5 3.5h3a2 2 0 0 1 2 2v3M20.5 15.5v3a2 2 0 0 1-2 2h-3M8.5 20.5h-3a2 2 0 0 1-2-2v-3" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      {d.vivo ? null : <Path d="M3.5 12h17" stroke={d.a} strokeWidth={w} strokeLinecap="round" />}
    </>
  ),
  // Calendario de cuotas: la hoja y tres marcas. Las marcas son las cuotas, no adorno.
  pagos: (s, w, d) => (
    <>
      <Rect x={3.5} y={5.5} width={17} height={15} rx={2.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M8 14.5h2M14 14.5h2M8 17.5h2" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  perfil: (s, w, d) => (
    <>
      <Circle cx={12} cy={8.5} r={3.75} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M4.5 20.5c0-3.6 3.4-5.75 7.5-5.75s7.5 2.15 7.5 5.75" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  atras: (s, w, d) => <Path d="M14.5 5 8 12l6.5 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  adelante: (s, w, d) => <Path d="M9.5 5 16 12l-6.5 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  check: (s, w, d) => <Path d="M5 12.8 9.7 17.5 19 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  alerta: (s, w, d) => (
    <>
      <Path d="M12 3.8 21.5 20a1 1 0 0 1-.87 1.5H3.37A1 1 0 0 1 2.5 20z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M12 9.5v5" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={18} r={0.9} fill={s} />
    </>
  ),
  reloj: (s, w, d) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M12 7v5.3l3.4 2" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  candado: (s, w, d) => (
    <>
      <Rect x={4.5} y={10.5} width={15} height={10} rx={2.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  escudo: (s, w, d) => (
    <>
      <Path d="M12 3 19.5 6v6c0 4.4-3 7.7-7.5 9.2C7.5 19.7 4.5 16.4 4.5 12V6z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M9 12.2 11.3 14.5 15.4 10" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  camara: (s, w, d) => (
    <>
      <Path d="M3.5 8.8a2 2 0 0 1 2-2h1.9l1.3-2.1a1 1 0 0 1 .85-.47h4.9a1 1 0 0 1 .85.47l1.3 2.1h1.9a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={12} cy={13.2} r={3.6} stroke={d.a} strokeWidth={w} />
    </>
  ),
  documento: (s, w, d) => (
    <>
      <Path d="M6.5 3.5h7L19.5 9v11.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M13.5 3.5V9h6M9 13.5h6M9 17h4" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  editar: (s, w, d) => (
    <>
      <Path d="M15.6 4.9a2.1 2.1 0 0 1 3 3L9.7 16.8l-4 1 1-4z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M4.5 21h15" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  ayuda: (s, w, d) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={16.4} r={0.9} fill={s} />
    </>
  ),
  /*
    La «i» dentro del circulo, sobre la MISMA rejilla de 24 y el mismo radio de 8.5 que `ayuda`.

    El punto va arriba y el asta abajo —al reves que la interrogacion, que tiene el gancho arriba y
    el punto abajo—: es lo unico que distingue los dos iconos de un vistazo a 18 px, y por eso el
    radio del punto y el grosor del asta son los mismos que alli.
  */
  info: (s, w, d) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Circle cx={12} cy={8.2} r={0.9} fill={s} />
      <Path d="M12 11.4v5" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  salir: (s, w, d) => (
    <>
      <Path d="M14.5 3.5H6a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 6 20.5h8.5" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M16 8.5 19.5 12 16 15.5M19.5 12H9.5" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  copiar: (s, w, d) => (
    <>
      <Rect x={8.5} y={8.5} width={12} height={12} rx={2} stroke={s} strokeWidth={w} />
      <Path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  ubicacion: (s, w, d) => (
    <>
      <Path d="M12 21.2c4-4 6-7.1 6-9.7a6 6 0 1 0-12 0c0 2.6 2 5.7 6 9.7z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={12} cy={11.2} r={2.4} stroke={d.a} strokeWidth={w} />
    </>
  ),
  billetera: (s, w, d) => (
    <>
      <Rect x={3.5} y={6.5} width={17} height={13} rx={2.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M3.5 10.5h17" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={16.5} cy={15} r={1.2} fill={d.a} />
    </>
  ),
  // Destello de cuatro puntas: lo nuevo, lo aprobado, lo que merece mirarse.
  chispa: (s, w, d) => (
    <Path
      d="M12 3.5c.5 4 1.5 5 5.5 5.5-4 .5-5 1.5-5.5 5.5-.5-4-1.5-5-5.5-5.5 4-.5 5-1.5 5.5-5.5zM18 15c.25 2 .75 2.5 2.75 2.75-2 .25-2.5.75-2.75 2.75-.25-2-.75-2.5-2.75-2.75 2-.25 2.5-.75 2.75-2.75z"
      stroke={s} fill={s} fillOpacity={d.f}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  // La burbuja de chat con la chispa dentro: el asistente que contesta al momento. La cola apunta
  // abajo-izquierda, hacia quien escribe; la chispa va centrada y pequeña para leerse a 22 px.
  asistente: (s, w, d) => (
    <>
      <Path
        d="M4 7A2.5 2.5 0 0 1 6.5 4.5h11A2.5 2.5 0 0 1 20 7v6.5a2.5 2.5 0 0 1-2.5 2.5H11.8l-3.9 3.4a.5.5 0 0 1-.83-.38V16A2.5 2.5 0 0 1 4 13.5z"
        stroke={s} fill={s} fillOpacity={d.f}
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <Path
        d="M12 6.9c.35 2.5 1 3.15 3.5 3.5-2.5.35-3.15 1-3.5 3.5-.35-2.5-1-3.15-3.5-3.5 2.5-.35 3.15-1 3.5-3.5z"
        stroke={d.a}
        strokeWidth={w}
        strokeLinejoin="round"
      />
    </>
  ),
  refrescar: (s, w, d) => (
    <>
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M20.5 3.5v4.2h-4.2" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // --- Rubros ---
  // Birrete: la tapa y la borla. Es el simbolo de estudiar, no de un libro.
  educacion: (s, w, d) => (
    <>
      <Path d="M2.8 9.2 12 5l9.2 4.2L12 13.4z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M6.5 11v4.6c0 1.6 2.5 2.9 5.5 2.9s5.5-1.3 5.5-2.9V11" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M21.2 9.6v4.2" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Pantalla sobre pie: lo que distingue un televisor de una caja es el pie.
  electronica: (s, w, d) => (
    <>
      <Rect x={3} y={4.5} width={18} height={11.5} rx={2} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M9 20h6M12 16v4" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  celulares: (s, w, d) => (
    <>
      <Rect x={6.5} y={2.5} width={11} height={19} rx={2.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M10.5 18.5h3" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Camiseta: los hombros y el cuerpo. El cuello es lo que la hace legible a 20 px.
  ropa: (s, w, d) => (
    <Path
      d="M9 3.5 5 5.6 3.5 9.4l2.6 1.2V20a1 1 0 0 0 1 1h9.8a1 1 0 0 0 1-1v-9.4l2.6-1.2L19 5.6l-4-2.1a3 3 0 0 1-6 0z"
      stroke={s} fill={s} fillOpacity={d.f}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  // Sofa: respaldo, asiento y dos brazos.
  hogar: (s, w, d) => (
    <>
      <Path d="M4.5 11V8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
      <Path d="M3 13.5a2 2 0 0 1 4 0v2.5h10v-2.5a2 2 0 0 1 4 0V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
    </>
  ),
  // Cruz sanitaria dentro del marco: la cruz sola se confunde con «cerrar».
  salud: (s, w, d) => (
    <>
      <Rect x={3.5} y={3.5} width={17} height={17} rx={4} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="M12 8v8M8 12h8" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Carrito: la cesta, el mango y las ruedas.
  supermercado: (s, w, d) => (
    <>
      <Path d="M2.5 4h2.2l2.4 10.5a1.5 1.5 0 0 0 1.46 1.15h8.1a1.5 1.5 0 0 0 1.46-1.14L19.8 7.5H6" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={9.5} cy={19.5} r={1.3} stroke={d.a} strokeWidth={w} />
      <Circle cx={16.5} cy={19.5} r={1.3} stroke={d.a} strokeWidth={w} />
    </>
  ),
  transporte: (s, w, d) => (
    <>
      <Path d="M3.5 16.5v-4l1.9-4.4A2 2 0 0 1 7.24 7h9.52a2 2 0 0 1 1.84 1.1l1.9 4.4v4" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M3.5 12.5h17" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={7.5} cy={16.5} r={1.4} stroke={d.a} strokeWidth={w} />
      <Circle cx={16.5} cy={16.5} r={1.4} stroke={d.a} strokeWidth={w} />
    </>
  ),
  // Llave inglesa: servicios es «alguien viene y lo arregla».
  servicios: (s, w, d) => (
    <Path
      d="M15.6 3.6a5 5 0 0 0-5.9 6.6l-6 6a1.8 1.8 0 0 0 2.55 2.55l6-6a5 5 0 0 0 6.6-5.9l-3 3-2.7-.55-.55-2.7z"
      stroke={s} fill={s} fillOpacity={d.f}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  // Tienda: el toldo y la puerta.
  comercio: (s, w, d) => (
    <>
      <Path d="M3.5 9.5 5 4.5h14l1.5 5a3 3 0 0 1-5.67 1.5 3 3 0 0 1-5.66 0A3 3 0 0 1 3.5 9.5z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M5 11.8V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7.2" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M10 20.5v-4.2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.2" stroke={d.a} strokeWidth={w} strokeLinejoin="round" />
    </>
  ),
  // --- Controles ---
  grafico: (s, w, d) => (
    <>
      <Path d="M4 20.5V4" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M4 20.5h16" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M8 17.5v-5M12.5 17.5v-9M17 17.5v-6" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  filtro: (s, w, d) => (
    <Path d="M3.5 5.5h17l-6.6 7.4v5.6l-3.8 2v-7.6z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
  ),
  lista: (s, w, d) => (
    <>
      <Path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={4.5} cy={6.5} r={1} fill={s} />
      <Circle cx={4.5} cy={12} r={1} fill={s} />
      <Circle cx={4.5} cy={17.5} r={1} fill={s} />
    </>
  ),
  cuadricula: (s, w, d) => (
    <>
      <Rect x={3.5} y={3.5} width={7.5} height={7.5} rx={2} stroke={s} strokeWidth={w} />
      <Rect x={13} y={3.5} width={7.5} height={7.5} rx={2} stroke={s} strokeWidth={w} />
      <Rect x={3.5} y={13} width={7.5} height={7.5} rx={2} stroke={s} strokeWidth={w} />
      <Rect x={13} y={13} width={7.5} height={7.5} rx={2} stroke={s} strokeWidth={w} />
    </>
  ),
  descargar: (s, w, d) => (
    <>
      <Path d="M12 3.5v11" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
      <Path d="M7.8 10.5 12 14.7l4.2-4.2" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 17v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  tendencia: (s, w, d) => (
    <>
      <Path d="M3.5 16.5 9 11l3.5 3.5L20.5 6.5" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.5 6.5h5v5" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  etiqueta: (s, w, d) => (
    <>
      <Path d="M11.6 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.4a2 2 0 0 1-.59 1.42l-6.6 6.6a2 2 0 0 1-2.83 0l-6.4-6.4a2 2 0 0 1 0-2.83l6.6-6.6a2 2 0 0 1 1.42-.59z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={16} cy={8} r={1.3} stroke={d.a} strokeWidth={w} />
    </>
  ),
  estrella: (s, w, d) => (
    <Path
      d="m12 3.8 2.6 5.28 5.83.85-4.22 4.11 1 5.81L12 17.11l-5.21 2.74 1-5.81L3.57 9.93l5.83-.85z"
      stroke={s} fill={s} fillOpacity={d.f}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  /*
   * Ojo abierto y ojo TACHADO, no dos ojos parecidos.
   *
   * El par «ojo / ojo con la pupila un poco distinta» es el error clasico de este control: a 20 px
   * los dos estados se ven iguales y nadie sabe si esta mostrando u ocultando. La barra diagonal es
   * lo unico que se distingue de un vistazo.
   */
  /*
   * Un sobre, no una hoja.
   *
   * El campo de correo llevaba el icono de documento porque era lo que habia. Un icono aproximado es
   * peor que ninguno: se lee antes que la etiqueta y deja al lector corrigiendose solo.
   */
  sobre: (s, w, d) => (
    <>
      <Rect x={2.5} y={5} width={19} height={14} rx={2.5} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Path d="m3.2 6.6 8.03 5.36a1.4 1.4 0 0 0 1.54 0L20.8 6.6" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /*
   * Un auricular, no una chincheta.
   *
   * La fila del telefono llevaba el icono de ubicacion. Los dos son datos de contacto y estan uno
   * encima del otro en el perfil, asi que el icono equivocado no se lee como un descuido: se lee
   * como si la fila fuera la direccion.
   */
  telefono: (s, w, d) => (
    <Path
      d="M7.4 3.5h-.9A2.6 2.6 0 0 0 4 6.3c.3 3.6 1.9 7 4.4 9.5s5.9 4.1 9.5 4.4a2.6 2.6 0 0 0 2.8-2.5v-.9a1.7 1.7 0 0 0-1.4-1.7l-2.2-.4a1.7 1.7 0 0 0-1.7.7l-.6.9a12.4 12.4 0 0 1-5.1-5.1l.9-.6a1.7 1.7 0 0 0 .7-1.7l-.4-2.2a1.7 1.7 0 0 0-1.5-1.2z"
      stroke={s} fill={s} fillOpacity={d.f}
      strokeWidth={w}
      strokeLinejoin="round"
    />
  ),
  ojo: (s, w, d) => (
    <>
      <Path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={2.9} stroke={d.a} strokeWidth={w} />
    </>
  ),
  'ojo-tachado': (s, w, d) => (
    <>
      <Path d="M2.5 12s3.6-6 9.5-6c1.4 0 2.68.34 3.82.87M21.5 12s-1.3 2.16-3.7 3.93" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.9 9.9a2.9 2.9 0 0 0 4.2 4.2" stroke={s} strokeWidth={w} strokeLinecap="round" />
      <Path d="M17.8 15.93A9.6 9.6 0 0 1 12 18c-5.9 0-9.5-6-9.5-6" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.6 3.6l16.8 16.8" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Avion de papel: la accion de enviar un mensaje.
  enviar: (s, w, d) => (
    <>
      <Path d="M21.5 3 10.2 14.3" stroke={d.a} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21.5 3 14.6 21l-4.4-6.7L3.5 9.9 21.5 3z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
    </>
  ),
  cerrar: (s, w, d) => <Path d="M6 6l12 12M18 6 6 18" stroke={s} strokeWidth={w} strokeLinecap="round" />,
  // Clip de adjuntos, el mismo gesto que el de cualquier chat.
  clip: (s, w, d) => (
    <Path
      d="M20.2 11.6 12 19.8a5.2 5.2 0 0 1-7.4-7.4l8.5-8.5a3.5 3.5 0 0 1 4.9 4.9l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"
      stroke={s}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chat: (s, w, d) => (
    <>
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5v-8z" stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} strokeLinejoin="round" />
      <Path d="M8.5 8.5h7M8.5 11.5h4.5" stroke={d.a} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  papelera: (s, w, d) => (
    <>
      <Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.2A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.8L17.5 7" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 11v6M14 11v6" stroke={s} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  galeria: (s, w, d) => (
    <>
      <Rect x={3} y={4.5} width={18} height={15} rx={3} stroke={s} fill={s} fillOpacity={d.f} strokeWidth={w} />
      <Circle cx={9} cy={10} r={1.7} stroke={d.a} strokeWidth={w} />
      <Path d="m4 17 5-4.5 3.5 3L16 12l5 5" stroke={s} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

/**
 * Los nombres que existen, comprobables en tiempo de ejecucion.
 *
 * Hace falta porque el contenido de las pantallas llega del servidor y puede nombrar un icono que
 * esta version de la app todavia no tiene —pasa cada vez que se publica contenido antes de que la
 * app nueva llegue a las tiendas—. El tipo `IconName` no sirve para eso: desaparece al compilar.
 */
export const ICON_NAMES = Object.keys(PATHS) as readonly IconName[];


export function Icon({ name, size = 22, tint = color.text.secondary, label, duo = false, vivo = false, acento = ACENTO }: IconProps) {
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
  const dibujo: Dibujo = { a: duo ? acento : tint, f: duo ? RELLENO : 0, vivo };
  const svg = <Svg {...props}>{PATHS[name](tint, width, dibujo)}</Svg>;
  if (!duo && !vivo) return svg;
  return (
    <VidaDeIcono nombre={name} size={size} acento={acento} duo={duo} vivo={vivo}>
      {svg}
    </VidaDeIcono>
  );
}
