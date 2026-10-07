import { RUTA_GUIA_PDF, urlDeLaGuia } from '../src/features/guia-pdf';

describe('urlDeLaGuia', () => {
  it('en el navegador (base relativa) usa la ruta del mismo origen', () => {
    expect(urlDeLaGuia('/api/v1')).toBe(RUTA_GUIA_PDF);
  });

  it('en el teléfono cuelga la guía del dominio que sirve la API', () => {
    expect(urlDeLaGuia('https://atlas.consumerweb.test.arauzsoftware.com/api/v1')).toBe(
      `https://atlas.consumerweb.test.arauzsoftware.com${RUTA_GUIA_PDF}`,
    );
  });

  it('conserva el puerto de un entorno local', () => {
    expect(urlDeLaGuia('http://192.168.0.197:3105/api/v1')).toBe(`http://192.168.0.197:3105${RUTA_GUIA_PDF}`);
  });
});
