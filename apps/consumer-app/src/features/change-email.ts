/**
 * Cambiar el correo de la cuenta: reglas de la pantalla, sin React.
 *
 * Viven aparte para poder probarlas sin montar la pantalla, y porque deciden algo que importa:
 * a QUE campo se le cuelga cada error del servidor. Un «codigo incorrecto» pintado como aviso
 * general deja a la persona sin saber si el problema es el correo o el codigo.
 */
import { AtlasApiError } from '../api/errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** El mismo minimo que exige el backend (`addContactMethodSchema`): 6 a 180 caracteres. */
export function emailError(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) return 'Escribe tu correo.';
  if (value.length < 6 || value.length > 180 || !EMAIL_PATTERN.test(value)) {
    return 'Revisa el correo: debe tener la forma nombre@dominio.com.';
  }
  return null;
}

export type ChangeEmailField = 'email' | 'code';

/** Donde se muestra un error del servidor: debajo de un campo, o como aviso de la pantalla. */
export type ChangeEmailFailure =
  | { kind: 'field'; field: ChangeEmailField; message: string }
  | { kind: 'banner'; title: string; detail: string };

const BY_CODE: Record<string, ChangeEmailFailure> = {
  CONTACT_ALREADY_VERIFIED: {
    kind: 'field',
    field: 'email',
    message: 'Ese correo ya está verificado en tu cuenta. Si quieres cambiarlo, escribe uno distinto.',
  },
  // Al confirmar: el correo es de OTRA cuenta. No se dice de quien, y el codigo ya se gasto.
  CONTACT_ALREADY_REGISTERED: {
    kind: 'banner',
    title: 'Ese correo pertenece a otra cuenta',
    detail: 'No podemos usarlo en la tuya. Escribe otro correo o, si esa cuenta también es tuya, ingresa con ella.',
  },
  INVALID_VERIFICATION_CODE: { kind: 'field', field: 'code', message: 'El código no es correcto. Revísalo e inténtalo de nuevo.' },
  VERIFICATION_CODE_EXPIRED: { kind: 'field', field: 'code', message: 'El código venció. Pide uno nuevo.' },
  VERIFICATION_ATTEMPT_NOT_FOUND: { kind: 'field', field: 'code', message: 'Primero pide un código para este correo.' },
  VERIFICATION_RATE_LIMITED: {
    kind: 'banner',
    title: 'Espera un momento',
    detail: 'Acabamos de enviarte un código. Puedes pedir otro en 30 segundos.',
  },
  VERIFICATION_CHANNEL_UNAVAILABLE: {
    kind: 'banner',
    title: 'No podemos enviar correos ahora',
    detail: 'El envío de correos no está disponible en este momento. Inténtalo más tarde; tu correo actual sigue funcionando.',
  },
  PROFILE_NOT_EDITABLE_IN_STATUS: {
    kind: 'banner',
    title: 'No se puede cambiar el correo',
    detail: 'El estado de tu cuenta no permite cambiar datos de contacto. Escríbenos y lo revisamos contigo.',
  },
};

/**
 * Traduce un error del servidor. Devuelve `null` cuando no es uno de los conocidos: la pantalla cae
 * entonces en `describeError`, que ya sabe hablar de red, sesion y caidas.
 *
 * Un 400 de validacion sobre el paso del correo se cuelga del campo: es el unico dato que se envio.
 */
export function changeEmailFailure(error: unknown, step: 'email' | 'code'): ChangeEmailFailure | null {
  if (!(error instanceof AtlasApiError)) return null;
  const known = BY_CODE[error.code];
  if (known) return known;
  if (step === 'email' && error.status === 400) {
    return { kind: 'field', field: 'email', message: 'Revisa el correo: debe tener la forma nombre@dominio.com.' };
  }
  return null;
}

/** El dominio del correo, que es lo unico que el servidor guarda en claro y la app puede mostrar. */
export function domainOf(email: string): string {
  return email.trim().split('@')[1]?.toLowerCase() ?? '';
}
