/**
 * Perfil, habilitacion crediticia, consentimientos, notificaciones y sesion del cliente final.
 * Espeja `customers`, `consents`, `notifications` y `sessions` de AtlasBackend.
 */
import { request } from '../client';
import type { Blocker, OnboardingSection } from './onboarding';

export type CustomerMe = {
  customer: { customerId: string; customerCode: string; status: string; phoneLast4: string | null; emailDomain: string | null };
  profile: { firstName: string | null; lastName: string | null; birthDate: string | null; preferredLanguage: string | null };
  onboarding: { onboardingFlowId: string; completionStatus: string; startedAt: string; completedAt: string | null } | null;
  eligibility: { eligible: boolean; completionPercentage: number; blockerCodes: string[] };
  contacts: { contactType: string; status: string; isPrimary: boolean; valueLast4: string | null }[];
};

export const getMe = (customerId: string) => request<CustomerMe>(`/customers/${customerId}/me`);

export type Eligibility = {
  eligible: boolean;
  lifecycleStatus: string;
  ruleVersion: string;
  sections: OnboardingSection[];
  completionPercentage: number;
  canSubmit: boolean;
  nextStep: string;
  blockers: Blocker[];
};

/** Cada consulta deja evidencia en el servidor con la version de regla aplicada. */
export const getEligibility = (customerId: string) => request<Eligibility>(`/customers/${customerId}/eligibility`);

export type ConsentDocument = {
  id: string;
  documentCode: string;
  versionCode: string;
  language: string;
  contentUrl: string | null;
  contentHash: string | null;
  /**
   * El TEXTO del documento, no solo su direccion.
   *
   * Antes solo llegaba `contentUrl` y la app no tenia nada que ensenar: la casilla pedia aceptar
   * algo que no se podia leer. El backend guarda ahora el texto versionado y lo publica aqui.
   */
  title: string | null;
  summary: string | null;
  bodyMarkdown: string | null;
  requiresExplicitAction: boolean;
  effectiveFrom: string;
  status: string;
};

export const listActiveConsents = () =>
  request<ConsentDocument[]>('/consent-documents/active', { anonymous: true });

export type AppNotification = {
  id: string;
  title: string | null;
  body: string | null;
  channel: string;
  status: string;
  readAt: string | null;
  createdAt: string;
};

export const listNotifications = (customerId: string) =>
  request<{ items: AppNotification[]; total?: number }>(`/customers/${customerId}/notifications`);

export const unreadCount = (customerId: string) =>
  request<{ unread: number }>(`/customers/${customerId}/notifications/unread-count`);

export const markNotificationRead = (customerId: string, notificationId: string) =>
  request<{ read: boolean }>(`/customers/${customerId}/notifications/${notificationId}/read`, { method: 'POST' });

export const markAllNotificationsRead = (customerId: string) =>
  request<{ read: number }>(`/customers/${customerId}/notifications/read-all`, { method: 'POST' });

/** Registro del token push del dispositivo. Solo tras conceder el permiso, nunca al arrancar. */
export const registerDeviceToken = (customerId: string, body: { platform: 'ios' | 'android'; token: string; deviceId?: string }) =>
  request<{ deviceTokenId: string }>(`/customers/${customerId}/device-tokens`, { method: 'POST', body });

export const deleteDeviceToken = (customerId: string, deviceTokenId: string) =>
  request<{ deleted: boolean }>(`/customers/${customerId}/device-tokens/${deviceTokenId}`, { method: 'DELETE' });

export type SessionStartInput = {
  device: { deviceFingerprintHash: string; fingerprintVersion: string; channel: 'mobile_app'; userAgent?: string };
  authMethod?: string;
  locationPermissionGranted?: boolean;
};

/**
 * Abrir sesion de telemetria.
 *
 * Devuelve tambien `deviceId`, y la app lo estaba descartando: el tipo solo declaraba `sessionId`.
 * Sin el, el lote de telemetria no se puede mandar —el backend lo exige para atar los eventos al
 * dispositivo—, asi que la sesion se abria y nunca se le escribia nada.
 */
export const startSession = (customerId: string, body: SessionStartInput) =>
  request<{ sessionId: string; deviceId: string; deviceTrustLevel?: string; nextStep?: string }>(
    `/customers/${customerId}/sessions/start`,
    { method: 'POST', idempotent: true, body },
  );

export const endSession = (customerId: string, sessionId: string, reasonCode = 'customer_logout') =>
  request<{ ended: boolean }>(`/customers/${customerId}/sessions/${sessionId}/end`, {
    method: 'POST',
    body: { reasonCode },
  });

export type CreditProduct = {
  productId: string;
  productName: string;
  description: string | null;
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  annualInterestRate: number | null;
  canApply: boolean;
};

export const listCreditProducts = (customerId: string) =>
  request<{ customerId: string; eligible: boolean; blockers: Blocker[]; products: CreditProduct[] }>(
    `/customers/${customerId}/credit-products`,
  );

export const listCreditApplications = (customerId: string) =>
  request<{ applications: { applicationId: string; status: string; requestedAmount: number; createdAt: string }[] }>(
    `/customers/${customerId}/credit-applications`,
  );
