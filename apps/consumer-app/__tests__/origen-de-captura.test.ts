/* eslint-disable @typescript-eslint/no-require-imports -- las fabricas de jest.mock y isolateModules solo admiten require. */
/**
 * El origen de la captura (`captureSource` / `documentCaptureSource`) viaja SOLO con la bandera del
 * escaner encendida, y con ella apagada los tres cuerpos son byte a byte los de siempre.
 *
 * Por que importa tanto: los esquemas del backend son `.strict()`. Un campo de mas contra un backend
 * que aun no lo conoce es un 400, y el alta se corta en el carnet.
 *
 * Los cuerpos «de siempre» estan escritos aqui como texto, copiados de lo que armaba el codigo antes
 * de este cambio (`evidence-upload.ts` e `identidad.tsx` en `56de4ea`), para que la comparacion sea
 * contra lo que salia de verdad y no contra lo que la funcion nueva decida.
 */
import type { PreparedEvidence } from '../src/features/evidence-upload';

jest.mock('../src/device/archivos', () => ({
  leerBytes: jest.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
  leerArchivoEnBase64: jest.fn(),
}));
jest.mock('../src/lib/criptografia', () => ({ sha256Hex: jest.fn(async () => 'a'.repeat(64)) }));
jest.mock('../src/api/client', () => ({ request: jest.fn() }));

const TICKET = {
  storageKey: '1/customer-42/identity_front/x.jpg',
  uploadUrl: 'https://almacen.test/x.jpg?firma',
  method: 'PUT' as const,
  requiredHeaders: { 'content-type': 'image/jpeg', 'content-length': '4' },
  expiresAt: '2026-09-26T06:00:00.000Z',
};

/** Carga los modulos con la bandera como se pida, en un registro limpio. */
function conBandera(activado: boolean) {
  let modulos!: {
    upload: typeof import('../src/features/evidence-upload');
    paquete: typeof import('../src/features/paquete-de-identidad');
    client: { request: jest.Mock };
  };
  jest.isolateModules(() => {
    jest.doMock('../src/api/config', () => ({ ...jest.requireActual('../src/api/config'), escanerDocumentoActivado: activado }));
    modulos = {
      upload: require('../src/features/evidence-upload'),
      paquete: require('../src/features/paquete-de-identidad'),
      client: require('../src/api/client'),
    };
  });
  modulos.client.request.mockReset();
  modulos.client.request.mockResolvedValue(TICKET);
  return modulos;
}

const capturas = (origenes: Partial<Record<'identity_front' | 'identity_back' | 'selfie', 'camera' | 'system_scanner'>>) => {
  const una = (kind: 'identity_front' | 'identity_back' | 'selfie', n: number): PreparedEvidence => ({
    kind,
    localUri: `file:///${kind}.jpg`,
    storageKey: `1/customer-42/${kind}/${n}.jpg`,
    sha256Hash: String(n).repeat(64),
    sizeBytes: 1000 + n,
    mimeType: 'image/jpeg',
    ...(origenes[kind] ? { captureSource: origenes[kind] } : {}),
  });
  return { identity_front: una('identity_front', 1), identity_back: una('identity_back', 2), selfie: una('selfie', 3) };
};

const ORDEN = ['identity_front', 'identity_back', 'selfie'] as const;

describe('POST documents/upload-url', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, headers: { get: () => null } })) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('bandera apagada: el cuerpo es el de siempre aunque se sepa el origen', async () => {
    const { upload, client } = conBandera(false);
    const prepared = await upload.uploadEvidence({ customerId: '42', kind: 'identity_front', localUri: 'file:///f.jpg', captureSource: 'system_scanner' });
    const [ruta, opciones] = client.request.mock.calls[0]!;
    expect(ruta).toBe('/customer-onboarding/42/documents/upload-url');
    expect(JSON.stringify(opciones.body)).toBe('{"documentType":"identity_front","contentType":"image/jpeg","sizeBytes":4}');
    // Sin señal ni plazo, las opciones de la peticion son las de siempre.
    expect(opciones).toEqual({ method: 'POST', body: opciones.body });
    // El origen se recuerda en local para el paquete, que tampoco lo mandara.
    expect(prepared.captureSource).toBe('system_scanner');
  });

  it('bandera encendida: lleva captureSource, al final', async () => {
    const { upload, client } = conBandera(true);
    await upload.uploadEvidence({ customerId: '42', kind: 'identity_back', localUri: 'file:///b.jpg', captureSource: 'system_scanner' });
    await upload.uploadEvidence({ customerId: '42', kind: 'selfie', localUri: 'file:///s.jpg', captureSource: 'camera' });
    expect(JSON.stringify(client.request.mock.calls[0]![1].body)).toBe(
      '{"documentType":"identity_back","contentType":"image/jpeg","sizeBytes":4,"captureSource":"system_scanner"}',
    );
    expect(JSON.stringify(client.request.mock.calls[1]![1].body)).toBe(
      '{"documentType":"selfie","contentType":"image/jpeg","sizeBytes":4,"captureSource":"camera"}',
    );
  });

  it('bandera encendida sin origen (evidencias de apoyo, carnet de prueba): no inventa uno', async () => {
    const { upload, client } = conBandera(true);
    await upload.uploadEvidence({ customerId: '42', kind: 'bank_qr_proof', localUri: 'file:///q.jpg' });
    expect(JSON.stringify(client.request.mock.calls[0]![1].body)).toBe('{"documentType":"bank_qr_proof","contentType":"image/jpeg","sizeBytes":4}');
  });
});

