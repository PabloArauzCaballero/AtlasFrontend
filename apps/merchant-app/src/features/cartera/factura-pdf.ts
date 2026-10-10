/**
 * La factura como documento, no como fila de una lista. Porte de `AtlasERPFrontend/lib/facturaPdf.ts`
 * (sólo la parte del comercio: `documentoFactura`, `facturaDeComercio` y `descargarFactura`; la de
 * contabilidad, `facturaAr`, es del ERP interno y aquí no tiene pantalla).
 *
 * El botón «Descargar PDF» de la cabecera imprime la PANTALLA —consumo, cargos, resumen—, que no es
 * una factura: no lleva sus líneas, ni a quién se emite, ni el desglose de impuestos. Esto pide el
 * detalle de UNA (`/portal/billing/invoices/:id`) y lo imprime con el mismo generador que el resto.
 *
 * Lo que cambia respecto a la web es sólo la entrega: en el teléfono no hay carpeta de Descargas, así
 * que `descargarPdf` deja el archivo en la caché y abre la hoja de compartir (`features/pdf.ts`).
 */
import type { ResourceRow } from '@/api/types';
import { descargarPdf, nombreArchivoPdf, tablaPdf, type DocumentoPdf } from '@/features/pdf';
import { formatBob, formatDate } from './formato';

interface LineaFactura {
  description?: unknown;
  quantity?: unknown;
  unitAmount?: unknown;
  taxAmount?: unknown;
  totalAmount?: unknown;
}

interface ParteFactura {
  nombre: string;
  nit?: string | undefined;
  detalle?: string | undefined;
}

export interface FacturaImprimible {
  numero: string;
  estado?: string | undefined;
  moneda?: string | undefined;
  fechaEmision?: string | undefined;
  fechaVencimiento?: string | undefined;
  emisor?: ParteFactura | undefined;
  receptor?: ParteFactura | undefined;
  subtotal: number;
  impuesto: number;
  total: number;
  lineas: LineaFactura[];
  /** Referencias fiscales (CUF, CUFD, referencia externa) que acompañan al documento. */
  referencias?: { label: string; value: string }[] | undefined;
  /** Nota al pie: sirve para decir que es una representación interna y no el documento SIAT. */
  aviso?: string | undefined;
}

const numero = (valor: unknown): number => {
  const parsed = Number(valor ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parte(titulo: string, datos: ParteFactura | undefined) {
  return {
    title: titulo,
    fields: [
      { label: 'Nombre o razón social', value: datos?.nombre ?? '—' },
      { label: 'NIT / identificación fiscal', value: datos?.nit ?? '—' },
      ...(datos?.detalle ? [{ label: 'Domicilio', value: datos.detalle }] : []),
    ],
  };
}

export function documentoFactura(factura: FacturaImprimible): DocumentoPdf {
  const moneda = factura.moneda ?? 'BOB';
  return {
    title: `Factura ${factura.numero}`,
    subtitle: [
      factura.emisor?.nombre,
      factura.fechaEmision ? `Emitida el ${formatDate(factura.fechaEmision)}` : null,
      factura.estado ? factura.estado.replaceAll('_', ' ') : null,
    ]
      .filter(Boolean)
      .join(' · '),
    summary: [
      { label: 'Subtotal', value: formatBob(factura.subtotal) },
      { label: 'Impuesto', value: formatBob(factura.impuesto) },
      { label: 'Total', value: formatBob(factura.total), caption: moneda },
      { label: 'Vencimiento', value: factura.fechaVencimiento ? formatDate(factura.fechaVencimiento) : '—' },
    ],
    ...(factura.aviso
      ? { notices: [{ level: 'caution' as const, title: 'Representación interna', text: factura.aviso }] }
      : {}),
    sections: [
      parte('Emisor', factura.emisor),
      parte('Receptor', factura.receptor),
      {
        title: 'Detalle',
        description: `Importes en ${moneda}.`,
        table: tablaPdf(
          [
            { key: 'description', label: 'Concepto' },
            { key: 'quantity', label: 'Cantidad' },
            { key: 'unitAmount', label: 'Precio unitario' },
            { key: 'taxAmount', label: 'Impuesto' },
            { key: 'totalAmount', label: 'Total' },
          ],
          factura.lineas as Record<string, unknown>[],
          (fila, clave) => {
            if (clave === 'description') return String(fila.description ?? '—');
            if (clave === 'quantity') return String(fila.quantity ?? '1');
            return formatBob(numero(fila[clave]));
          },
        ),
      },
      {
        title: 'Totales',
        fields: [
          { label: 'Subtotal', value: formatBob(factura.subtotal) },
          { label: 'Impuesto', value: formatBob(factura.impuesto) },
          { label: 'Total a pagar', value: formatBob(factura.total) },
          ...(factura.referencias ?? []).map((referencia) => ({ label: referencia.label, value: referencia.value })),
        ],
      },
    ],
  };
}

/** El nombre del archivo: `factura-<número>.pdf`, igual que la web. */
export function nombreDeFactura(factura: Pick<FacturaImprimible, 'numero'>): string {
  return nombreArchivoPdf(`factura-${factura.numero}`);
}

/** Arma el documento, lo pide al generador y abre la hoja de compartir con el PDF. */
export async function descargarFactura(factura: FacturaImprimible): Promise<void> {
  await descargarPdf(documentoFactura(factura), nombreDeFactura(factura));
}

/** Detalle de una factura del comercio (`/portal/billing/invoices/:id`): `{ invoice, lines, account }`. */
export function facturaDeComercio(detalle: ResourceRow, opciones: { aviso?: string | undefined } = {}): FacturaImprimible {
  // El portal devuelve `{ invoice, lines, account }`; el ERP devuelve la factura plana con `lines`.
  const invoice = (detalle.invoice ?? detalle) as Record<string, unknown>;
  const account = detalle.account as Record<string, unknown> | null | undefined;
  const lineas = (detalle.lines ?? invoice.lines ?? []) as LineaFactura[];
  return {
    numero: String(invoice.invoiceNumber ?? '—'),
    estado: invoice.status ? String(invoice.status) : undefined,
    fechaEmision: invoice.invoiceDate ? String(invoice.invoiceDate) : undefined,
    fechaVencimiento: invoice.dueDate ? String(invoice.dueDate) : undefined,
    emisor: { nombre: 'Atlas', nit: undefined, detalle: undefined },
    receptor: account
      ? {
          nombre: String(account.legalName ?? account.tradeName ?? '—'),
          nit: account.taxId ? String(account.taxId) : undefined,
          detalle: [account.address, account.city].filter(Boolean).join(', ') || undefined,
        }
      : undefined,
    subtotal: numero(invoice.subtotalAmount),
    impuesto: numero(invoice.taxAmount),
    total: numero(invoice.totalAmount),
    lineas,
    ...(invoice.externalTaxRef ? { referencias: [{ label: 'Referencia fiscal externa', value: String(invoice.externalTaxRef) }] } : {}),
    ...(opciones.aviso ? { aviso: opciones.aviso } : {}),
  };
}
