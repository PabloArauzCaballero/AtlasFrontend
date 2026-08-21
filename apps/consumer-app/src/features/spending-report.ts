/**
 * Descarga del informe de gastos y entrega al visor del sistema.
 *
 * ## Por que no basta con abrir la URL
 *
 * El endpoint del informe exige sesion. `Linking.openURL` lo abre en el NAVEGADOR, que no comparte
 * la sesion de la app: la peticion sale sin token y el servidor responde 401. Se vio en el
 * dispositivo — el boton abria Chrome y el PDF no llegaba nunca.
 *
 * Asi que el archivo se baja aqui, CON la cabecera de autorizacion, se escribe en el almacenamiento
 * privado de la app y se entrega al selector del sistema. Desde ahi la persona elige guardarlo,
 * enviarlo o abrirlo, que es lo que se espera de un informe.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiConfig } from '../api/config';
import { readAccessToken } from '../api/client';

export type ReportOutcome = { ok: true } | { ok: false; reason: string };

/**
 * El nombre lleva la fecha.
 *
 * Dos informes del mismo cliente en meses distintos son documentos distintos, y compartir ambos con
 * el mismo nombre deja a quien los recibe sin saber cual es cual.
 */
function fileNameFor(now: Date): string {
  return `atlas-gastos-${now.toISOString().slice(0, 10)}.pdf`;
}

export async function downloadSpendingReport(customerId: string, now = new Date()): Promise<ReportOutcome> {
  try {
    const token = await readAccessToken();
    if (!token) return { ok: false, reason: 'Tu sesion expiro. Vuelve a ingresar.' };

    /*
     * En la cache y no en documentos: es un documento DERIVADO, se puede volver a pedir en un
     * segundo y no tiene sentido que ocupe espacio permanente en el telefono de nadie.
     */
    const destination = new File(new Directory(Paths.cache), fileNameFor(now));
    const file = await File.downloadFileAsync(`${apiConfig.baseUrl}/customers/${customerId}/spending-report.pdf`, destination, {
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': apiConfig.tenantId },
      // Pedir el informe dos veces el mismo dia no puede fallar por un archivo que ya esta ahi.
      idempotent: true,
    });

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'Este dispositivo no puede abrir el informe.' };
    }

    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Informe de gastos Atlas' });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'No pudimos generar tu informe. Intentalo de nuevo.' };
  }
}