describe('POST identity-package: las evidencias', () => {
  const DE_SIEMPRE =
    '[{"evidenceType":"identity_front","storageKey":"1/customer-42/identity_front/1.jpg","mimeType":"image/jpeg","sha256Hash":"' +
    '1'.repeat(64) +
    '","fileSizeBytes":"1001"},{"evidenceType":"identity_back","storageKey":"1/customer-42/identity_back/2.jpg","mimeType":"image/jpeg","sha256Hash":"' +
    '2'.repeat(64) +
    '","fileSizeBytes":"1002"},{"evidenceType":"selfie","storageKey":"1/customer-42/selfie/3.jpg","mimeType":"image/jpeg","sha256Hash":"' +
    '3'.repeat(64) +
    '","fileSizeBytes":"1003"}]';

  it('bandera apagada: identicas a las de siempre, aunque se sepa el origen', () => {
    const { paquete } = conBandera(false);
    const hechas = capturas({ identity_front: 'system_scanner', identity_back: 'camera', selfie: 'camera' });
    expect(JSON.stringify(paquete.evidenciasDelPaquete(ORDEN, hechas))).toBe(DE_SIEMPRE);
  });

  it('bandera encendida: cada evidencia lleva su captureSource', () => {
    const { paquete } = conBandera(true);
    const hechas = capturas({ identity_front: 'system_scanner', identity_back: 'camera', selfie: 'camera' });
    const evidencias = paquete.evidenciasDelPaquete(ORDEN, hechas);
    expect(evidencias.map((e) => e.captureSource)).toEqual(['system_scanner', 'camera', 'camera']);
    expect(JSON.stringify(evidencias[0])).toMatch(/"fileSizeBytes":"1001","captureSource":"system_scanner"\}$/);
  });

  it('bandera encendida y una captura sin origen: esa evidencia va sin el campo', () => {
    const { paquete } = conBandera(true);
    const evidencias = paquete.evidenciasDelPaquete(ORDEN, capturas({ selfie: 'camera' }));
    expect(evidencias.map((e) => 'captureSource' in e)).toEqual([false, false, true]);
  });
});

describe('POST /mobile/identity-verifications', () => {
  const IMAGENES = { documentFront: 'QQ==', documentBack: 'Qg==', selfie: 'Qw==' };

  it('bandera apagada: el cuerpo de siempre', () => {
    const { paquete } = conBandera(false);
    const cuerpo = paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_front: 'system_scanner', identity_back: 'system_scanner' }));
    expect(JSON.stringify(cuerpo)).toBe('{"documentFront":"QQ==","documentBack":"Qg==","selfie":"Qw==","customerId":"42"}');
  });

  it('bandera encendida: documentCaptureSource es el origen del ANVERSO, que es lo que el Motor recorta y analiza', () => {
    const { paquete } = conBandera(true);
    const dos = paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_front: 'system_scanner', identity_back: 'system_scanner' }));
    expect(JSON.stringify(dos)).toBe(
      '{"documentFront":"QQ==","documentBack":"Qg==","selfie":"Qw==","customerId":"42","documentCaptureSource":"system_scanner"}',
    );
    // Anverso con la camara y reverso escaneado: el Motor NO debe saltarse el recorte de una foto con fondo.
    expect(paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_front: 'camera', identity_back: 'system_scanner' })).documentCaptureSource).toBe(
      'camera',
    );
    // Y al reves: el anverso escaneado manda aunque el reverso saliera de la camara de respaldo.
    expect(paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_front: 'system_scanner', identity_back: 'camera' })).documentCaptureSource).toBe(
      'system_scanner',
    );
    expect(paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_front: 'camera', identity_back: 'camera' })).documentCaptureSource).toBe('camera');
    // Sin origen del anverso se usa el del reverso: es lo unico que se sabe.
    expect(paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({ identity_back: 'system_scanner' })).documentCaptureSource).toBe('system_scanner');
    expect('documentCaptureSource' in paquete.cuerpoDeVerificacion(IMAGENES, '42', capturas({}))).toBe(false);
  });
});

describe('la subida se puede cancelar y tiene plazo', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  /** Un PUT que no contesta nunca y solo termina si lo abortan, como el almacen inalcanzable del emulador. */
  function putColgado() {
    globalThis.fetch = jest.fn(
      (_url: string, init: RequestInit = {}) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
        }),
    ) as unknown as typeof fetch;
  }

  it('cancelar corta la subida con UPLOAD_CANCELLED, que la pantalla no pinta como error', async () => {
    const { upload } = conBandera(false);
    putColgado();
    const controlador = new AbortController();
    const promesa = upload.uploadEvidence({ customerId: '42', kind: 'identity_front', localUri: 'file:///f.jpg', signal: controlador.signal, plazo: upload.plazoDeSubidaMs });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controlador.abort();
    const error = await promesa.catch((e: unknown) => e);
    expect(upload.esSubidaCancelada(error)).toBe(true);
  });

  it('al vencer el plazo falla con UPLOAD_TIMEOUT, no con un «Sin conexion» generico', async () => {
    jest.useFakeTimers();
    const { upload } = conBandera(false);
    putColgado();
    const promesa = upload.uploadEvidence({ customerId: '42', kind: 'identity_front', localUri: 'file:///f.jpg', plazo: () => 5_000 });
    const resultado = promesa.catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(5_001);
    const error = (await resultado) as { code?: string };
    expect(error.code).toBe(upload.SUBIDA_VENCIDA);
  });
});
