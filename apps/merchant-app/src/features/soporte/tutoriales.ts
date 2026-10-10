/**
 * Los tutoriales del comercio en el teléfono: el recorrido «Tu portal, de un vistazo», las guías de
 * cada pantalla y la guía en PDF.
 *
 * ## Por qué aquí se LEEN y en la web se recorren
 *
 * En la web el Centro de Tutoriales (`TutorialCenter audience="merchant"`) lanza recorridos que
 * resaltan elementos REALES del DOM (`[data-tutorial-id="portal-nav"]`) y esperan a que la persona
 * pulse. En React Native no hay DOM ni selectores: cada destino tendría que envolverse a mano en un
 * `TourTarget` (`@cliente/ui/tour`) dentro de pantallas de otras secciones, y los pasos hablan de un
 * menú lateral y de un botón «¿Qué es esto?» que en la app no existen. Así que se porta el CONTENIDO
 * —título, introducción y cada paso con su apunte— para leerlo, y se dice en `docs/fidelidad/soporte.md`.
 *
 * El catálogo del comercio en la web es UN recorrido (`listingsForAudience('merchant')` sólo deja
 * pasar los de rutas `/portal-comercio`): `portal-primeros-pasos`. Por eso no hay filtros ni
 * buscador: filtrar una lista de uno no ayuda a encontrar nada.
 */
import { apiBaseUrl } from '@/api/config';
import { GUIAS_PORTAL, type ScreenGuide } from './guias-portal';

export interface PasoDeTutorial {
  id: string;
  title: string;
  content: string;
  tip?: string;
}

export interface TutorialDelComercio {
  id: string;
  title: string;
  intro: string;
  /** Ficha de catálogo de la web (`tutorial-registry.ts`). */
  categoria: string;
  nivel: string;
  minutos: number;
  esencial: boolean;
  steps: readonly PasoDeTutorial[];
}

/**
 * `portal-primeros-pasos` (`tours/tour-operacion.ts`). Los textos son los de la web salvo dos apuntes
 * que en el teléfono serían falsos, y que se dicen en la ficha de fidelidad:
 *  - «En el móvil el menú se abre con el botón de las tres rayas» → en la app las secciones son las
 *    pestañas de abajo.
 *  - «Este botón, junto al título, abre la explicación…» → en la app esas explicaciones están en
 *    «Guías de cada pantalla», debajo de este recorrido.
 */
export const TUTORIAL_PRIMEROS_PASOS: TutorialDelComercio = {
  id: 'portal-primeros-pasos',
  title: 'Tu portal, de un vistazo',
  intro: 'Qué puedes hacer como comercio y dónde está cada cosa.',
  categoria: 'Portal del comercio',
  nivel: 'Básico',
  minutos: 3,
  esencial: true,
  steps: [
    {
      id: 'menu',
      title: 'Éstas son tus secciones',
      content:
        'Cinco: lo que pasa en tu caja, tu cartera de ventas a crédito, lo que Atlas te factura, la ficha de tu empresa y el sitio donde preguntar. Nada de lo que veas aquí es de otro comercio.',
      tip: 'En la app, las secciones son las pestañas de abajo; tu cuenta está en el círculo con tus iniciales, arriba a la derecha.',
    },
    {
      id: 'gestion-pos',
      title: 'Aquí respondes a tus clientes',
      content:
        'En esta pantalla están los dos momentos de una venta a crédito: la compra que te piden escaneando el QR de tu caja, y el pago de cada cuota que después te avisan haber transferido. El número junto a cada pestaña dice cuántos esperan respuesta.',
      tip: 'Ni el importe ni las cuotas se pueden editar: los fijó el motor de decisión al aprobar la compra.',
    },
    {
      id: 'ayuda',
      title: 'Cada pantalla se explica sola',
      content:
        'En la app, la explicación de cada pantalla está aquí abajo, en «Guías de cada pantalla»: qué es, qué puedes hacer y a quién avisar si algo no sale como esperabas.',
    },
  ],
};

/** El orden de las guías: el de las pestañas de la app, y «Mi cuenta» al final. */
const ORDEN = [
  '/portal-comercio/gestion-pos',
  '/portal-comercio/cartera',
  '/portal-comercio/facturacion',
  '/portal-comercio/expediente',
  '/portal-comercio/soporte',
  '/portal-comercio/cuenta',
] as const;

export function guiasDelComercio(): { ruta: string; guia: ScreenGuide }[] {
  return ORDEN.filter((ruta) => GUIAS_PORTAL[ruta]).map((ruta) => ({ ruta, guia: GUIAS_PORTAL[ruta]! }));
}

/* ------------------------------------------------------------------ la guía en PDF */

/** `GUIAS_PDF.merchant` de la web (`components/tutorial/guia-pdf.ts`). */
export const GUIA_PDF = {
  ruta: '/guias/ATLAS-Guia-del-portal-del-comercio.pdf',
  archivo: 'ATLAS-Guia-del-portal-del-comercio.pdf',
  titulo: 'Guía del portal, paso a paso',
  detalle:
    'Aceptar compras, confirmar pagos, seguir tu cartera y mantener tu empresa: cada pantalla con la imagen de dónde hacer clic y la regla que se cumple.',
} as const;

/**
 * Dónde está la guía: es un archivo ESTÁTICO del portal web (`public/guias/`), en el mismo origen
 * que la API (`https://atlas.erp.test…/api/v1` → `https://atlas.erp.test…`). Comprobado en TEST el
 * 2026-10-09: responde 200 sin sesión, como en la web, donde es un enlace de descarga sin más.
 */
export function urlDeLaGuiaPdf(base: string = apiBaseUrl): string {
  return `${new URL(base).origin}${GUIA_PDF.ruta}`;
}
