import { faseDeSesion, IDLE_LIMIT_MS } from '../src/session/limites';

test('activa, aviso en el último minuto y cierre a los 15 minutos', () => {
  expect(faseDeSesion(0, IDLE_LIMIT_MS - 61_000)).toEqual({ fase: 'activa' });
  expect(faseDeSesion(0, IDLE_LIMIT_MS - 59_500)).toEqual({ fase: 'aviso', segundos: 60 });
  expect(faseDeSesion(0, IDLE_LIMIT_MS)).toEqual({ fase: 'cerrar' });
  // Volver tras horas en segundo plano cierra de inmediato.
  expect(faseDeSesion(0, 5 * IDLE_LIMIT_MS)).toEqual({ fase: 'cerrar' });
});
