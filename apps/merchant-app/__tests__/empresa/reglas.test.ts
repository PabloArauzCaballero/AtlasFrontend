/**
 * Las reglas de «Mi empresa» que no son pantalla: validaciones, qué se envía, los PDF y las cajas.
 * Cada caso fija un comportamiento de la web (`AtlasERPFrontend`), que es la fuente de verdad.
 */
import type { PartnerOnboardingState, PartnerQrCode } from '@/api/servicios/partnerOnboardingService';
import {
  accionDeEstadoDeCaja,
  aliasDeCaja,
  cantidadDe,
  codigoDeExpediente,
  estadoBnplSucursal,
  serialDeCaja,
  siguienteEstadoDeCaja,
  siguienteNumero,
  slugDeSucursal,
  textoDeCajas,
} from '@/features/empresa/cajas';
import {
  camposEscritos,
  documentoMiEmpresa,
  DONDE_SE_RESUELVE,
  estadoDeCaja,
  estadoDelExpediente,
  estadoDeSucursal,
  opcionesDeRubro,
  pareceCorreo,
  tituloDeHuecos,
  tonoDeEstado,
} from '@/features/empresa/expediente';
import {
  clasificarQr,
  documentoQrDeCobro,
  estadoDeQr,
  leerCuentaEnmascarada,
  motivoDeRechazo,
  motivoSinSubida,
  tipoDeImagenQr,
  veredictoDeLectura,
} from '@/features/empresa/qr-de-cobro';
import { ciudadesParaEditar, cuerpoDeAlta, documentoSucursales, lineaDeUbicacion } from '@/features/empresa/sucursales';
import { resolverAlcance } from '@/features/empresa/use-merchant-scope';
import { avisoDePeso, tamanoLegible } from '@/features/empresa/archivos';

jest.mock('@/api/client', () => ({ apiRequest: jest.fn(), apiBlobUrl: jest.fn(), ApiError: class extends Error {}, mensajeDeError: (_e: unknown, r: string) => r }));
jest.mock('@/api/almacen', () => ({ subirAlAlmacen: jest.fn(), leerBytes: jest.fn() }));

const estado: PartnerOnboardingState = {
  profile: {
    partnerId: 'p-1',
    legalName: 'Panadería El Sol SRL',
    tradeName: null,
    taxId: '1023456019',
    commercialRegistry: null,
    businessCategory: 'EDUCATION',
    contactEmail: 'pagos@sol.bo',
    contactPhone: null,
    emailVerified: true,
    phoneVerified: false,
    onboardingStatus: 'draft',
    submittedAt: null,
    decidedAt: null,
    rejectionReason: null,
    erpAccountId: null,
  },
  gaps: [{ requirement: 'branch', detail: 'Registra al menos una sucursal.' }],
  readyToSubmit: false,
  branches: [{ branchId: 'b-1', branchCode: 'SUC-1', name: 'Centro', addressLine: null, city: 'La Paz', status: 'active', erpBranchId: 'e-1' }],
  qrCodes: [],
  posTerminals: [
    { terminalId: 't-1', branchId: 'b-1', terminalSerial: 'CENTRO-E1-CAJA-1', manualCode: 'K7M2-9QXD', terminalAlias: 'Caja 1', provider: null, model: null, status: 'active', activatedAt: null },
  ],
};

const qr = (parcial: Partial<PartnerQrCode>): PartnerQrCode => ({
  qrId: 'q',
  qrKind: 'bank',
  branchId: null,
  fingerprint: 'abc123',
  bankInstitutionCode: 'BNB',
  accountNumberMasked: '****7890',
  status: 'active',
  replacedById: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...parcial,
});

