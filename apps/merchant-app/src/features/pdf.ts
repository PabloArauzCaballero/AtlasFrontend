import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiArchivo } from '@/api/client';

/**
 * Impresión de documentos, para las dos caras del ERP.
 *
 * El PDF no se maqueta aquí ni en el navegador: lo hace el generador documental —el mismo worker
 * que imprime los informes del motor de decisión—, al que el ERP llama por su puerta autenticada
 * (`/documents/generate`). La pantalla sólo dice QUÉ contar; el molde, el pie institucional y la
 * paginación son del worker, y por eso todos los documentos de Atlas salen iguales.
 *
 * Se descarga con `fetch` y no con un enlace: el bearer vive en memoria, una navegación no
 * lo lleva, y lo que se guardaría sería el 401.
 */

export type CeldaPdf = string | number | boolean | null;

export interface TablaPdf {
  columns: { key: string; label: string }[];
  rows: Record<string, CeldaPdf>[];
}

export interface SeccionPdf {
  title: string;
  description?: string;
  pageBreakBefore?: boolean;
  fields?: { label: string; value: CeldaPdf }[];
  table?: TablaPdf;
}

export interface DocumentoPdf {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: CeldaPdf; caption?: string }[];
  notices?: { level: 'positive' | 'caution' | 'critical'; title?: string; text: string }[];
  sections: SeccionPdf[];
}

/** Topes del contrato del generador. Recortar aquí da un documento; no recortar da un 422. */
const MAX_FILAS = 2_000;
const MAX_CELDA = 2_000;
const MAX_COLUMNAS = 12;
const MAX_TITULO = 160;
const MAX_SUBTITULO = 240;

export const recortarTexto = (valor: string, max: number): string =>
  valor.length > max ? `${valor.slice(0, max - 1)}…` : valor;

/** Un valor cualquiera de una fila, listo para una celda del documento. */
export function celdaPdf(valor: unknown): CeldaPdf {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (Array.isArray(valor)) return recortarTexto(valor.join(', '), MAX_CELDA);
  if (typeof valor === 'object') return recortarTexto(JSON.stringify(valor), MAX_CELDA);
  return recortarTexto(String(valor), MAX_CELDA);
}

/**
 * Tabla del documento a partir de lo que la pantalla ya está pintando.
 *
 * `render` es el MISMO formateador que usa la tabla en pantalla, así que el PDF dice lo que dice
 * la pantalla: importes en bolivianos, fechas en formato local y datos personales enmascarados. Un
 * PDF que imprima el valor crudo donde la pantalla enmascara no es «más completo», es una fuga.
 */
export function tablaPdf(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  render?: (row: Record<string, unknown>, key: string) => unknown,
): TablaPdf {
  const columnas = columns.slice(0, MAX_COLUMNAS).map((columna) => ({
    key: columna.key.slice(0, 80),
    label: recortarTexto(columna.label, 120),
  }));
  return {
    columns: columnas.length ? columnas : [{ key: 'valor', label: 'Valor' }],
    rows: rows.slice(0, MAX_FILAS).map((row) =>
      Object.fromEntries(
        columnas.map((columna) => [
          columna.key,
          celdaPdf(render ? render(row, columna.key) : row[columna.key]),
        ]),
      ),
    ),
  };
}

/** Nombre de archivo estable a partir de un título: sin acentos, sin espacios, siempre `.pdf`. */
export function nombreArchivoPdf(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${base || 'documento'}.pdf`;
}

/**
 * Guarda un archivo ya descargado.
 *
 * La URL del blob se revoca con retraso a propósito: el clic sólo PROGRAMA la descarga y el
 * navegador lee el blob después. Revocarla en la misma vuelta del bucle de eventos se la quita de
 * debajo y el archivo sale a medias — un PDF truncado que el lector rechaza.
 */
/**
 * En el teléfono «descargar» es guardar el PDF en la caché de la app y abrir la hoja de compartir del
 * sistema: desde ahí se guarda en Archivos, se manda por WhatsApp o se imprime. Es lo que hace un
 * comercio con el PDF del portal web, sin una carpeta de Descargas que en iOS no existe.
 */
export async function guardarArchivo(bytes: Uint8Array, fileName: string, mimeType = 'application/pdf'): Promise<void> {
  const archivo = new File(Paths.cache, fileName);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(archivo.uri, { mimeType, dialogTitle: fileName, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
  }
}

export async function descargarPdf(documento: DocumentoPdf, filename?: string): Promise<void> {
  const payload: DocumentoPdf = {
    ...documento,
    title: recortarTexto(documento.title, MAX_TITULO),
    ...(documento.subtitle ? { subtitle: recortarTexto(documento.subtitle, MAX_SUBTITULO) } : {}),
    // El contrato exige al menos una sección: una pantalla sin datos imprime que no los hay, que
    // es más útil que un error al pulsar el botón.
    sections: documento.sections.length
      ? documento.sections.slice(0, 60)
      : [{ title: 'Sin registros', description: 'No había datos que imprimir en esta vista.' }],
  };

  const nombre = filename ?? nombreArchivoPdf(documento.title);
  const archivo = await apiArchivo('/documents/generate', nombre, {
    method: 'POST',
    headers: { accept: 'application/pdf' },
    body: { filename: nombre, payload },
  });
  await guardarArchivo(archivo.bytes, archivo.fileName);
}
