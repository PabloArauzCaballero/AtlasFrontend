/**
 * Lo que imprimen los PDF: la factura de una en una (`/portal/billing/invoices/:id`) y las dos
 * pantallas. Se comprueba el CONTENIDO que se manda al generador, que es lo que la app decide; el
 * molde es del worker y es el mismo que imprime la web.
 */
import type { Cartera } from '@/api/servicios/merchantCreditService';
import { documentoCartera, documentoFacturacion } from '@/features/cartera/documentos';
import { descargarFactura, documentoFactura, facturaDeComercio, nombreDeFactura } from '@/features/cartera/factura-pdf';

const mockDescargarPdf = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/pdf', () => ({
  ...jest.requireActual('@/features/pdf'),
  descargarPdf: (...args: unknown[]) => mockDescargarPdf(...args),
}));

const plano = (valor: unknown) => String(valor).replace(/ /g, ' ');

const DETALLE_PORTAL = {
  invoice: {
    invoiceNumber: 'F-0007',
    status: 'PARTIALLY_PAID',
    invoiceDate: '2026-09-30',
    dueDate: '2026-10-15',
    subtotalAmount: '100.00',
    taxAmount: '13.00',
    totalAmount: '113.00',
    externalTaxRef: 'CUF-123',
  },
  lines: [{ description: 'Comisión venta 1', quantity: 2, unitAmount: '50', taxAmount: '13', totalAmount: '113' }, { totalAmount: 'x' }],
  account: { legalName: 'Tienda SRL', taxId: '1020304', address: 'Av. Siempre Viva 1', city: 'Santa Cruz' },
};

describe('factura del comercio', () => {
  it('lee el detalle del portal ({ invoice, lines, account })', () => {
    const factura = facturaDeComercio(DETALLE_PORTAL);
    expect(factura).toMatchObject({
      numero: 'F-0007',
      estado: 'PARTIALLY_PAID',
      subtotal: 100,
      impuesto: 13,
      total: 113,
      emisor: { nombre: 'Atlas' },
      receptor: { nombre: 'Tienda SRL', nit: '1020304', detalle: 'Av. Siempre Viva 1, Santa Cruz' },
      referencias: [{ label: 'Referencia fiscal externa', value: 'CUF-123' }],
    });
    expect(factura.lineas).toHaveLength(2);
  });

  it('acepta también la factura plana del ERP y no inventa receptor', () => {
    const factura = facturaDeComercio({ invoiceNumber: 'F-1', totalAmount: 'no-numero', lines: [] });
    expect(factura.numero).toBe('F-1');
    expect(factura.total).toBe(0);
    expect(factura.receptor).toBeUndefined();
  });

  it('arma el documento con emisor, receptor, detalle y totales', () => {
    const documento = documentoFactura(facturaDeComercio(DETALLE_PORTAL));
    expect(documento.title).toBe('Factura F-0007');
    expect(documento.subtitle).toMatch(/^Atlas · Emitida el 30 .* 2026 · PARTIALLY PAID$/);
    expect(documento.sections.map((s) => s.title)).toEqual(['Emisor', 'Receptor', 'Detalle', 'Totales']);
    const detalle = documento.sections[2]!.table!;
    expect(detalle.columns.map((c) => c.label)).toEqual(['Concepto', 'Cantidad', 'Precio unitario', 'Impuesto', 'Total']);
    expect(detalle.rows[0]).toMatchObject({ description: 'Comisión venta 1', quantity: '2' });
    expect(plano(detalle.rows[0]!.totalAmount)).toBe('Bs 113,00');
    // Una línea sin datos no rompe: concepto «—», cantidad «1», importes en cero.
    expect(detalle.rows[1]).toMatchObject({ description: '—', quantity: '1' });
    expect(documento.sections[3]!.fields!.at(-1)).toEqual({ label: 'Referencia fiscal externa', value: 'CUF-123' });
  });

  it('se descarga con el nombre de la web y pasa por el generador', async () => {
    const factura = facturaDeComercio(DETALLE_PORTAL);
    expect(nombreDeFactura(factura)).toBe('factura-f-0007.pdf');
    await descargarFactura(factura);
    expect(mockDescargarPdf).toHaveBeenCalledWith(expect.objectContaining({ title: 'Factura F-0007' }), 'factura-f-0007.pdf');
  });
});

const CARTERA: Cartera = {
  partnerProfileId: 'p',
  summary: {
    activeCredits: 2,
    totalCredits: 3,
    outstanding: '500',
    overdueAmount: '120',
    overdueInstallments: 1,
    collected: '300',
    pendingAmount: '380',
    pendingInstallments: 4,
    paidInstallments: 3,
    paymentsCount: 2,
    proofsAwaitingVerification: 0,
    mdrRatePercent: '3.5',
    commissionAccrued: '10.5',
  },
  credits: [],
  payments: [],
  calendar: [{ date: '2026-10-10', installments: 2, amount: '200', overdue: false }],
};

describe('PDF de las pantallas', () => {
  it('«Mi cartera» lleva el mismo resumen, secciones y columnas que la web', () => {
    const documento = documentoCartera(CARTERA, 'Tienda');
    expect(documento.title).toBe('Mi cartera');
    expect(documento.subtitle).toBe('Portal del comercio · Tienda');
    expect(documento.summary!.map((d) => [d.label, plano(d.value)])).toEqual([
      ['Por cobrar', 'Bs 500,00'],
      ['Vencido', 'Bs 120,00'],
      ['Cobrado', 'Bs 300,00'],
      ['Comisión a Atlas', 'Bs 10,50'],
    ]);
    expect(documento.sections[0]!.fields).toContainEqual({ label: 'MDR aplicado', value: '3.5 %' });
    expect(documento.sections[1]!.table!.columns.map((c) => c.label)).toEqual(['Vence', 'Cliente', 'Importe', 'Estado']);
    // Las columnas «Vence», «Cliente» y «Estado» salen vacías, como en la web (ver la ficha de fidelidad).
    expect(documento.sections[1]!.table!.rows[0]).toEqual({ dueDate: null, customerName: null, amount: '200', status: null });
  });

  it('«Mi cartera» sin nombre ni datos no falla', () => {
    const documento = documentoCartera(null, '');
    expect(documento.subtitle).toBe('Portal del comercio');
    expect(plano(documento.summary![0]!.value)).toBe('Bs 0,00');
  });

  it('«Consumo y facturación» cuenta cobros y facturas y lleva sus cuatro tablas', () => {
    const documento = documentoFacturacion(CARTERA, [{ sourceType: 'COMMISSION' }], [{ invoiceNumber: 'F-1' }, { invoiceNumber: 'F-2' }]);
    expect(documento.subtitle).toBe('Portal del comercio · 0 cobro(s) · 2 factura(s)');
    expect(documento.summary!.map((d) => d.label)).toEqual(['Cobrado', 'Comisión (3.5 %)', 'Pendiente', 'En mora']);
    expect(documento.sections.map((s) => s.title)).toEqual(['Cobros recibidos', 'Cuotas por cobrar', 'Cargos de Atlas', 'Facturas emitidas']);
    expect(documento.sections[3]!.table!.rows).toHaveLength(2);
  });
});
