/**
 * Los pasos de la bienvenida, sin pantalla: cuáles se muestran, en qué orden y con qué ilustración.
 *
 * Aparte para poder probarlo: aquí se decide que quien abre la app por primera vez lea PRIMERO qué es Atlas
 * y cómo funciona, aunque el portal sólo tenga editados los tres pasos de siempre.
 *
 * ## Qué manda
 *
 * El portal edita el TEXTO de cada paso (`contentKey`: `que-es-atlas`, `paso-1`, `paso-2`, `paso-3`). Lo que el
 * portal no sabe es dibujar: la ilustración sale de `metadata.ilustracion` si la pieza la nombra, si no de la
 * clave del paso, si no de su posición. Y si el portal no tiene la pieza «Qué es Atlas» —un entorno sembrado
 * antes de que existiera—, se antepone la de fábrica: el primer paso nunca falta.
 */
import type { ContentEntry } from '../api/endpoints/app-content';
import { esIlustracion, type NombreIlustracion } from '../ui/ilustraciones-bienvenida';
import { ICON_NAMES, type IconName } from '../ui/icons';
import { marca } from '../theme/tokens';

export type Paso = { clave: string; icon: IconName; titulo: string; cuerpo: string; ilustracion: NombreIlustracion };

export const CLAVE_QUE_ES_ATLAS = 'que-es-atlas';

export const PASOS_POR_DEFECTO: Paso[] = [
  {
    clave: CLAVE_QUE_ES_ATLAS,
    icon: 'chispa',
    titulo: `Qué es ${marca.nombre}`,
    cuerpo:
      `${marca.nombre} te da crédito para comprar en los comercios de tu barrio, sin que un banco decida por ti. Pagas después, en cuotas mensuales, y cada pago a tiempo te acerca a más límite.`,
    ilustracion: 'que-es-atlas',
  },
  {
    clave: 'paso-1',
    icon: 'escanear',
    titulo: 'Escaneas y listo',
    cuerpo: 'En la caja del comercio escaneas su QR y escribes el monto. Sin tarjeta de crédito de por medio.',
    ilustracion: 'escaneas-y-listo',
  },
  {
    clave: 'paso-2',
    icon: 'billetera',
    titulo: 'Pagas en cuotas mensuales',
    cuerpo:
      `${marca.nombre} revisa tu solicitud y te asigna una línea con su tasa. Lo que compras con ella lo pagas en cuotas mensuales, y el detalle de cada cuota lo ves en la pantalla de tu crédito.`,
    ilustracion: 'pagas-en-cuotas',
  },
  {
    clave: 'paso-3',
    icon: 'tendencia',
    titulo: 'Construyes tu historial',
    cuerpo:
      `Cada cuota que pagas a tiempo sube tu puntaje ${marca.nombre} y tu línea. El historial que ningún buró tiene todavía, lo empiezas aquí.`,
    ilustracion: 'construyes-historial',
  },
];

const POR_CLAVE = new Map(PASOS_POR_DEFECTO.map((paso) => [paso.clave, paso]));

/** De dónde sale el dibujo de una pieza: lo que nombre su metadata, la clave conocida o, si no, su posición. */
function ilustracionDe(entry: ContentEntry, indice: number): NombreIlustracion {
  const nombrada = entry.metadata?.ilustracion;
  if (esIlustracion(nombrada)) return nombrada;
  return POR_CLAVE.get(entry.contentKey)?.ilustracion ?? PASOS_POR_DEFECTO[Math.min(indice, PASOS_POR_DEFECTO.length - 1)]!.ilustracion;
}

function pasoDe(entry: ContentEntry, indice: number): Paso {
  const cuerpo = entry.subtitle ?? entry.body ?? entry.bullets.map((bullet) => bullet.text).join(' ');
  const icono = entry.bullets.find((bullet) => bullet.icon)?.icon ?? null;
  const porDefecto = POR_CLAVE.get(entry.contentKey);
  return {
    clave: entry.contentKey,
    icon: icono && (ICON_NAMES as readonly string[]).includes(icono) ? (icono as IconName) : (porDefecto?.icon ?? 'chispa'),
    titulo: entry.title ?? '',
    cuerpo,
    ilustracion: ilustracionDe(entry, indice),
  };
}

/**
 * Los pasos que se enseñan. Sin contenido del portal, los de fábrica; con él, los publicados (los vacíos se
 * descartan) y siempre «Qué es Atlas» primero.
 */
export function pasosDesdeContenido(entries: readonly ContentEntry[]): Paso[] {
  const publicados = entries
    .filter((entry) => entry.contentKey !== 'eslogan')
    .map(pasoDe)
    .filter((paso) => paso.titulo && paso.cuerpo);
  if (publicados.length === 0) return PASOS_POR_DEFECTO;

  const queEsAtlas = publicados.find((paso) => paso.clave === CLAVE_QUE_ES_ATLAS) ?? PASOS_POR_DEFECTO[0]!;
  return [queEsAtlas, ...publicados.filter((paso) => paso.clave !== CLAVE_QUE_ES_ATLAS)];
}
