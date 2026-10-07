/**
 * Las ilustraciones de la bienvenida: qué es Atlas y cómo funciona, dibujadas, no fotografiadas.
 *
 * ## Por qué vectoriales
 *
 * Son SVG: se dibujan con la resolución de la pantalla donde se abren —un iPhone a 3x, una tableta, la web a
 * 2.560 px— sin pesar nada ni difuminarse. Una imagen rasterizada «ultra HD» habría que empaquetarla en tres
 * tamaños y seguiría pesando; esto es una decena de formas y un degradado.
 *
 * ## Qué cuentan
 *
 * Una por paso, y cada una dice lo MISMO que el texto de debajo, para que se entienda aun sin leerlo:
 *   `que-es-atlas`          comercios de tu barrio y crédito sin banco de por medio
 *   `escaneas-y-listo`      el teléfono, el QR del comercio, escanear
 *   `pagas-en-cuotas`       un calendario con las cuotas mensuales
 *   `construyes-historial`  una escalera de niveles: pagar a tiempo te sube
 *
 * Todas usan la paleta de la marca (`tokens.ts`) y ninguna lleva texto dibujado: el texto vive fuera, donde se
 * traduce, se lee con lector de pantalla y puede editarse desde el portal.
 */
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { palette } from '../theme/tokens';

export type NombreIlustracion = 'que-es-atlas' | 'escaneas-y-listo' | 'pagas-en-cuotas' | 'construyes-historial';

export const NOMBRES_DE_ILUSTRACION: readonly NombreIlustracion[] = ['que-es-atlas', 'escaneas-y-listo', 'pagas-en-cuotas', 'construyes-historial'];

export const esIlustracion = (valor: unknown): valor is NombreIlustracion =>
  typeof valor === 'string' && (NOMBRES_DE_ILUSTRACION as readonly string[]).includes(valor);

/** Lo que lee un lector de pantalla: lo que se ve, en una frase. */
const DESCRIPCION: Record<NombreIlustracion, string> = {
  'que-es-atlas': 'Un comercio de barrio con toldo y un teléfono que confirma una compra',
  'escaneas-y-listo': 'Un teléfono escaneando el código QR de un comercio',
  'pagas-en-cuotas': 'Un calendario con tres cuotas mensuales',
  'construyes-historial': 'Una escalera de niveles con una estrella arriba',
};

const ANCHO = 320;
const ALTO = 220;

/** Fondo común: un halo suave de la marca detrás del dibujo. Sin filtros de desenfoque (caros en la web). */
function Halo({ id }: { id: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}-marca`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.brand300} />
          <Stop offset="0.5" stopColor={palette.brand400} />
          <Stop offset="1" stopColor={palette.brand500} />
        </LinearGradient>
        <LinearGradient id={`${id}-halo`} x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={palette.brand400} stopOpacity="0.22" />
          <Stop offset="1" stopColor={palette.brand400} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Circle cx={160} cy={112} r={104} fill={`url(#${id}-halo)`} />
    </>
  );
}

function QueEsAtlas() {
  const id = 'qa';
  return (
    <>
      <Halo id={id} />
      {/* El comercio: cuerpo, puerta, ventana. */}
      <Rect x={70} y={96} width={140} height={90} rx={8} fill={palette.bgCard} stroke={palette.edgeLit} strokeWidth={2} />
      <Rect x={128} y={130} width={26} height={56} rx={4} fill={palette.navy} />
      <Rect x={84} y={118} width={34} height={30} rx={4} fill={palette.navy} />
      <Rect x={164} y={118} width={34} height={30} rx={4} fill={palette.navy} />
      {/* El toldo de rayas. */}
      <Path d="M62 96 L78 62 H202 L218 96 Z" fill={`url(#${id}-marca)`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Path key={i} d={`M${78 + i * 25 + 12.5} 62 L${70 + i * 28 + 14} 96`} stroke={palette.brand900} strokeWidth={3} opacity={0.35} />
      ))}
      <Path d="M62 96 q9 14 18 0 q9 14 18 0 q9 14 18 0 q9 14 18 0 q9 14 18 0 q9 14 18 0 q9 14 18 0 q9 14 18 0 Z" fill={palette.brand500} />
      {/* El teléfono con la compra confirmada. */}
      <G>
        <Rect x={206} y={104} width={52} height={88} rx={10} fill={palette.navy} stroke={palette.brand400} strokeWidth={3} />
        <Circle cx={232} cy={140} r={15} fill={`url(#${id}-marca)`} />
        <Path d="M224 140 l6 6 l11 -12" stroke={palette.brand900} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Rect x={216} y={166} width={32} height={5} rx={2.5} fill={palette.brand400} opacity={0.6} />
        <Rect x={220} y={176} width={24} height={5} rx={2.5} fill={palette.edgeLit} />
      </G>
      <Circle cx={56} cy={70} r={5} fill={palette.brand300} opacity={0.7} />
      <Circle cx={270} cy={72} r={3.5} fill={palette.brand300} opacity={0.6} />
    </>
  );
}

