/** Autenticacion del cliente final. Espeja `AtlasBackend/src/modules/auth`. */
import { request } from '../client';

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
};

export type MeResponse = {
  actorType: 'customer' | 'internal_user' | 'platform_user';
  actorId: string;
  tenantId: string;
  role: string;
  customerId?: string;
};

/** `identifier` es el mismo telefono o email que la persona uso en el registro. */
export const login = (identifier: string, password: string) =>
  request<LoginResponse>('/auth/login', {
    method: 'POST',
    anonymous: true,
    body: { actorType: 'customer', identifier, password },
  });

export const me = () => request<MeResponse>('/auth/me');

export const logout = (refreshToken: string, allDevices = false) =>
  request<{ revoked: boolean }>('/auth/logout', { method: 'POST', anonymous: true, body: { refreshToken, allDevices } });

export const requestPasswordReset = (email: string) =>
  request<{ requested: boolean }>('/auth/password-reset/request', {
    method: 'POST',
    anonymous: true,
    body: { actorType: 'customer', identifier: email },
  });

export const confirmPasswordReset = (input: { email: string; code: string; newPassword: string }) =>
  request<{ updated: boolean }>('/auth/password-reset/confirm', {
    method: 'POST',
    anonymous: true,
    body: { actorType: 'customer', identifier: input.email, code: input.code, newPassword: input.newPassword },
  });

/**
 * MFA opt-in del cliente. El backend responde `{ mfaEnabled }` (no `enabled`); con MFA activo el
 * próximo login pide el PIN por correo. Activarlo exige correo configurado en el servidor (503 si no).
 */
export const setMfaPreference = (enabled: boolean) =>
  request<{ mfaEnabled: boolean }>('/auth/mfa', { method: 'POST', body: { enabled } });