describe('formularios del expediente', () => {
  it('no manda los campos vacíos (el contrato rechaza "" en los opcionales) y recorta los escritos', () => {
    expect(camposEscritos({ legalName: '  Sol SRL ', tradeName: '', taxId: '123', contactPhone: '   ' })).toEqual({ legalName: 'Sol SRL', taxId: '123' });
  });

  it('el rubro guardado fuera de catálogo se añade y se dice que lo está, para que nadie lo pise', () => {
    const rubros = [{ valor: 'EDUCACION', etiqueta: 'Educación' }];
    expect(opcionesDeRubro('EDUCATION', rubros)).toEqual([
      { etiqueta: '— Sin definir —', valor: '' },
      { valor: 'EDUCACION', etiqueta: 'Educación' },
      { etiqueta: 'EDUCATION (fuera de catálogo)', valor: 'EDUCATION' },
    ]);
    expect(opcionesDeRubro('EDUCACION', rubros)).toHaveLength(2);
  });

  it('cada requisito que no se resuelve en «Estado» lleva a su pestaña', () => {
    expect(DONDE_SE_RESUELVE.branch).toEqual({ tab: 'sucursales', label: 'Sucursales' });
    expect(DONDE_SE_RESUELVE.bank_qr).toEqual({ tab: 'qr', label: 'Mi QR de cobro' });
    expect(DONDE_SE_RESUELVE.commercial_registry).toBeUndefined();
    expect(tituloDeHuecos(1)).toBe('Falta 1 requisito para enviar a revisión');
    expect(tituloDeHuecos(3)).toBe('Falta 3 requisitos para enviar a revisión');
  });

  it('el correo se comprueba como lo hace el navegador antes de enviar', () => {
    expect(pareceCorreo('pagos@tienda.bo')).toBe(true);
    expect(pareceCorreo('pagos tienda.bo')).toBe(false);
  });

  it('los estados se dicen en español, con su tono; nunca el código', () => {
    expect(['draft', 'contact_verified', 'documents_submitted', 'under_review', 'approved', 'rejected', 'suspended'].map((e) => estadoDelExpediente(e).texto)).toEqual([
      'Borrador',
      'Contacto verificado',
      'Documentos enviados',
      'En revisión',
      'Aprobado',
      'Rechazado',
      'Suspendido',
    ]);
    expect(estadoDelExpediente('approved').tono).toBe('success');
    expect(estadoDelExpediente('under_review').tono).toBe('warning');
    expect(estadoDelExpediente('rejected').tono).toBe('danger');
    expect(estadoDelExpediente('draft').tono).toBe('neutral');
    expect(estadoDeSucursal('ACTIVE').texto).toBe('Activa');
    expect(estadoDeSucursal('INACTIVE').texto).toBe('De baja');
    expect(['active', 'registered', 'suspended'].map((e) => estadoDeCaja(e).texto)).toEqual(['Activa', 'Sin activar', 'Suspendida']);
  });

  it('tonos de estado de QR y terminales', () => {
    expect(['active', 'pending_review', 'registered', 'rejected', 'suspended', 'replaced'].map(tonoDeEstado)).toEqual([
      'success',
      'warning',
      'warning',
      'danger',
      'danger',
      'neutral',
    ]);
  });
});

describe('PDF de cada pestaña', () => {
  it('«Mi empresa» lleva el resumen, el aviso de incompleto, la ficha, las sucursales y las terminales', () => {
    const doc = documentoMiEmpresa(estado);
    expect(doc.title).toBe('Mi empresa');
    expect(doc.subtitle).toBe('Panadería El Sol SRL · NIT 1023456019');
    expect(doc.summary).toEqual([
      { label: 'Estado', value: 'Borrador' },
      { label: 'Sucursales', value: 1 },
      { label: 'Terminales', value: 1 },
      { label: 'QR registrados', value: 0 },
    ]);
    expect(doc.notices).toEqual([{ level: 'caution', title: 'Expediente incompleto', text: 'Faltan 1 requisito(s) por cubrir antes de poder enviarlo a revisión.' }]);
    expect(doc.sections.map((s) => s.title)).toEqual(['Ficha comercial', 'Sucursales', 'Terminales POS']);
    expect(doc.sections[0]?.fields).toContainEqual({ label: 'Nombre comercial', value: '—' });
    expect(doc.sections[2]?.table?.rows[0]).toEqual({ terminalSerial: 'CENTRO-E1-CAJA-1', manualCode: 'K7M2-9QXD', terminalAlias: 'Caja 1', status: 'active' });
    expect(documentoMiEmpresa({ ...estado, gaps: [] }).notices).toBeUndefined();
  });

  it('«Mi QR de cobro» no lleva la imagen y lo dice', () => {
    const doc = documentoQrDeCobro([qr({})], 'Sol', 'approved');
    expect(doc.subtitle).toBe('Portal del comercio · Sol');
    expect(doc.notices?.[0]?.title).toBe('La imagen del QR no va en este PDF');
    expect(doc.sections[0]?.table?.columns.map((c) => c.label)).toEqual(['Tipo', 'Entidad', 'Cuenta', 'Estado', 'Registrado']);
    expect(documentoQrDeCobro([], '', '').subtitle).toBe('Portal del comercio');
  });

  it('«Sucursales» cuenta activas y BNPL, con el BNPL dicho como al comercio', () => {
    const doc = documentoSucursales([
      { id: '1', name: 'Centro', status: 'ACTIVE', canOriginateBnpl: true },
      { id: '2', name: 'Norte', status: 'ACTIVE' },
      { id: '3', name: 'Sur', status: 'INACTIVE' },
    ]);
    expect(doc.subtitle).toBe('Portal del comercio · 3 sucursal(es)');
    expect(doc.summary).toEqual([
      { label: 'Sucursales', value: 3 },
      { label: 'Activas', value: 2 },
      { label: 'Originan BNPL', value: 1 },
    ]);
    expect(doc.sections[0]?.table?.rows.map((r) => r.bnpl)).toEqual(['Sí', 'Por habilitar', 'No']);
  });
});

