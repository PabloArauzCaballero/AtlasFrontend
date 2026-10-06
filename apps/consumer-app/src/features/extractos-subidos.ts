/**
 * Los extractos bancarios que subió la persona: verlos y volver a descargarlos.
 *
 * El archivo se pide a la API con la sesión —nunca a una URL del almacén— y se abre con lo que tenga el
 * dispositivo: en el navegador se guarda como descarga; en el teléfono sale la hoja del sistema, que es
 * desde donde se ve, se guarda en Archivos o se comparte. Es el mismo camino que el informe de gastos.
 */
import * as Sharing from 'expo-sharing';
import { readAccessToken } from '../api/client';
import { apiConfig } from '../api/config';
import type { BankStatementArchiveItem } from '../api/endpoints/credit-line';
import { descargarConSesion, guardarEnNavegador } from '../device/archivos';

export type DescargaDeExtracto = { ok: true } | { ok: false; reason: string };

const fechaCorta = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** «Banco Unión · jun 2026 a ago 2026», con lo que se haya podido leer del documento. */
export function resumenDeExtracto(extracto: Pick<BankStatementArchiveItem, 'institutionName' | 'period'>): string {
  const mes = (iso: string | null) => {
    const fecha = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null;
    return fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString('es-BO', { month: 'short', year: 'numeric' }) : null;
  };
  const desde = mes(extracto.period?.from ?? null);
  const hasta = mes(extracto.period?.to ?? null);
  const periodo = desde && hasta ? `${desde} a ${hasta}` : (desde ?? hasta);
  const partes = [extracto.institutionName, periodo].filter((parte): parte is string => Boolean(parte));
  return partes.length ? partes.join(' · ') : 'Todavía no se leyó el banco ni el período';
}

/** «Subido el 14 sept 2026». */
export function subidoEl(extracto: Pick<BankStatementArchiveItem, 'submittedAt'>): string {
  const fecha = fechaCorta(extracto.submittedAt);
  return fecha ? `Subido el ${fecha}` : 'Fecha de subida no disponible';
}

/** El tono del estado, para la etiqueta. Es el mismo criterio en la lista y en la pantalla de subida. */
export function tonoDeExtracto(status: BankStatementArchiveItem['status']): 'success' | 'danger' | 'warning' {
  if (status === 'applied') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

/**
 * Descarga el PDF de un extracto y lo entrega al dispositivo.
 *
 * Los tres motivos de fallo se distinguen porque piden cosas distintas a la persona: volver a entrar,
 * saber que el archivo ya no se guarda, o reintentar.
 */
export async function descargarExtracto(customerId: string, extracto: Pick<BankStatementArchiveItem, 'reviewId' | 'file'>): Promise<DescargaDeExtracto> {
  if (!extracto.file.available) return { ok: false, reason: 'Este archivo ya no está guardado en Atlas.' };
  try {
    const token = await readAccessToken();
    if (!token) return { ok: false, reason: 'Tu sesión expiró. Vuelve a ingresar.' };

    const nombre = extracto.file.fileName;
    const uri = await descargarConSesion({
      url: `${apiConfig.baseUrl}/customers/${customerId}/bank-statements/${extracto.reviewId}/file`,
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': apiConfig.tenantId },
      nombre,
    });

    // En el navegador no hay hoja de compartir: el extracto se guarda como descarga.
    if (guardarEnNavegador(uri, nombre)) return { ok: true };

    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'Este dispositivo no puede abrir el archivo.' };
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Tu extracto bancario' });
    return { ok: true };
  } catch (error) {
    // `descargarConSesion` dice el código en el navegador; un 404 es «ya no está», no «inténtalo otra vez».
    if (error instanceof Error && error.message.includes('404')) {
      return { ok: false, reason: 'Este archivo ya no está guardado en Atlas.' };
    }
    return { ok: false, reason: 'No pudimos descargar tu extracto. Inténtalo de nuevo.' };
  }
}
