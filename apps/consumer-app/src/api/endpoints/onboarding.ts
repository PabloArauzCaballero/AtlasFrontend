/**
 * Onboarding del cliente final. Espeja `AtlasBackend/src/modules/customer-onboarding`.
 *
 * El avance, el porcentaje y el `nextStep` los calcula el SERVIDOR — asi lo documenta el propio
 * controlador: dos versiones de la app mostrarian avances distintos con los mismos datos. La app
 * los pinta; no los deduce.
 */
import { request, type RequestOptions } from '../client';

export type OnboardingSectionCode =
  | 'contact_verification'
  | 'personal_data'
  | 'financial_profile'
  | 'address'
  | 'identity_documents'
  | 'reference_contacts'
  // Las dos secciones nuevas de las cuatro fases (2026-09-18): los permisos del telefono se
  // cierran con una decision —tambien «no»— y la encuesta de habitos con sus seis preguntas.
  | 'device_permissions'
  | 'consumer_survey';

export type OnboardingSection = {
  code: OnboardingSectionCode;
  status: 'pending' | 'completed' | 'in_progress';
  missingFields: string[];
};

export type Blocker = { code: string; detail?: string; fields?: string[] };

export type OnboardingStatus = {
  customerId: string;
  lifecycleStatus: string;
  creditEligibilityStatus: string | null;
  onboarding: {
    onboardingFlowId: string;
    flowVersion: string;
    completionStatus: string;
    startedAt: string;
    completedAt: string | null;
  };
  completionPercentage: number;
  sections: OnboardingSection[];
  canSubmit: boolean;
  nextStep: string;
  blockers: Blocker[];
};

export type StartOnboardingInput = {
  customer: { phone?: string; email?: string; firstName?: string; lastName?: string; birthDate?: string };
  password: string;
  consents: { consentDocumentId: string; purposeCode: string; granted: boolean }[];
  device: {
    deviceFingerprintHash: string;
    fingerprintVersion: string;
    channel: 'mobile_app';
    snapshot?: Record<string, unknown>;
  };
  permissions?: { permissionCode: 'location' | 'camera' | 'contacts' | 'notifications' | 'storage'; granted: boolean }[];
  onboarding?: { sourceType: string; startedStepCode?: string };
};

export type StartOnboardingResponse = {
  customerId: string;
  customerCode: string;
  lifecycleStatus: string;
  onboardingFlowId: string;
  sessionId: string;
  deviceId: string;
  nextStep: string;
};

export const startOnboarding = (body: StartOnboardingInput) =>
  request<StartOnboardingResponse>('/customer-onboarding/start', {
    method: 'POST',
    anonymous: true,
    idempotent: true,
    body,
  });

export const getStatus = (customerId: string, origen: Pick<RequestOptions, 'sinPantalla'> = {}) =>
  request<OnboardingStatus>(`/customer-onboarding/${customerId}/status`, origen);

export const listObservations = (customerId: string) =>
  request<{ observations: { code: string; detail?: string }[]; blockers: Blocker[] }>(
    `/customer-onboarding/${customerId}/observations`,
  );

export type VerificationChannel = 'sms' | 'email' | 'whatsapp';

export type CanalDeVerificacion = { channel: VerificationChannel; available: boolean };

/**
 * Que canales puede entregar el servidor, en su orden de preferencia.
 *
 * Anonimo porque se pide durante el alta, antes de tener credenciales. Devuelve los TRES con su
 * disponibilidad: la pantalla necesita distinguir «apagado» de «no existe» para poder explicarlo,
 * y el ORDEN lo decide el servidor —la app toma el primero disponible, asi que cambiar la
 * preferencia no obliga a publicar una version nueva—.
 */
export const listVerificationChannels = () =>
  request<{ channels: CanalDeVerificacion[] }>('/customer-onboarding/verification-channels', {
    anonymous: true,
    sinPantalla: true,
  });

export const requestContactVerification = (
  customerId: string,
  body: { contactType: 'phone' | 'email'; verificationChannel: VerificationChannel },
) =>
  request<{
    verificationAttemptId: string;
    contactType: string;
    deliveryStatus: string;
    /** Canal por el que SALIO de verdad: puede no ser el pedido (reserva por correo del backend). */
    deliveredChannel?: string;
    expiresAt: string;
  }>(
    `/customer-onboarding/${customerId}/contact-verification/request`,
    { method: 'POST', idempotent: true, body },
  );

