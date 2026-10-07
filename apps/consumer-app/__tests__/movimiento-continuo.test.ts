import { suavidad } from '../src/ui/motion';

/**
 * Un movimiento «natural» es uno sin saltos: ni de posición ni de velocidad. La versión anterior de `Vivo` envolvía la
 * fase con `% 1` y el valor saltaba de ~1 a ~0 en cada ciclo de todo icono con desfase (la casa se sacudía, el escudo
 * cambiaba de tamaño en seco). Estas pruebas recorren el ciclo entero y fallan ante cualquier salto.
 */
const PASO = 0.001;
const DESFASES_MS = [0, 137, 400, 811, 1199];
const PERIODOS_MS = [1500, 2600, 3600, 7000];

/** La fórmula anterior, conservada sólo para demostrar que estas pruebas SÍ cazan el defecto. */
const antigua = (fase: number, retardo: number, periodo: number) => {
  const t = (fase + retardo / periodo) % 1;
  return t;
};

describe('suavidad (la curva de Vivo)', () => {
  it('queda entre 0 y 1 siempre', () => {
    for (const periodo of PERIODOS_MS)
      for (const retardo of DESFASES_MS)
        for (let f = 0; f <= 1; f += PASO) {
          const v = suavidad(f, retardo, periodo);
          expect(v).toBeGreaterThanOrEqual(-1e-9);
          expect(v).toBeLessThanOrEqual(1 + 1e-9);
        }
  });

  it('no salta nunca: entre dos muestras vecinas la diferencia es minúscula, también al cerrar el ciclo', () => {
    for (const periodo of PERIODOS_MS)
      for (const retardo of DESFASES_MS) {
        let anterior = suavidad(0, retardo, periodo);
        for (let f = PASO; f <= 1 + 1e-9; f += PASO) {
          const v = suavidad(f, retardo, periodo);
          expect(Math.abs(v - anterior)).toBeLessThan(0.01);
          anterior = v;
        }
      }
  });

  it('el final del ciclo coincide con el principio para cualquier desfase (se encadena sin costura)', () => {
    for (const periodo of PERIODOS_MS)
      for (const retardo of DESFASES_MS) expect(suavidad(1, retardo, periodo)).toBeCloseTo(suavidad(0, retardo, periodo), 9);
  });

  it('la velocidad también es continua: no hay un cambio brusco de pendiente', () => {
    const periodo = 3600;
    for (const retardo of DESFASES_MS) {
      let ant = suavidad(PASO, retardo, periodo) - suavidad(0, retardo, periodo);
      for (let f = 2 * PASO; f <= 1 + 1e-9; f += PASO) {
        const pendiente = suavidad(f, retardo, periodo) - suavidad(f - PASO, retardo, periodo);
        expect(Math.abs(pendiente - ant)).toBeLessThan(0.0005);
        ant = pendiente;
      }
    }
  });

  it('desfases distintos dan fases distintas: dos iconos hermanos no laten a la vez', () => {
    expect(suavidad(0.3, 0, 3600)).not.toBeCloseTo(suavidad(0.3, 700, 3600), 2);
  });

  it('prueba de que el test sirve: la fórmula ANTERIOR sí salta al cerrar el ciclo con desfase', () => {
    let salto = 0;
    let anterior = antigua(0, 811, 3600);
    for (let f = PASO; f <= 1; f += PASO) {
      const v = antigua(f, 811, 3600);
      salto = Math.max(salto, Math.abs(v - anterior));
      anterior = v;
    }
    expect(salto).toBeGreaterThan(0.9);
  });
});
