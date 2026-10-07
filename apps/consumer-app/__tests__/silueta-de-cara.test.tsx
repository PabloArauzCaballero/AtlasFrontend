import { render, screen } from '@testing-library/react-native';
import { SILUETA_FRENTE, SILUETA_PERFIL, SiluetaDeCara, silutaDe, trazosDe } from '../src/ui/silueta-de-cara';

/**
 * La silueta de la selfie es la CARA —no el cuerpo—, de frente o girando. Se fija QUÉ silueta toca a cada pose (al girar a
 * la izquierda se ve la oreja derecha y la nariz apunta a la izquierda de la pantalla, que es un espejo) y que el contorno
 * se cierra en el mentón, sin cuello ni hombros.
 */
describe('silueta de la selfie', () => {
  it('cada pose de la prueba de vida tiene su silueta', () => {
    expect(silutaDe('selfie')).toBe('frente');
    expect(silutaDe('selfie_left')).toBe('izquierda');
    expect(silutaDe('selfie_right')).toBe('derecha');
  });

  it('de frente: contorno, las dos orejas y guías; sin espejo', () => {
    const t = trazosDe('frente');
    expect(t.contorno).toBe(SILUETA_FRENTE);
    expect(t.guias).not.toBeNull();
    expect(t.espejo).toBe(false);
  });

  it('girar a la derecha es el MISMO perfil en espejo, no otro dibujo que se desincronice', () => {
    const izq = trazosDe('izquierda');
    const der = trazosDe('derecha');
    expect(izq.contorno).toBe(SILUETA_PERFIL);
    expect(der.contorno).toBe(izq.contorno);
    expect(izq.espejo).toBe(false);
    expect(der.espejo).toBe(true);
  });

  it('es SÓLO la cara: el contorno se cierra en el mentón y no baja a cuello ni hombros', () => {
    for (const trazo of [SILUETA_FRENTE, SILUETA_PERFIL]) {
      // Nada del lienzo de antes (hombros hasta y=700, cuello a y>290): todo cabe en 300 de alto.
      const ys = [...trazo.matchAll(/(?:^|[ ,])(\d+(?:\.\d+)?)(?= |$)/g)].map((m) => Number(m[1]));
      expect(Math.max(...ys)).toBeLessThanOrEqual(300);
      expect(trazo).not.toMatch(/L \d+ 700/);
      expect(trazo.trim().endsWith('Z')).toBe(true);
    }
  });

  it('se pinta con su identificador para que la prueba de vida lo encuentre', async () => {
    await render(<SiluetaDeCara pose="frente" color="#2ee6b0" testID="prueba-de-vida-ovalo" />);
    expect(screen.getByTestId('prueba-de-vida-ovalo')).toBeTruthy();
  });
});
