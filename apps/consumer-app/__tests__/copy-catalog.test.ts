import { COPY } from '../src/features/copy-catalog';
import { hallazgos } from './textos-verdaderos.test';

describe('el catálogo de textos de fábrica', () => {
  const entradas = Object.entries(COPY) as [string, { pantalla: string; donde: string; titulo?: string; texto: string }][];

  it('cada clave dice dónde sale y tiene texto', () => {
    expect(entradas.length).toBeGreaterThan(10);
    for (const [clave, entrada] of entradas) {
      expect({ clave, pantalla: entrada.pantalla.trim().length > 0 }).toEqual({ clave, pantalla: true });
      expect({ clave, donde: entrada.donde.trim().length > 0 }).toEqual({ clave, donde: true });
      expect({ clave, texto: entrada.texto.trim().length > 0 }).toEqual({ clave, texto: true });
    }
  });

  it('ningún texto de fábrica dice algo que el sistema no hace (misma lista de frases prohibidas de la app)', () => {
    for (const [clave, entrada] of entradas) {
      const malos = hallazgos(`${entrada.titulo ?? ''} ${entrada.texto}`, true);
      expect({ clave, malos }).toEqual({ clave, malos: [] });
    }
  });

  it('las claves siguen el formato pantalla.lugar para poder agruparlas en el portal', () => {
    for (const [clave] of entradas) expect(clave).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
  });
});
