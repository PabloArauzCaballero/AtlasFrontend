import { COPY } from '../src/features/copy-catalog';

/**
 * Puntaje y Calificación son dos números distintos (Pablo, 2026-10-06): los PUNTOS se ganan pagando y nunca
 * bajan; lo que baja con la mora es la CALIFICACIÓN. Un texto que diga «tu puntaje baja» o «te cuesta puntos»
 * vuelve a mezclarlos y contradice la pestaña «Mis puntos».
 */
describe('los textos no dicen que los puntos bajan', () => {
  const textos = Object.entries(COPY).flatMap(([clave, entrada]) =>
    [entrada.texto, 'titulo' in entrada ? entrada.titulo : undefined].filter(Boolean).map((t) => [clave, String(t)] as const),
  );

  it.each(textos)('%s', (_clave, texto) => {
    expect(texto).not.toMatch(/puntaje baja|puntos? baja|costando puntos|pierdes puntos/i);
  });
});