export const submitContactVerification = (
  customerId: string,
  body: { contactType: 'phone' | 'email'; verificationChannel: VerificationChannel; verificationCode: string },
) =>
  request<{ customerId: string; contactType: string; verificationStatus: string; nextStep: string }>(
    `/customer-onboarding/${customerId}/contact-verification/submit`,
    { method: 'POST', idempotent: true, body },
  );

export const updateProfile = (
  customerId: string,
  body: Partial<{
    firstName: string;
    lastName: string;
    birthDate: string;
    genderDeclared: 'female' | 'male' | 'other' | 'undisclosed';
    /*
     * El servidor todavía acepta `qu` y `ay`; la app ya no los ofrece porque no tiene una sola
     * cadena traducida a ninguno de los dos. Se estrecha AQUÍ y no en el backend: el enumerado del
     * servidor es contrato con otros clientes, y recortarlo por una decisión de esta app rompería a
     * cualquiera que ya guarde esos valores.
     */
    preferredLanguage: 'es' | 'en';
    marketingOptIn: boolean;
  }>,
) =>
  request<{ customerId: string; profileVersionId: string }>(`/customer-onboarding/${customerId}/profile`, {
    method: 'PATCH',
    body,
  });

export type FinancialProfileInput = Partial<{
  employmentStatus: string;
  employerName: string;
  employmentSeniorityMonths: number;
  monthlyIncomeDeclared: number;
  otherMonthlyIncome: number;
  monthlyExpensesDeclared: number;
  economicActivityCode: string;
  sourceOfFunds: string;
}>;

export const updateFinancialProfile = (customerId: string, body: FinancialProfileInput) =>
  request<{ customerId: string; updatedAttributes: string[] }>(
    `/customer-onboarding/${customerId}/financial-profile`,
    { method: 'PUT', body },
  );

export const saveAddressPackage = (
  customerId: string,
  body: {
    address: {
      countryCode: string;
      department: string;
      city: string;
      zone?: string;
      /**
       * Calle y numero. Viaja EN CLARO por TLS y el servidor la cifra antes de guardarla, igual que
       * el telefono y el correo. Cifrarla aqui exigiria repartir una llave a cada telefono, que es
       * justo lo que la convertiria en no-llave.
       */
      addressLine?: string;
    };
    gpsObservation?: { lat: number; lng: number; accuracyMeters?: number };
  },
) =>
  request<{ customerId: string; addressId: string; status: string; nextStep: string }>(
    `/customer-onboarding/${customerId}/address-package`,
    { method: 'POST', idempotent: true, body },
  );

export type ReferenceContact = {
  relationshipType: 'family' | 'friend' | 'coworker' | 'employer' | 'commercial' | 'other';
  fullName: string;
  phone: string;
  consentBasis: 'customer_declared' | 'legitimate_interest' | 'reference_informed';
};

export const listReferences = (customerId: string) =>
  request<{ references: (ReferenceContact & { id: string })[] }>(`/customer-onboarding/${customerId}/reference-contacts`);

export const addReferences = (customerId: string, references: ReferenceContact[]) =>
  request<{ referenceIds: string[]; totalReferences: number }>(
    `/customer-onboarding/${customerId}/reference-contacts`,
    { method: 'POST', body: { references } },
  );

/**
 * El snapshot AGREGADO de la agenda del telefono.
 *
 * Espeja `POST /customer-onboarding/:id/contacts-snapshot`. Lo que viaja son cuentas y
 * proporciones calculadas en el dispositivo (`device/contacts.ts`) mas una lista de hashes de un
 * solo uso que el servidor cruza y descarta. **Nunca un nombre ni un telefono.**
 *
 * El servidor NO devuelve analisis, y es deliberado: quien sube el snapshot es el telefono de la
 * persona analizada, y devolverle su puntaje de riesgo le enseña que mover para que salga mejor la
 * proxima vez.
 */
export type ContactsSnapshotInput = {
  granted: boolean;
  algorithmVersion: string;
  computedAt: string;
  totalContacts: number;
  contactsWithPhone: number;
  uniquePhoneCount: number;
  bolivianPhoneCount: number;
  referencesFoundInAddressBook: number;
  referencesDeclared: number;
  phoneHashes?: string[];
};

export const submitContactsSnapshot = (customerId: string, body: ContactsSnapshotInput) =>
  request<{ customerId: string; computationRunId: string; granted: boolean; receivedAt: string }>(
    `/customer-onboarding/${customerId}/contacts-snapshot`,
    { method: 'POST', body },
  );

