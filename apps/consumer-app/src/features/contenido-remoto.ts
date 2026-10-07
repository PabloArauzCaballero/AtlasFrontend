/**
 * Texto de la app que negocio edita en el portal, sobre el que la app ya trae uno de fábrica.
 *
 * ## Por qué cada pantalla conserva su texto
 *
 * El portal (superficies `tour`, `signup`, `privacy`) sustituye el texto de fábrica, pero NUNCA lo
 * reemplaza por un hueco: sin red, o antes de que llegue la respuesta, o si alguien despublica la
 * pieza, la persona ve el texto que viene en la app. Una pantalla de privacidad en blanco porque el
 * servidor tardó es peor que una con el texto de la versión anterior.
 *
 * ## Qué se acepta del servidor
 *
 * Sólo piezas completas: un paso sin título o sin texto, o una promesa sin «por qué», se descartan y
 * queda la de fábrica. Un icono desconocido para esta versión de la app cae al de fábrica del paso
 * (el servidor puede nombrar uno que aún no llegó a las tiendas).
 */
import type { ContentEntry } from '../api/endpoints/app-content';
import type { TourStep } from '../ui/tour';
import type { TrustItem } from '../ui/trust-card';
import { ICON_NAMES, type IconName } from '../ui/icons';
import type { PrivacidadCopy } from './privacidad-copy';

export type PorClave = Readonly<Record<string, ContentEntry>>;

const texto = (valor: string | null | undefined): string => (typeof valor === 'string' ? valor.trim() : '');

const iconoValido = (nombre: unknown): IconName | null =>
  typeof nombre === 'string' && (ICON_NAMES as readonly string[]).includes(nombre) ? (nombre as IconName) : null;

/** Las piezas de una superficie, por `contentKey`. Si una clave se repite, gana la de menor orden. */
export function indexarPorClave(entries: readonly ContentEntry[]): PorClave {
  const ordenadas = [...entries].sort((a, b) => a.displayOrder - b.displayOrder);
  const resultado: Record<string, ContentEntry> = {};
  for (const entry of ordenadas) if (!(entry.contentKey in resultado)) resultado[entry.contentKey] = entry;
  return resultado;
}

/**
 * El recorrido de Inicio: cada paso se busca por el elemento que señala (`inicio.linea`…). Sólo cambia
 * lo que el portal trae completo; el elemento al que apunta el paso sigue siendo del código.
 */
export function fusionarTour(base: readonly TourStep[], porClave: PorClave): TourStep[] {
  return base.map((paso) => {
    const entry = porClave[paso.target];
    const titulo = texto(entry?.title);
    const cuerpo = texto(entry?.body) || texto(entry?.subtitle);
    if (!entry || !titulo || !cuerpo) return paso;
    return {
      ...paso,
      title: titulo,
      body: cuerpo,
      icon: iconoValido(entry.metadata?.icon) ?? paso.icon,
    };
  });
}

/**
 * Las promesas de una pantalla del alta (`registro.1`, `registro.2`…) como filas de «Por qué te pedimos
 * esto»: el título es el dato, el texto es el para qué y los puntos son las garantías con su icono.
 * Si el portal no trae ninguna completa para ese grupo, se queda el texto de fábrica ENTERO: mezclar
 * filas de fábrica con filas del portal dejaría una tarjeta con dos redacciones de la misma promesa.
 */
export function trustDesdeContenido(grupo: string, entries: readonly ContentEntry[], base: TrustItem[]): TrustItem[] {
  const filas = entries
    .filter((entry) => entry.contentKey.startsWith(`${grupo}.`))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((entry): TrustItem[] => {
      const dato = texto(entry.title);
      const porque = texto(entry.body) || texto(entry.subtitle);
      if (!dato || !porque) return [];
      return [
        {
          icon: iconoValido(entry.metadata?.icon) ?? 'chispa',
          dato,
          porque,
          garantias: entry.bullets
            .filter((punto) => texto(punto.text))
            .map((punto) => ({
              icon: iconoValido(punto.icon) ?? 'check',
              label: texto(punto.text),
            })),
        },
      ];
    });
  return filas.length > 0 ? filas : base;
}

/** El texto de una pieza suelta (mensaje, cabecera…) o el de fábrica si el portal no la trae completa. */
export function textoDe(porClave: PorClave, clave: string, campo: 'title' | 'subtitle' | 'body', porDefecto: string): string {
  return texto(porClave[clave]?.[campo]) || porDefecto;
}

/** «Tus datos»: cada texto sale del portal si la pieza está completa y si no es el de fábrica. */
export function fusionarPrivacidad(base: PrivacidadCopy, porClave: PorClave): PrivacidadCopy {
  return {
    titulo: textoDe(porClave, 'cabecera', 'title', base.titulo),
    subtitulo: textoDe(porClave, 'cabecera', 'subtitle', base.subtitulo),
    permisosTitulo: textoDe(porClave, 'permisos', 'title', base.permisosTitulo),
    permisosDetalle: textoDe(porClave, 'permisos', 'body', base.permisosDetalle),
    permisosRetirados: textoDe(porClave, 'permisos.guardado.retirados', 'body', base.permisosRetirados),
    permisosIgual: textoDe(porClave, 'permisos.guardado.igual', 'body', base.permisosIgual),
    derechosTitulo: textoDe(porClave, 'derechos', 'title', base.derechosTitulo),
    derechosDetalle: textoDe(porClave, 'derechos', 'body', base.derechosDetalle),
    derechosPregunta: textoDe(porClave, 'derechos.ayuda', 'title', base.derechosPregunta),
    derechosAyuda: textoDe(porClave, 'derechos.ayuda', 'body', base.derechosAyuda),
    solicitudEnviada: textoDe(porClave, 'solicitud.enviada', 'body', base.solicitudEnviada),
    // El valor es el tipo de solicitud que entiende el servidor: lo que se edita es su etiqueta.
    derechos: base.derechos.map((derecho) => ({
      value: derecho.value,
      label: textoDe(porClave, `derecho.${derecho.value}`, 'title', derecho.label),
      detalle: textoDe(porClave, `derecho.${derecho.value}`, 'subtitle', derecho.detalle),
    })),
  };
}

export type Promesa = { icon: IconName; title: string; detail: string };

/**
 * Las promesas de una pantalla en forma de fila simple (icono, título, detalle), para las que no llevan
 * etiquetas de garantía. Mismo criterio que `trustDesdeContenido`: si el portal trae filas completas del
 * grupo, reemplazan al grupo ENTERO; si no, queda el texto de fábrica.
 */
export function promesasDesdeContenido(grupo: string, entries: readonly ContentEntry[], base: Promesa[]): Promesa[] {
  const filas = entries
    .filter((entry) => entry.contentKey.startsWith(`${grupo}.`))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((entry): Promesa[] => {
      const title = texto(entry.title);
      const detail = texto(entry.body) || texto(entry.subtitle);
      return title && detail ? [{ icon: iconoValido(entry.metadata?.icon) ?? 'escudo', title, detail }] : [];
    });
  return filas.length > 0 ? filas : base;
}
