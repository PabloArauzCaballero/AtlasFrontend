import { apiBlobUrl, apiRequest } from '@/api/client';
import type { JsonObject } from '@/api/types';
import { subirAlAlmacen, type ArchivoLocal } from '@/api/almacen';

/**
 * El expediente verificable del comercio.
 *
 * Las rutas van contra ESTE backend, que las reenvía a AtlasBackend —donde vive la evidencia— con
 * el token del usuario que las pidió. El portal nunca habla con AtlasBackend directo: es lo que
 * permite exponer el portal por un túnel sin exponer el backend de identidad.
 */

export type PartnerOnboardingStatus =
  | 'draft'
  | 'contact_verified'
  | 'documents_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface PartnerProfile {
  partnerId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  commercialRegistry: string | null;
  businessCategory: string | null;
  contactEmail: string;
  contactPhone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  onboardingStatus: PartnerOnboardingStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  erpAccountId: string | null;
}

/** Un requisito que le falta al expediente para poder enviarse. */
export interface SubmissionGap {
  requirement: string;
  detail: string;
}

export interface PartnerBranch {
  branchId: string;
  branchCode: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  status: string;
  /**
   * La sucursal del ERP con la que se corresponde este local, cuando se declaro.
   *
   * Es el unico puente fiable entre las dos vistas de «sucursal» que tiene el sistema: la del ERP
   * —donde se le asignan usuarios y se factura— y la del expediente —de donde cuelga el QR—. Se
   * cruza por este campo y nunca por el nombre: dos locales pueden llamarse igual, y enseñar el QR
   * equivocado manda el dinero a otra caja.
   */
  erpBranchId: string | null;
}

export interface PartnerQrCode {
  qrId: string;
  qrKind: 'business' | 'bank';
  branchId: string | null;
  /** Prefijo del SHA-256 del archivo: identifica la evidencia sin publicarla entera. */
  fingerprint: string;
  bankInstitutionCode: string | null;
  accountNumberMasked: string | null;
  /** `pending_review` | `active` | `rejected` | `replaced`. Sólo `active` lo ven los clientes. */
  status: string;
  /** Cuándo una persona de Atlas lo revisó (aprobado o rechazado). */
  verifiedAt?: string | null;
  /** En un rechazo, lo que hay que corregir. */
  reviewNote?: string | null;
  replacedById: string | null;
  createdAt: string;
}

export interface PartnerPosTerminal {
  terminalId: string;
  branchId: string;
  terminalSerial: string;
  /**
   * Lo que se teclea en la app cuando la cámara no lee el QR (`K7M2-9QXD`). Null sólo en una caja
   * anterior a que existiera el campo y aún sin código: no se puede imprimir su cartel.
   */
  manualCode: string | null;
  terminalAlias: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  activatedAt: string | null;
}

export interface PartnerOnboardingState {
  profile: PartnerProfile;
  gaps: SubmissionGap[];
  readyToSubmit: boolean;
  branches: PartnerBranch[];
  qrCodes: PartnerQrCode[];
  posTerminals: PartnerPosTerminal[];
}