export type UploadTicket = {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

/**
 * El cliente declara QUE va a subir; el servidor decide DONDE. `storageKey` no se envia: mientras
 * lo eligiera el cliente, la ruta del objeto era una decision suya y no del sistema que la custodia.
 */
export type UploadDocumentType =
  | 'identity_front'
  | 'identity_back'
  | 'selfie'
  | 'proof_of_address'
  | 'bank_statement'
  | 'bank_qr_proof'
  | 'occupation_audio'
  | 'other';

export const createUploadUrl = (
  customerId: string,
  body: {
    documentType: UploadDocumentType;
    contentType: string;
    sizeBytes: number;
  },
) => request<UploadTicket>(`/customer-onboarding/${customerId}/documents/upload-url`, { method: 'POST', body });

/**
 * Las evidencias de apoyo de la fase 3, fuera de cualquier paquete: el QR de cobro sin monto (prueba
 * de acceso bancario), la factura o preaviso de un servicio (prueba de domicilio) y el audio corto
 * de ocupacion. Ninguna decide sola; las tres van a revision humana. Con el QR no se cobra nada.
 */
export type SupportingEvidenceType = 'bank_qr_proof' | 'proof_of_address' | 'occupation_audio';

export const registerSupportingEvidence = (
  customerId: string,
  body: {
    evidenceType: SupportingEvidenceType;
    storageKey: string;
    mimeType: string;
    sha256Hash: string;
    fileSizeBytes?: string;
    note?: string;
  },
) =>
  request<{ evidenceId: string; evidenceType: string; status: 'pending_review'; uploadedAt: string }>(
    `/customer-onboarding/${customerId}/supporting-evidence`,
    { method: 'POST', body },
  );

/* ------------------------------------------------------------- encuesta de habitos */

export type PreguntaDeHabitos = {
  code: string;
  prompt: string;
  type: 'opcion' | 'monto';
  options?: { code: string; label: string }[];
  min?: number;
  max?: number;
};

export type CatalogoDeHabitos = { surveyVersion: string; questions: PreguntaDeHabitos[] };

export type EstadoDeHabitos = {
  surveyVersion: string;
  answered: { questionCode: string; answerCode: string | null; answerValue: number | null; answeredInMs: number; answeredAt: string }[];
  missing: string[];
  complete: boolean;
  answeredWithoutReading: string[];
};

export type RespuestaDeHabitos = { questionCode: string; answerCode?: string; answerValue?: number; answeredInMs: number };

export const getConsumerSurveyCatalog = () => request<CatalogoDeHabitos>('/customer-onboarding/consumer-survey/catalog');

export const getConsumerSurvey = (customerId: string) => request<EstadoDeHabitos>(`/customer-onboarding/${customerId}/consumer-survey`);

export const saveConsumerSurvey = (customerId: string, body: { surveyVersion: string; answers: RespuestaDeHabitos[] }) =>
  request<EstadoDeHabitos>(`/customer-onboarding/${customerId}/consumer-survey`, { method: 'PUT', body });

export type IdentityEvidence = {
  evidenceType: 'identity_front' | 'identity_back' | 'selfie' | 'proof_of_address' | 'other';
  storageKey: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  sha256Hash: string;
  fileSizeBytes?: string;
};

export const submitIdentityPackage = (
  customerId: string,
  body: {
    identity: {
      documentType: 'ci' | 'passport' | 'foreign_id';
      documentNumberHash: string;
      documentNumber?: string;
      documentLast4: string;
      countryCode: string;
      issuedIn?: string;
      issuedAt?: string;
      expiresAt: string;
    };
    evidence: IdentityEvidence[];
  },
) =>
  request<{ customerId: string; identityVerificationAttemptId: string; status: string; nextStep: string }>(
    `/customer-onboarding/${customerId}/identity-package`,
    { method: 'POST', idempotent: true, body },
  );

export const verifyIdentity = (customerId: string, body: { documentNumber: string; documentComplement?: string }) =>
  request<{ status: string }>(`/customer-onboarding/${customerId}/identity-verification`, {
    method: 'POST',
    idempotent: true,
    body,
  });

export const submitForReview = (customerId: string) =>
  request<{ customerId: string; lifecycleStatus: string; eligible: boolean; blockers: Blocker[]; nextStep: string }>(
    `/customer-onboarding/${customerId}/submit`,
    { method: 'POST', idempotent: true, body: { acknowledgement: true } },
  );