describe('QR de cobro', () => {
  it('no deja subir con el expediente en revisión o rechazado, y lo dice antes', () => {
    expect(motivoSinSubida('approved')).toBeNull();
    expect(motivoSinSubida('')).toBeNull();
    expect(motivoSinSubida('under_review')).toMatch(/revisando su expediente/);
    expect(motivoSinSubida('rejected')).toMatch(/fue rechazado/);
    expect(motivoSinSubida('frozen')).toBe('Con el expediente en «frozen» no se admite cambiar el QR de cobro.');
  });

  it('vigente es el aprobado; si no, el que espera revisión; el resto es historial', () => {
    const aprobado = qr({ qrId: 'a', status: 'active' });
    const nuevo = qr({ qrId: 'n', status: 'pending_review' });
    const viejo = qr({ qrId: 'v', status: 'replaced' });
    const negocio = qr({ qrId: 'x', qrKind: 'business' });
    const r = clasificarQr([viejo, nuevo, aprobado, negocio]);
    expect(r.vigente).toBe(aprobado);
    expect(r.enRevision).toBe(nuevo);
    expect(r.historial).toEqual([viejo]);
    expect(clasificarQr([nuevo]).vigente).toBe(nuevo);
    expect(estadoDeQr('active').texto).toBe('Activo · sus clientes ya lo ven');
    expect(estadoDeQr('raro')).toEqual({ tono: 'neutral', texto: 'raro' });
  });

  it('nunca sale el número de cuenta entero: se enmascara a ****+4', () => {
    expect(leerCuentaEnmascarada('')).toEqual({ ok: true, valor: '' });
    expect(leerCuentaEnmascarada('**7890')).toEqual({ ok: true, valor: '****7890' });
    expect(leerCuentaEnmascarada('1234 5678 7890')).toEqual({ ok: true, valor: '****7890' });
    expect(leerCuentaEnmascarada('10000-7890')).toEqual({ ok: true, valor: '****7890' });
    expect(leerCuentaEnmascarada('cuenta 12')).toMatchObject({ ok: false });
    expect(leerCuentaEnmascarada('123')).toEqual({ ok: false, motivo: 'Faltan dígitos: hacen falta los últimos cuatro de la cuenta, p. ej. ****7890.' });
  });

  it('un fallo del lector de códigos no bloquea: decide el servidor', () => {
    expect(veredictoDeLectura({ resultados: [{ data: 'x' }] })).toBe('con-codigo');
    expect(veredictoDeLectura({ resultados: [] })).toBe('sin-codigo');
    expect(veredictoDeLectura({ fallo: new Error('sin lector') })).toBe('no-se-pudo-comprobar');
  });

  it('el permiso de subida declara PNG o JPEG, como la web', () => {
    expect(tipoDeImagenQr('image/png')).toBe('image/png');
    expect(tipoDeImagenQr('image/heic')).toBe('image/jpeg');
    expect(tipoDeImagenQr(undefined)).toBe('image/jpeg');
  });

  it('el rechazo de la contraseña se dice con palabras del comercio', () => {
    expect(motivoDeRechazo({ code: 'REAUTH_INVALID_PASSWORD' })).toBe('La contraseña no es correcta. Vuelva a escribirla.');
    expect(motivoDeRechazo({ status: 429 })).toMatch(/bloqueada un rato/);
    expect(motivoDeRechazo({ message: 'Otro' })).toBe('Otro');
    expect(motivoDeRechazo(null)).toBe('No se pudo confirmar su contraseña.');
  });
});

