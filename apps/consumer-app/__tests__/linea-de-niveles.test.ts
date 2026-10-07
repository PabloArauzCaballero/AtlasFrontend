import { desplazamientoInicial } from "../src/ui/linea-de-niveles";

describe("desplazamientoInicial", () => {
  const FILA = 68;
  it("tu nivel abajo del todo (Nuevo): el scroll queda al final", () => {
    expect(desplazamientoInicial(11, 12, 313)).toBe(12 * FILA - 313);
  });
  it("sin nivel actual, abre abajo", () => {
    expect(desplazamientoInicial(-1, 12, 313)).toBe(12 * FILA - 313);
  });
  it("tu nivel en lo alto: no pasa de 0", () => {
    expect(desplazamientoInicial(0, 12, 313)).toBe(0);
  });
  it("nunca se sale del contenido", () => {
    for (let i = 0; i < 12; i += 1) {
      const y = desplazamientoInicial(i, 12, 313);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(12 * FILA - 313);
    }
  });
});
