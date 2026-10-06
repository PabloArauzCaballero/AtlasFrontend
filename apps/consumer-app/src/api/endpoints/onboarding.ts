/**
 * Onboarding del cliente final. Espeja `AtlasBackend/src/modules/customer-onboarding`.
 *
 * El avance, el porcentaje y el `nextStep` los calcula el SERVIDOR — asi lo documenta el propio
 * controlador: dos versiones de la app mostrarian avances distintos con los mismos datos. La app
 * los pinta; no los deduce.
 */
import { request } from '../client';

export type OnboardingSectionCode =
  | 'contact_verification'
  | 'personal_data'
  | 'financial_profile'
  | 'address'
  | 'identity_documents'
  | 'reference_contacts';

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

export const getStatus = (customerId: string) => request<OnboardingStatus>(`/customer-onboarding/${customerId}/status`);

export const listObservations = (customerId: string) =>
  request<{ observations: { code: string; detail?: string }[]; blockers: Blocker[] }>(
    `/customer-onboarding/${customerId}/observations`,
  );

export type VerificationChannel = 'sms' | 'email' | 'whatsapp';

export const requestContactVerification = (
  customerId: string,
  body: { contactType: 'phone' | 'email'; verificationChannel: VerificationChannel; contactMethodId?: string },
) =>
  request<{ verificationAttemptId: string; contactType: string; deliveryStatus: string; expiresAt: string }>(
    `/customer-onboarding/${customerId}/contact-verification/request`,
    { method: 'POST', idempotent: true, body },
  );

export const submitContactVerification = (
  customerId: string,
  body: {
    contactType: 'phone' | 'email';
    verificationChannel: VerificationChannel;
    verificationCode: string;
    contactMethodId?: string;
  },
) =>
  request<{
    customerId: string;
    contactType: string;
    verificationStatus: string;
    nextStep: string;
    /** `true` cuando el contacto verificado paso a ser el principal: desde ahi se ingresa con el. */
    primaryContactUpdated?: boolean;
  }>(`/customer-onboarding/${customerId}/contact-verification/submit`, { method: 'POST', idempotent: true, body });

/**
 * Declara un telefono o correo nuevo, o el correcto de uno mal escrito.
 *
 * Nace sin verificar y NO reemplaza al principal: lo hace al confirmar el codigo que llega a el,
 * enviando el `contactMethodId` devuelto aqui. Declarar otra vez el mismo valor sin verificar
 * devuelve el mismo id, asi que una correccion que quedo a medias se retoma escribiendolo de nuevo.
 */
export const addContactMethod = (customerId: string, body: { contactType: 'phone' | 'email'; value: string }) =>
  request<{
    customerId: string;
    contactMethodId: string;
    contactType: string;
    status: string;
    valueLast4: string | null;
    emailDomain: string | null;
    nextStep: string;
  }>(`/customer-onboarding/${customerId}/contact-methods`, { method: 'POST', body });

export const updateProfile = (
  customerId: string,
  body: Partial<{
    firstName: string;
    lastName: string;
    birthDate: string;
    genderDeclared: 'female' | 'male' | 'other' | 'undisclosed';
    preferredLanguage: 'es' | 'en' | 'qu' | 'ay';
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
    address: { countryCode: string; department: string; city: string; zone?: string };
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
export const createUploadUrl = (
  customerId: string,
  body: {
    documentType: 'identity_front' | 'identity_back' | 'selfie' | 'proof_of_address' | 'other';
    contentType: string;
    sizeBytes: number;
  },
) => request<UploadTicket>(`/customer-onboarding/${customerId}/documents/upload-url`, { method: 'POST', body });

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
