import { shouldRefreshOn } from '../src/api/client';
import { AtlasApiError } from '../src/api/errors';
import { changeEmailFailure, domainOf, emailError } from '../src/features/change-email';

function apiError(code: string, status: number, kind: AtlasApiError['kind'] = 'conflict') {
  return new AtlasApiError({ kind, code, message: code, status });
}

describe('emailError', () => {
  it('acepta un correo normal, con espacios alrededor', () => {
    expect(emailError('  ana.perez@ejemplo.bo ')).toBeNull();
  });

  it('pide el correo cuando está vacío', () => {
    expect(emailError('   ')).toBe('Escribe tu correo.');
  });

  it.each(['ana', 'ana@', 'ana@ejemplo', 'a@b.c', 'ana perez@ejemplo.bo', `${'a'.repeat(175)}@ej.bo`])('rechaza %s', (value) => {
    expect(emailError(value)).toMatch(/Revisa el correo/);
  });
});

describe('changeEmailFailure', () => {
  it('«ya lo tienes verificado» va al campo del correo, no a un aviso de «otra cuenta»', () => {
    expect(changeEmailFailure(apiError('CONTACT_ALREADY_VERIFIED', 409), 'email')).toEqual(
      expect.objectContaining({ kind: 'field', field: 'email' }),
    );
  });

  it('el correo de otra cuenta es un aviso de la pantalla', () => {
    expect(changeEmailFailure(apiError('CONTACT_ALREADY_REGISTERED', 409), 'code')).toEqual(
      expect.objectContaining({ kind: 'banner', title: 'Ese correo pertenece a otra cuenta' }),
    );
  });

  it('un código incorrecto o vencido se cuelga del campo del código', () => {
    expect(changeEmailFailure(apiError('INVALID_VERIFICATION_CODE', 401, 'auth'), 'code')).toEqual(
      expect.objectContaining({ kind: 'field', field: 'code' }),
    );
    expect(changeEmailFailure(apiError('VERIFICATION_CODE_EXPIRED', 401, 'auth'), 'code')).toEqual(
      expect.objectContaining({ kind: 'field', field: 'code', message: 'El código venció. Pide uno nuevo.' }),
    );
  });

  it('un 400 de validación en el paso del correo marca el correo', () => {
    expect(changeEmailFailure(apiError('VALIDATION_ERROR', 400, 'validation'), 'email')).toEqual(
      expect.objectContaining({ kind: 'field', field: 'email' }),
    );
  });

  it('lo desconocido (red, caída, otro error) queda para el descriptor general', () => {
    expect(changeEmailFailure(apiError('SOMETHING_ELSE', 500, 'server'), 'code')).toBeNull();
    expect(changeEmailFailure(new Error('boom'), 'email')).toBeNull();
  });
});

describe('domainOf', () => {
  it('devuelve el dominio en minúsculas', () => {
    expect(domainOf(' Ana@Ejemplo.BO ')).toBe('ejemplo.bo');
  });
});

describe('shouldRefreshOn', () => {
  it('un token vencido sí justifica refrescar', () => {
    expect(shouldRefreshOn(apiError('UNAUTHORIZED', 401, 'auth'))).toBe(true);
  });

  it('un código de verificación mal escrito NO: reenviarlo gastaría otro intento', () => {
    expect(shouldRefreshOn(apiError('INVALID_VERIFICATION_CODE', 401, 'auth'))).toBe(false);
    expect(shouldRefreshOn(apiError('VERIFICATION_CODE_EXPIRED', 401, 'auth'))).toBe(false);
  });

  it('lo que no es de autenticación no se refresca', () => {
    expect(shouldRefreshOn(apiError('CONTACT_ALREADY_VERIFIED', 409))).toBe(false);
  });
});
