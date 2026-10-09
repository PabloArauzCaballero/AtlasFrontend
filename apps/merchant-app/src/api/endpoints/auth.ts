/**
 * Autenticación del comercio. Mismas rutas que `AtlasERPFrontend/services/authService.ts` (canal
 * `auth/merchant/*`); el comercio no tiene segundo factor ni PIN, igual que en la web.
 */
import { apiRequest } from '../client';

export interface MerchantUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  userCode: string | null;
  phone: string | null;
  role: 'merchant';
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface MerchantAuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: MerchantUserProfile;
}

export interface PinChallenge {
  pinChallengeRequired: true;
  challengeToken: string;
  expiresInMinutes: number;
}

export const authApi = {
  login(body: { email: string; password: string }) {
    return apiRequest<MerchantAuthResponse>('auth/merchant/login', { method: 'POST', body, skipAuthRetry: true });
  },
  me() {
    return apiRequest<{ user: MerchantUserProfile }>('auth/merchant/me');
  },
  logout(allDevices = false) {
    return apiRequest<{ loggedOut: boolean }>('auth/merchant/logout', { method: 'POST', body: { allDevices }, skipAuthRetry: true });
  },
  /** «Olvidé mi contraseña»: la respuesta es la misma exista o no la cuenta. */
  requestPasswordReset(body: { email: string }) {
    return apiRequest<{ requested: boolean }>('auth/merchant/password-reset/request', { method: 'POST', body, skipAuthRetry: true });
  },
  confirmPasswordReset(body: { email: string; code: string; newPassword: string }) {
    return apiRequest<{ passwordChanged: boolean }>('auth/merchant/password-reset/confirm', { method: 'POST', body, skipAuthRetry: true });
  },
  /** Cambiar la contraseña con la sesión abierta: pide la actual y confirma con un código al correo. */
  requestPasswordChange(body: { currentPassword: string }) {
    return apiRequest<PinChallenge>('auth/password/change/request', { method: 'POST', body });
  },
  confirmPasswordChange(body: { challengeToken: string; code: string; newPassword: string }) {
    return apiRequest<{ passwordChanged: boolean }>('auth/password/change/confirm', { method: 'POST', body });
  },
};