describe('sucursales y cajas', () => {
  it('el código del expediente usa el identificador ENTERO (un prefijo hacía chocar dos locales)', () => {
    expect(codigoDeExpediente('d9000000-0000-0000-0000-000000009001')).toBe('SUC-D9000000000000000000000000009001');
    expect(codigoDeExpediente('d9000000-0000-0000-0000-000000009001')).not.toBe(codigoDeExpediente('d9000000-0000-0000-0000-000000009002'));
  });

  it('los seriales y alias siguen el patrón de la web', () => {
    expect(slugDeSucursal('Tienda Norte (Equipetrol)')).toBe('TIENDA-NORTE-EQUIPETROL');
    expect(slugDeSucursal('¡!')).toBe('SUCURSAL');
    expect(serialDeCaja('Panadería Sol', '1a2b3c4d-…', 2)).toBe('PANADERIA-SOL-1A2B3C-CAJA-2');
    expect(aliasDeCaja(3)).toBe('Caja 3');
    expect(siguienteNumero([{ terminalAlias: 'Caja 1' }, { terminalAlias: 'Caja 7' }, { terminalAlias: 'Mostrador' }])).toBe(8);
    expect(siguienteNumero([])).toBe(1);
  });

  it('la cantidad escrita se acota a 0–50 y lo vacío vale 1', () => {
    expect([cantidadDe(''), cantidadDe('3'), cantidadDe('99'), cantidadDe('-2'), cantidadDe('abc')]).toEqual([1, 3, 50, 0, 1]);
  });

  it('dice cuántas cajas se crearon y cuáles quedaron sin activar', () => {
    expect(textoDeCajas('Sucursal registrada', { creadas: 1, sinActivar: 0 })).toBe('Sucursal registrada con 1 caja, ya activas y con su QR.');
    expect(textoDeCajas('Caja', { creadas: 2, sinActivar: 1 })).toBe('Caja con 2 cajas. 1 quedaron sin activar: pulsa «Reactivar» en cada una para que su QR funcione.');
  });

  it('el botón de estado de una caja', () => {
    expect([accionDeEstadoDeCaja('active'), accionDeEstadoDeCaja('registered'), accionDeEstadoDeCaja('suspended')]).toEqual(['Suspender', 'Activar', 'Reactivar']);
    expect([siguienteEstadoDeCaja('active'), siguienteEstadoDeCaja('suspended')]).toEqual(['suspended', 'active']);
  });

  it('BNPL: «No» sólo para la sucursal dada de baja', () => {
    expect(estadoBnplSucursal({ status: 'ACTIVE' }).texto).toBe('Por habilitar');
    expect(estadoBnplSucursal({ status: 'INACTIVE' }).texto).toBe('No');
    expect(estadoBnplSucursal({ canOriginateBnpl: true }).texto).toBe('Sí');
  });

  it('el alta no manda ciudad ni dirección vacías; la edición conserva la ciudad fuera de catálogo', () => {
    expect(cuerpoDeAlta({ name: ' Norte ', city: '', address: '  ' })).toEqual({ name: 'Norte' });
    const opciones = ciudadesParaEditar([{ valor: 'La Paz', etiqueta: 'La Paz' }], 'Sta. Cruz');
    expect(opciones[0]).toEqual({ valor: '', etiqueta: '— Elija la ciudad —' });
    expect(opciones.at(-1)).toEqual({ valor: 'Sta. Cruz', etiqueta: 'Sta. Cruz (valor anterior)' });
    expect(lineaDeUbicacion({ city: null, address: 'Av. 1' })).toBe('Sin ciudad · Av. 1');
  });

  it('el alcance: el comercio no elige comercio salvo que administre varios; el staff interno es una avería', () => {
    expect(resolverAlcance({ isInternalOperator: false, requiresAccountSelection: false, accounts: [{ id: 'a', name: 'A' }] }, '', null)).toMatchObject({
      ready: true,
      requiresSelection: false,
      accountId: undefined,
    });
    const varios = { isInternalOperator: false, requiresAccountSelection: true, accounts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    expect(resolverAlcance(varios, '', null)).toMatchObject({ ready: false, requiresSelection: true });
    expect(resolverAlcance(varios, 'b', null)).toMatchObject({ ready: true, accountId: 'b' });
    expect(resolverAlcance({ isInternalOperator: true, requiresAccountSelection: true, accounts: [] }, '', null).error).toMatch(/personal interno/);
    expect(resolverAlcance(null, '', null).ready).toBe(false);
  });

  it('el peso de un archivo y su tope, como la ficha de archivo de la web', () => {
    expect(tamanoLegible(10 * 1024 * 1024)).toBe('10 MB');
    expect(tamanoLegible(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(avisoDePeso('poder.pdf', 11 * 1024 * 1024, 10 * 1024 * 1024)).toBe('«poder.pdf» pesa 11 MB; el máximo es 10 MB.');
    expect(avisoDePeso('poder.pdf', 1000, 10 * 1024 * 1024)).toBeNull();
  });
});
