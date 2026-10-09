/**
 * Los PDF de Gestión POS: EXACTAMENTE el `DocumentoPdf` que arma la web en su `BotonPdf`.
 *
 * Copiados de `MerchantRequestsScreen` y `MerchantPaymentProofsScreen`. Las tablas van sin
 * formateador (`tablaPdf` sin `render`), igual que en la web: el importe y la fecha salen como los
 * manda el backend. No se «arregla» aquí: el PDF del teléfono y el de la web tienen que ser el mismo
 * papel, y si alguien decide formatearlos se cambia en los dos sitios a la vez.
 *
 * La pestaña «Historial» no tiene PDF en la web, así que aquí tampoco.
 */
import type { ComprobanteDePago, SolicitudDeCompra } from '@/api/servicios/merchantCreditService';
import { tablaPdf, type DocumentoPdf } from '@/features/pdf';

const subtitulo = (nombre: string) => (nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio');

export function documentoDeSolicitudes(solicitudes: SolicitudDeCompra[], nombre: string): DocumentoPdf {
  return {
    title: 'Solicitudes de compra',
    subtitle: subtitulo(nombre),
    summary: [{ label: 'Solicitudes', value: solicitudes.length }],
    sections: [
      {
        title: 'Solicitudes recibidas',
        description: 'Lo que los clientes pidieron escaneando el QR del local.',
        table: tablaPdf(
          [
            { key: 'applicationCode', label: 'Código' },
            { key: 'submittedAt', label: 'Recibida' },
            { key: 'requestedAmount', label: 'Importe' },
            { key: 'requestedTermMonths', label: 'Cuotas' },
            { key: 'branchName', label: 'Sucursal' },
            { key: 'status', label: 'Estado' },
          ],
          solicitudes as unknown as Record<string, unknown>[],
        ),
      },
    ],
  };
}

export function documentoDeComprobantes(comprobantes: ComprobanteDePago[], nombre: string): DocumentoPdf {
  return {
    title: 'Comprobantes por verificar',
    subtitle: subtitulo(nombre),
    summary: [{ label: 'Comprobantes', value: comprobantes.length }],
    sections: [
      {
        title: 'Comprobantes recibidos',
        description: 'Transferencias que los clientes declaran haber hecho a la cuenta del comercio.',
        table: tablaPdf(
          [
            { key: 'claimCode', label: 'Código' },
            { key: 'submittedAt', label: 'Avisado' },
            { key: 'claimedAmount', label: 'Importe' },
            { key: 'payerReference', label: 'Referencia' },
            { key: 'status', label: 'Estado' },
            { key: 'decidedAt', label: 'Resuelto' },
          ],
          comprobantes as unknown as Record<string, unknown>[],
        ),
      },
    ],
  };
}