function EscaneasYListo() {
  const id = 'es';
  // El QR: una rejilla de 7x7 con las tres esquinas de posición, como cualquier QR.
  const celdas = [
    [3, 0], [5, 0], [3, 1], [4, 1], [6, 1], [0, 3], [2, 3], [3, 3], [5, 3], [1, 4], [3, 4], [4, 4], [6, 4],
    [0, 5], [2, 5], [4, 5], [5, 5], [3, 6], [5, 6], [6, 6],
  ];
  return (
    <>
      <Halo id={id} />
      <Rect x={96} y={20} width={128} height={186} rx={18} fill={palette.navy} stroke={palette.brand400} strokeWidth={3.5} />
      <Rect x={140} y={28} width={40} height={6} rx={3} fill={palette.brand700} />
      {/* El código QR dentro de las esquinas del visor. */}
      <G transform="translate(116 56)">
        <Rect width={88} height={88} rx={8} fill={palette.bgCard} />
        <G transform="translate(12 12)">
          {[[0, 0], [5, 0], [0, 5]].map(([x, y]) => (
            <G key={`${x}-${y}`} transform={`translate(${x! * 9.1} ${y! * 9.1})`}>
              <Rect width={18} height={18} rx={3} fill={palette.brand300} />
              <Rect x={4} y={4} width={10} height={10} rx={1.5} fill={palette.bgCard} />
              <Rect x={6.5} y={6.5} width={5} height={5} rx={1} fill={palette.brand300} />
            </G>
          ))}
          {celdas.map(([x, y]) => (
            <Rect key={`${x}-${y}`} x={x! * 9.1} y={y! * 9.1} width={7.5} height={7.5} rx={1.5} fill={palette.brand400} opacity={0.9} />
          ))}
        </G>
        {/* Las cuatro esquinas del visor. */}
        {[[0, 0, 1, 1], [88, 0, -1, 1], [0, 88, 1, -1], [88, 88, -1, -1]].map(([x, y, dx, dy]) => (
          <Path
            key={`${x}-${y}`}
            d={`M${x! + dx! * 18} ${y!} H${x!} V${y! + dy! * 18}`}
            stroke={palette.brand300}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </G>
      {/* La línea de escaneo. */}
      <Rect x={110} y={98} width={100} height={4} rx={2} fill={`url(#${id}-marca)`} />
      <Rect x={120} y={168} width={80} height={22} rx={11} fill={`url(#${id}-marca)`} />
      <Path d="M144 179 l7 7 l13 -14" stroke={palette.brand900} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

function PagasEnCuotas() {
  const id = 'pc';
  return (
    <>
      <Halo id={id} />
      <Rect x={64} y={36} width={192} height={150} rx={16} fill={palette.bgCard} stroke={palette.edgeLit} strokeWidth={2.5} />
      <Path d="M64 70 V52 a16 16 0 0 1 16 -16 H240 a16 16 0 0 1 16 16 V70 Z" fill={`url(#${id}-marca)`} />
      <Rect x={96} y={24} width={8} height={24} rx={4} fill={palette.brand900} />
      <Rect x={216} y={24} width={8} height={24} rx={4} fill={palette.brand900} />
      {/* Tres cuotas: la primera ya pagada, la segunda en curso, la tercera por venir. */}
      {[0, 1, 2].map((i) => {
        const x = 108 + i * 52;
        const pagada = i === 0;
        const encurso = i === 1;
        return (
          <G key={i}>
            <Circle cx={x} cy={118} r={20} fill={pagada ? palette.brand400 : palette.navy} stroke={encurso ? palette.brand300 : palette.brand700} strokeWidth={encurso ? 4 : 2.5} />
            {pagada ? (
              <Path d={`M${x - 8} 118 l6 6 l11 -12`} stroke={palette.brand900} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ) : (
              <Circle cx={x} cy={118} r={encurso ? 6 : 4} fill={encurso ? palette.brand300 : palette.brand700} />
            )}
          </G>
        );
      })}
      <Path d="M128 118 H136 M180 118 H188" stroke={palette.brand700} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 6" />
      <Rect x={88} y={152} width={144} height={8} rx={4} fill={palette.navy} />
      <Rect x={88} y={152} width={52} height={8} rx={4} fill={`url(#${id}-marca)`} />
      <Circle cx={262} cy={58} r={5} fill={palette.brand300} opacity={0.7} />
      <Circle cx={52} cy={150} r={3.5} fill={palette.brand300} opacity={0.6} />
    </>
  );
}

function ConstruyesHistorial() {
  const id = 'ch';
  const escalones = [
    { x: 38, h: 38 },
    { x: 86, h: 70 },
    { x: 134, h: 102 },
    { x: 182, h: 134 },
    { x: 230, h: 166 },
  ];
  return (
    <>
      <Halo id={id} />
      {escalones.map((e, i) => (
        <Rect
          key={e.x}
          x={e.x}
          y={196 - e.h}
          width={44}
          height={e.h}
          rx={8}
          fill={i === escalones.length - 1 ? `url(#${id}-marca)` : palette.bgCard}
          stroke={i === escalones.length - 1 ? 'none' : palette.brand700}
          strokeWidth={2}
          opacity={0.55 + i * 0.11}
        />
      ))}
      {/* Cada escalón alcanzado lleva su marca. */}
      {escalones.slice(0, 4).map((e, i) => (
        <Circle key={`m-${e.x}`} cx={e.x + 22} cy={196 - e.h + 18} r={7} fill={palette.brand400} opacity={0.35 + i * 0.2} />
      ))}
      {/* La flecha que sube. */}
      <Path d="M44 160 L108 118 L156 134 L236 62" stroke={palette.brand300} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="1 11" />
      {/* La estrella de lo más alto. */}
      <Path
        d="M252 20 l6.4 13 14.4 2.1 -10.4 10.1 2.5 14.3 -12.9 -6.8 -12.9 6.8 2.5 -14.3 -10.4 -10.1 14.4 -2.1 Z"
        fill={`url(#${id}-marca)`}
        stroke={palette.brand900}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </>
  );
}

const DIBUJO: Record<NombreIlustracion, () => React.ReactElement> = {
  'que-es-atlas': QueEsAtlas,
  'escaneas-y-listo': EscaneasYListo,
  'pagas-en-cuotas': PagasEnCuotas,
  'construyes-historial': ConstruyesHistorial,
};

/**
 * Una ilustración a un ancho dado; el alto sale de la proporción del dibujo, así que no se deforma nunca.
 * Decorativa para el lector de pantalla con `decorativa`: el título de debajo ya dice lo mismo.
 */
export function Ilustracion({ nombre, ancho = ANCHO, decorativa = false }: { nombre: NombreIlustracion; ancho?: number; decorativa?: boolean }) {
  const Dibujo = DIBUJO[nombre];
  return (
    <Svg
      width={ancho}
      height={Math.round((ancho * ALTO) / ANCHO)}
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      accessible={!decorativa}
      accessibilityRole={decorativa ? undefined : 'image'}
      accessibilityLabel={decorativa ? undefined : DESCRIPCION[nombre]}
      accessibilityElementsHidden={decorativa}
      importantForAccessibility={decorativa ? 'no-hide-descendants' : 'yes'}
    >
      <Dibujo />
    </Svg>
  );
}
