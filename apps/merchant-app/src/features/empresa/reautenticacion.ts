/**
 * Pedir la contraseña otra vez antes de cambiar el QR de cobro (hallazgo ERP-03).
 *
 * Es `authService.merchantReauthenticate` de la web. Vive aquí y no en `api/endpoints/auth.ts`
 * porque sólo lo usa «Mi QR de cobro»: el backend devuelve una prueba de un solo uso que vence a los
 * 5 minutos y que viaja en `x-reauth-token` al registrar el QR.
 */
import { apiRequest } from '@/api/client';

export function reautenticarComercio(password: string) {
  return apiRequest<{ reauthToken: string; expiresInSeconds: number; expiresAt: string }>('auth/merchant/reauthenticate', {
    method: 'POST',
    body: { password },
  });
}
