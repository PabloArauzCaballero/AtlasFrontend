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

/**
 * Cambio de PIN con la sesión abierta: dos pasos, igual que el login.
 *
 * El backend valida el PIN actual en el primer paso y manda un código de 6 dígitos al correo de la
 * cuenta; el segundo paso lo canjea por el PIN nuevo. Quién cambia se toma del access token: no hay
 * forma de cambiar el PIN de otra persona por aquí.
 */
export const requestPinChange = (currentPassword: string) =>
  request<{
    pinChallengeRequired: boolean;
    challengeToken: string;
    expiresInMinutes: number;
    /** A qué correo se mandó el código, ENMASCARADO (`pa***@gmail.com`). Ausente en un backend que aún no lo manda. */
    deliveredTo?: string | null;
  }>('/auth/password/change/request', {
    method: 'POST',
    body: { currentPassword },
  });

export const confirmPinChange = (input: { challengeToken: string; code: string; newPassword: string }) =>
  request<{ updated: boolean }>('/auth/password/change/confirm', { method: 'POST', body: input });

/**
 * Volver a pedir el PIN con la sesión abierta (antes de enseñar datos personales).
 *
 * No crea sesión ni manda correo. Un PIN incorrecto es un 400 `PIN_INCORRECT` —no un 401— para que el
 * cliente HTTP no lo lea como «sesión caducada» y expulse a la persona al login por un dedo torpe. Sin
 * contador de intentos en el servidor: lo frena un límite de 5 por minuto (429).
 */
export const verifyPin = (pin: string) =>
  request<{ verified: true; verifiedAt: string }>('/auth/pin/verify', { method: 'POST', body: { pin } });