/** Ticket firmado de subida. La ruta la impone el servidor; aquí sólo se devuelve. */
export interface QrUploadTicket {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

const RUTA = '/partner-onboarding';

export const partnerOnboardingService = {
  start(body: JsonObject) {
    return apiRequest<PartnerProfile>(`${RUTA}/start`, { method: 'POST', body });
  },
  getState(partnerId: string) {
    return apiRequest<PartnerOnboardingState>(`${RUTA}/${encodeURIComponent(partnerId)}/status`);
  },
  /** Cual es MI expediente. Sin esto la pantalla solo lo conocia justo despues de crearlo. */
  mine() {
    return apiRequest<{ profiles: { partnerId: string; legalName: string | null; tradeName: string | null; status: string }[] }>(
      `${RUTA}/mine`,
    );
  },
  /** Corrige nombre de fachada, rubro y telefono. Funciona con el expediente ya aprobado. */
  updateCommercialProfile(partnerId: string, body: JsonObject) {
    return apiRequest<PartnerProfile>(`${RUTA}/${encodeURIComponent(partnerId)}/commercial-profile`, {
      method: 'PATCH',
      body,
    });
  },
  /*
   * Los tres que el expediente pedía y ninguna pantalla ofrecía.
   *
   * Existían en AtlasBackend desde el principio; lo que faltaba era el tramo del medio —la
   * pasarela del ERP no los reenviaba— y, con él, el formulario. Sin esto, «falta la matrícula de
   * comercio» era un aviso que el comercio no podía resolver desde ningún sitio.
   */
  setCommercialRegistry(partnerId: string, commercialRegistry: string) {
    return apiRequest<PartnerProfile>(`${RUTA}/${encodeURIComponent(partnerId)}/commercial-registry`, {
      method: 'POST',
      body: { commercialRegistry },
    });
  },
  addLegalRepresentative(partnerId: string, body: JsonObject) {
    return apiRequest<{ id: string }>(`${RUTA}/${encodeURIComponent(partnerId)}/legal-representative`, {
      method: 'POST',
      body,
    });
  },
  /** Permiso de subida del poder notarial: la ruta del objeto la impone el servidor. */
  createDocumentUploadUrl(partnerId: string, body: JsonObject) {
    return apiRequest<QrUploadTicket>(`${RUTA}/${encodeURIComponent(partnerId)}/documents/upload-url`, {
      method: 'POST',
      body,
    });
  },
  submit(partnerId: string) {
    return apiRequest<PartnerProfile>(`${RUTA}/${encodeURIComponent(partnerId)}/submit`, { method: 'POST' });
  },
  registerBranch(partnerId: string, body: JsonObject) {
    return apiRequest<PartnerBranch>(`${RUTA}/${encodeURIComponent(partnerId)}/branches`, { method: 'POST', body });
  },
  /**
   * Enlaza una sucursal YA declarada con la del ERP que le corresponde.
   *
   * El puente `erpBranchId` sólo se escribía al declararla, así que las sucursales anteriores a
   * eso se quedaban sin él y su QR no se podía enseñar: el ERP y el expediente hablaban del mismo
   * mostrador sin poder demostrarlo. La única salida era declararla otra vez —duplicarla—, con las
   * cajas colgando de la fila vieja y el ERP mirando la nueva.
   */
  linkBranch(partnerId: string, branchId: string, erpBranchId: string) {
    return apiRequest<PartnerBranch>(
      `${RUTA}/${encodeURIComponent(partnerId)}/branches/${encodeURIComponent(branchId)}`,
      { method: 'PATCH', body: { erpBranchId } },
    );
  },
  createQrUploadUrl(partnerId: string, body: JsonObject) {
    return apiRequest<QrUploadTicket>(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes/upload-url`, {
      method: 'POST',
      body,
    });
  },
  /** Los QR del comercio con su historial de reemplazos. Lectura suelta: la pantalla del QR de
   *  cobro no necesita el expediente entero —requisitos, sucursales, terminales— para enseñarlos. */
  listQrCodes(partnerId: string) {
    return apiRequest<PartnerQrCode[]>(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes`);
  },
  /**
   * Registra (o reemplaza) el QR. Un comercio manda la prueba de reautenticación en
   * `x-reauth-token`: sin ella el backend responde 403 `REAUTH_REQUIRED` (ver `ReautenticacionDialog`).
   */
  registerQr(partnerId: string, body: JsonObject, reauthToken?: string) {
    return apiRequest<PartnerQrCode>(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes`, {
      method: 'POST',
      body,
      ...(reauthToken ? { headers: { 'x-reauth-token': reauthToken } } : {}),
    });
  },
  /**
   * La imagen del QR, como URL de blob lista para un `<img>`.
   *
   * Se subía el QR y no había forma de volver a verlo: la tabla enseñaba el prefijo del hash, que
   * prueba que el archivo existe pero no deja comprobar que sea el QR correcto. Un comercio que se
   * equivoca de imagen no se entera hasta que un cliente transfiere a la cuenta de otro.
   *
   * Quien la pida tiene que revocarla al desmontar.
   */
  qrImageUrl(partnerId: string, qrId: string) {
    return apiBlobUrl(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes/${encodeURIComponent(qrId)}/content`);
  },
  registerPosTerminal(partnerId: string, branchId: string, body: JsonObject) {
    return apiRequest<PartnerPosTerminal>(
      `${RUTA}/${encodeURIComponent(partnerId)}/branches/${encodeURIComponent(branchId)}/pos-terminals`,
      { method: 'POST', body },
    );
  },
  changePosStatus(partnerId: string, terminalId: string, body: JsonObject) {
    return apiRequest<PartnerPosTerminal>(
      `${RUTA}/${encodeURIComponent(partnerId)}/pos-terminals/${encodeURIComponent(terminalId)}`,
      { method: 'PATCH', body },
    );
  },
};

/**
 * Sube el archivo del QR al almacenamiento con el ticket firmado.
 *
 * El ticket firma tipo y tamaño, así que el bucket rechaza cualquier subida que no coincida con lo
 * autorizado. Pasa por este mismo origen y no directo al almacén: ver `lib/almacen.ts`. No lleva la
 * sesión de ATLAS: mandarla al almacenamiento sería filtrarla.
 */
export async function uploadQrFile(ticket: QrUploadTicket, file: ArchivoLocal): Promise<void> {
  await subirAlAlmacen(ticket, file);
}

/** Rótulos de los requisitos, para no enseñar la clave del contrato en pantalla. */
export const REQUIREMENT_LABELS: Record<string, string> = {
  commercial_registry: 'Matrícula de comercio',
  legal_representative: 'Representante legal',
  power_of_attorney: 'Poder del representante',
  branch: 'Al menos una sucursal',
  business_qr: 'QR del negocio',
  bank_qr: 'QR bancario de cobro',
};
