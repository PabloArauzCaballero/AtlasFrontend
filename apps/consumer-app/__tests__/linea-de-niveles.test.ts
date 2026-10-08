import { desplazamientoInicial } from "../src/ui/linea-de-niveles";

describe("desplazamientoInicial («Nuevo» arriba, el nivel más alto abajo)", () => {
  const FILA = 68;
  it("tu nivel es «Nuevo» (arriba del todo): el scroll queda al principio", () => {
    expect(desplazamientoInicial(0, 12, 313)).toBe(0);
  });
  it("sin nivel actual, abre arriba", () => {
    expect(desplazamientoInicial(-1, 12, 313)).toBe(0);
  });
  it("tu nivel más abajo: lo deja arriba de lo visible con el anterior asomando", () => {
    expect(desplazamientoInicial(5, 12, 313)).toBe(4 * FILA + FILA * 0.6);
  });
  it("tu nivel es el último: no pasa del final", () => {
    expect(desplazamientoInicial(11, 12, 313)).toBe(12 * FILA - 313);
  });
  it("nunca se sale del contenido", () => {
    for (let i = 0; i < 12; i += 1) {
      const y = desplazamientoInicial(i, 12, 313);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(12 * FILA - 313);
    }
  });
});
