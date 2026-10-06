import { AtlasApiError } from '../src/api/errors';
import { errorDeLinea } from '../src/features/use-credit-book';

/**
 * C1 (Pablo, 2026-10-06): «Todavía estamos calculando tu línea» sólo puede salir cuando de verdad no hay línea
 * todavía (404). Si el motor no respondió (503) o falló la red, la tarjeta tiene que decirlo y dejar reintentar.
 */
const error = (status: number, code: string) => new AtlasApiError({ kind: 'server', code, message: code, status });

describe('errorDeLinea', () => {
  it('404 no es un error: el cliente todavía no tiene línea', () => {
    expect(errorDeLinea(error(404, 'CREDIT_LINE_NOT_CALCULATED'))).toBeNull();
  });

  it('503 del motor se dice con su causa', () => {
    expect(errorDeLinea(error(503, 'CREDIT_LINE_ENGINE_UNAVAILABLE'))).toMatch(/motor de decisión no respondió/);
  });

  it('cualquier otro fallo (red, 500) también es un error, nunca «calculando»', () => {
    expect(errorDeLinea(new Error('network'))).toMatch(/No pudimos consultar tu crédito/);
    expect(errorDeLinea(error(500, 'INTERNAL'))).toMatch(/No pudimos consultar tu crédito/);
  });
});
