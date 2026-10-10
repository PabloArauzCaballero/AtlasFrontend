/**
 * Lo que imprimen los botones «Descargar PDF» de «Mi cartera» y de «Consumo y facturación».
 *
 * Son los `documento={() => …}` que la web escribe en línea dentro de `MerchantPortfolioScreen` y
 * `MerchantBillingScreen`, sacados a funciones para poder probar que el teléfono imprime lo mismo:
 * mismos títulos, mismas columnas, mismas cifras. El generador es el mismo (`documents/generate`),
 * así que si el contenido coincide, el PDF coincide.
 */
import type { Cartera } from '@/api/servicios/merchantCreditService';
import type { ResourceRow } from '@/api/types';
import { tablaPdf, type DocumentoPdf } from '@/features/pdf';
import { cuotasPlanas } from './estados';
import { bob } from './formato';

/**
 * «Mi cartera».
 *
 * La tabla «Próximos cobros» pide `dueDate`, `customerName` y `status` a filas del calendario que
 * traen `date`, `installments`, `amount` y `overdue`: en la web esas tres columnas salen VACÍAS. Se
 * reproduce tal cual —la regla es que la app hace lo que hace la web— y queda anotado en
 * `docs/fidelidad/cartera-facturacion.md` para que se arregle en las dos a la vez. (`customerName`
 * además nunca llega: la cartera no enseña nombres a propósito.)
 */
export function documentoCartera(cartera: Cartera | null, nombre: string): DocumentoPdf {
  const resumen = cartera?.summary;
  const proximos = (cartera?.calendar ?? []).slice(0, 30);
  return {
    title: 'Mi cartera',
    subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
    summary: [
      { label: 'Por cobrar', value: bob(resumen?.outstanding) },
      { label: 'Vencido', value: bob(resumen?.overdueAmount) },
      { label: 'Cobrado', value: bob(resumen?.collected) },
      { label: 'Comisión a Atlas', value: bob(resumen?.commissionAccrued) },
    ],
    sections: [
      {
        title: 'Resumen de la cartera',
        fields: [
          { label: 'Créditos activos', value: String(resumen?.activeCredits ?? 0) },
          { label: 'Cuotas en mora', value: String(resumen?.overdueInstallments ?? 0) },
          { label: 'MDR aplicado', value: `${String(resumen?.mdrRatePercent ?? '0')} %` },
        ],
      },
      {
        title: 'Próximos cobros',
        description: 'Calendario de cuotas por vencer tal y como se ve en pantalla.',
        table: tablaPdf(
          [
            { key: 'dueDate', label: 'Vence' },
            { key: 'customerName', label: 'Cliente' },
            { key: 'amount', label: 'Importe' },
            { key: 'status', label: 'Estado' },
          ],
          proximos as unknown as Record<string, unknown>[],
        ),
      },
    ],
  };
}

/** «Consumo y facturación»: cobros, cuotas, cargos y facturas, con el mismo resumen que la pantalla. */
export function documentoFacturacion(
  cartera: Cartera | null,
  receivables: ResourceRow[],
  invoices: ResourceRow[],
): DocumentoPdf {
  const resumen = cartera?.summary;
  const tasa = resumen?.mdrRatePercent ?? '0';
  const pagos = cartera?.payments ?? [];
  const cuotas = cuotasPlanas(cartera?.credits ?? []);
  return {
    title: 'Consumo y facturación',
    subtitle: `Portal del comercio · ${pagos.length} cobro(s) · ${invoices.length} factura(s)`,
    summary: [
      { label: 'Cobrado', value: bob(resumen?.collected) },
      { label: `Comisión (${tasa} %)`, value: bob(resumen?.commissionAccrued) },
      { label: 'Pendiente', value: bob(resumen?.pendingAmount) },
      { label: 'En mora', value: bob(resumen?.overdueAmount) },
    ],
    sections: [
      {
        title: 'Cobros recibidos',
        description: 'Cada pago de sus clientes con la comisión que devengó.',
        table: tablaPdf(
          [
            { key: 'receivedAt', label: 'Fecha' },
            { key: 'loanCode', label: 'Crédito' },
            { key: 'amount', label: 'Importe' },
            { key: 'commissionAccrued', label: `Comisión ${tasa} %` },
            { key: 'status', label: 'Estado' },
          ],
          pagos as unknown as Record<string, unknown>[],
        ),
      },
      {
        title: 'Cuotas por cobrar',
        description: 'Lo pendiente y lo vencido, cuota a cuota.',
        table: tablaPdf(
          [
            { key: 'loanCode', label: 'Crédito' },
            { key: 'origen', label: 'Sucursal · Caja' },
            { key: 'installmentNumber', label: 'Cuota' },
            { key: 'dueDate', label: 'Vence' },
            { key: 'amountOutstanding', label: 'Falta' },
            { key: 'estado', label: 'Estado' },
          ],
          cuotas as unknown as Record<string, unknown>[],
        ),
      },
      {
        title: 'Cargos de Atlas',
        table: tablaPdf(
          [
            { key: 'sourceType', label: 'Concepto' },
            { key: 'dueDate', label: 'Vencimiento' },
            { key: 'amountOpen', label: 'Saldo' },
            { key: 'status', label: 'Estado' },
          ],
          receivables,
        ),
      },
      {
        title: 'Facturas emitidas',
        table: tablaPdf(
          [
            { key: 'invoiceNumber', label: 'Factura' },
            { key: 'invoiceDate', label: 'Emisión' },
            { key: 'dueDate', label: 'Vencimiento' },
            { key: 'totalAmount', label: 'Importe' },
            { key: 'status', label: 'Estado' },
          ],
          invoices,
        ),
      },
    ],
  };
}
