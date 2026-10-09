import { merchantCreditService, type ComprobanteDePago, type SolicitudDeCompra } from '../../src/api/servicios/merchantCreditService';
import { cuerpoDecisionSolicitud, cuerpoVerificacion } from '../../src/features/gestion-pos/decisiones';
import { documentoDeComprobantes, documentoDeSolicitudes } from '../../src/features/gestion-pos/documentos';
import { crearRecargas } from '../../src/features/gestion-pos/recargas';

/**
 * Los PDF son el `DocumentoPdf` que arma la web (mismos títulos, columnas y valores crudos), y las
 * decisiones llegan al backend con la ruta y el cuerpo que manda la web. Se simula `fetch`: ninguna
 * prueba habla con un servidor.
 */

const solicitud: SolicitudDeCompra = {
  applicationId: 'a1',
  applicationCode: 'SOL-1',
  status: 'approved',
  requestedAmount: '1500.00',
  requestedTermMonths: 6,
  currencyCode: 'BOB',
  businessAcceptance: null,
  submittedAt: '2026-10-09T14:00:00.000Z',
  branchName: 'Equipetrol',
  branchCode: 'EQ',
  terminalAlias: 'Caja 1',
  terminalSerial: 'SN-5',
};

const comprobante: ComprobanteDePago = {
  claimId: 'c1',
  claimCode: 'CMP-1',
  installmentId: 'i1',
  claimedAmount: '250.00',
  currencyCode: 'BOB',
  payerReference: null,
  proofEvidenceId: 'e1',
  status: 'submitted',
  submittedAt: '2026-10-09T15:00:00.000Z',
  decidedAt: null,
};

describe('Gestión POS · PDF (el DocumentoPdf de la web)', () => {
  it('solicitudes: título, subtítulo con el comercio, resumen y la tabla con los valores tal cual', () => {
    const doc = documentoDeSolicitudes([solicitud], 'Tienda Sol');
    expect(doc.title).toBe('Solicitudes de compra');
    expect(doc.subtitle).toBe('Portal del comercio · Tienda Sol');
    expect(doc.summary).toEqual([{ label: 'Solicitudes', value: 1 }]);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]?.title).toBe('Solicitudes recibidas');
    expect(doc.sections[0]?.description).toBe('Lo que los clientes pidieron escaneando el QR del local.');
    expect(doc.sections[0]?.table?.columns.map((c) => c.label)).toEqual(['Código', 'Recibida', 'Importe', 'Cuotas', 'Sucursal', 'Estado']);
    expect(doc.sections[0]?.table?.rows).toEqual([
      {
        applicationCode: 'SOL-1',
        submittedAt: '2026-10-09T14:00:00.000Z',
        requestedAmount: '1500.00',
        requestedTermMonths: 6,
        branchName: 'Equipetrol',
        status: 'approved',
      },
    ]);
  });

  it('sin nombre de comercio el subtítulo es sólo «Portal del comercio»', () => {
    expect(documentoDeSolicitudes([], '').subtitle).toBe('Portal del comercio');
    expect(documentoDeComprobantes([], '').subtitle).toBe('Portal del comercio');
  });

  it('comprobantes: columnas de la web, y los vacíos van como null', () => {
    const doc = documentoDeComprobantes([comprobante], 'Tienda Sol');
    expect(doc.title).toBe('Comprobantes por verificar');
    expect(doc.summary).toEqual([{ label: 'Comprobantes', value: 1 }]);
    expect(doc.sections[0]?.title).toBe('Comprobantes recibidos');
    expect(doc.sections[0]?.description).toBe('Transferencias que los clientes declaran haber hecho a la cuenta del comercio.');
    expect(doc.sections[0]?.table?.columns.map((c) => c.label)).toEqual(['Código', 'Avisado', 'Importe', 'Referencia', 'Estado', 'Resuelto']);
    expect(doc.sections[0]?.table?.rows[0]).toEqual({
      claimCode: 'CMP-1',
      submittedAt: '2026-10-09T15:00:00.000Z',
      claimedAmount: '250.00',
      payerReference: null,
      status: 'submitted',
      decidedAt: null,
    });
  });
});

describe('Gestión POS · llamadas al backend', () => {
  const originalFetch = globalThis.fetch;
  const llamadas: { url: string; init: RequestInit }[] = [];

  function responder(cuerpo: unknown, contentType = 'application/json', bytes?: Uint8Array) {
    globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      llamadas.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        headers: { get: (nombre: string) => (nombre.toLowerCase() === 'content-type' ? contentType : null) },
        text: async () => JSON.stringify(cuerpo),
        json: async () => cuerpo,
        arrayBuffer: async () => (bytes ?? new Uint8Array()).buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    llamadas.length = 0;
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('rechazar una solicitud manda `reasonCode` a /acceptance', async () => {
    responder({ success: true, data: {} });
    await merchantCreditService.decidir('p 1', 'a1', { ...cuerpoDecisionSolicitud(false, 'SIN_STOCK')! });
    expect(llamadas[0]?.url).toMatch(/\/merchant-credit\/p%201\/applications\/a1\/acceptance$/);
    expect(llamadas[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(llamadas[0]?.init.body))).toEqual({ accepted: false, reasonCode: 'SIN_STOCK' });
  });

  it('confirmar un comprobante y un pago inicial manda `verified` a su /verification', async () => {
    responder({ success: true, data: {} });
    await merchantCreditService.verificarComprobante('p1', 'c1', { ...cuerpoVerificacion(true, '')! });
    await merchantCreditService.verificarPagoInicial('p1', 'a1', { ...cuerpoVerificacion(false, 'El importe no coincide')! });
    expect(llamadas[0]?.url).toMatch(/\/payment-claims\/c1\/verification$/);
    expect(JSON.parse(String(llamadas[0]?.init.body))).toEqual({ verified: true });
    expect(llamadas[1]?.url).toMatch(/\/down-payments\/a1\/verification$/);
    expect(JSON.parse(String(llamadas[1]?.init.body))).toEqual({ verified: false, reason: 'El importe no coincide' });
  });

  it('las colas piden sólo lo pendiente, y el historial manda sólo los filtros con valor', async () => {
    responder({ success: true, data: { applications: [] } });
    await merchantCreditService.listar('p1');
    expect(llamadas[0]?.url).toMatch(/\/applications\?onlyPending=true$/);
    await merchantCreditService.historialPos('p1', { page: 2, pageSize: 20, branchId: undefined, from: '' });
    expect(llamadas[1]?.url).toMatch(/\/pos-history\?page=2&pageSize=20$/);
  });

  it('la imagen del comprobante llega como `data:` lista para <Image>, con la sesión', async () => {
    responder(null, 'image/png; charset=binary', new Uint8Array([137, 80, 78, 71]));
    const uri = await merchantCreditService.comprobanteImagen('p1', 'c1');
    expect(uri).toBe('data:image/png;base64,iVBORw==');
    expect(llamadas[0]?.url).toMatch(/\/payment-claims\/c1\/proof$/);
    expect(llamadas[0]?.init.credentials).toBe('include');
  });
});

describe('Gestión POS · recargas entre pestañas', () => {
  it('recarga todas menos la que decidió, y espera a todas aunque una falle', async () => {
    const recargas = crearRecargas();
    const hechas: string[] = [];
    recargas.registrar('solicitudes', async () => void hechas.push('solicitudes'));
    recargas.registrar('comprobantes', async () => {
      throw new Error('red');
    });
    recargas.registrar('historial', async () => void hechas.push('historial'));
    await recargas.recargar('solicitudes');
    expect(hechas).toEqual(['historial']);
    await recargas.recargar();
    expect(hechas).toEqual(['historial', 'solicitudes', 'historial']);
  });

  it('la baja de una recarga vieja no da de baja a la nueva del mismo panel', async () => {
    const recargas = crearRecargas();
    const llamadas: string[] = [];
    const bajaVieja = recargas.registrar('historial', async () => void llamadas.push('vieja'));
    recargas.registrar('historial', async () => void llamadas.push('nueva'));
    bajaVieja();
    await recargas.recargar();
    expect(llamadas).toEqual(['nueva']);
  });
});
