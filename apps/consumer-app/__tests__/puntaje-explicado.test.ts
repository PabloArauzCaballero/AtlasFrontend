import {
  avanceDeInsignia,
  cuentaDeUnaParte,
  formatoPuntos,
  fraseDeExperiencia,
  fraseDelResultado, filasDeMisPuntos } from "../src/features/puntaje-explicado";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

/** Lo que se escribe aquí es lo que la persona lee como la razón de su nivel: una cuenta mal dicha destruye la confianza. */
describe("formatoPuntos", () => {
  it.each([
    [22.5, "22,5"],
    [20, "20"],
    [0, "0"],
    [1.6, "1,6"],
    [9.3, "9,3"],
  ])("%s → %s", (n, esperado) => expect(formatoPuntos(n)).toBe(esperado));
});

describe("cuentaDeUnaParte", () => {
  it("dice valor × peso = puntos con los números de la persona", () => {
    expect(
      cuentaDeUnaParte({
        code: "x",
        label: "x",
        value: 50,
        weight: 0.45,
        points: 22.5,
        why: "",
      }),
    ).toBe("50 de 100 × 45 % = 22,5");
  });
  it("un peso de 20 % no sale como 0,2", () => {
    expect(
      cuentaDeUnaParte({
        code: "x",
        label: "x",
        value: 100,
        weight: 0.2,
        points: 20,
        why: "",
      }),
    ).toBe("100 de 100 × 20 % = 20");
  });
});

describe("fraseDelResultado", () => {
  const base = { tier: PROGRESO_DE_PRUEBA.tier };
  it("sin topes, la suma es el nivel", () => {
    expect(
      fraseDelResultado({ ...base, score: 31, rawScore: 31, caps: [] }),
    ).toBe("Tu calificación es 31 de 100.");
  });
  it("con un tope, cuenta cuánto sumaba y por qué el resultado es menor", () => {
    expect(fraseDelResultado(PROGRESO_DE_PRUEBA)).toBe(
      "Tus partes suman 33, pero hay un tope: tu calificación queda en 24.",
    );
  });
  it("un tope que no recortó nada (suma igual al nivel) no se anuncia", () => {
    expect(
      fraseDelResultado({
        ...base,
        score: 20,
        rawScore: 20,
        caps: PROGRESO_DE_PRUEBA.caps,
      }),
    ).toBe("Tu calificación es 20 de 100.");
  });
});

describe("fraseDeExperiencia", () => {
  it("sin puntos dice cómo se ganan: comprando y, sobre todo, pagando a tiempo", () =>
    expect(fraseDeExperiencia(0)).toMatch(/pagando tus cuotas a tiempo/));
  it("con puntos dice de dónde salen, sin la regla vieja de 1 por boliviano", () => {
    expect(fraseDeExperiencia(1250)).toMatch(/comprando y pagando a tiempo/);
    expect(fraseDeExperiencia(1250)).not.toMatch(/cada boliviano/);
  });
});

describe("filasDeMisPuntos", () => {
  it("cuenta cada concepto con su cantidad y sus puntos", () => {
    const filas = filasDeMisPuntos({
      xpBreakdown: {
        purchases: { count: 1, points: 48 },
        onTimeInstallments: { count: 2, points: 100 },
        earlyInstallments: { count: 1, points: 25 },
        settledPurchases: { count: 0, points: 0 },
      },
    });
    expect(filas.map((f) => [f.motivo, f.detalle, f.puntos])).toEqual([
      ["Compras", "1 compra", 48],
      ["Cuotas a tiempo", "2 cuotas", 100],
      ["Pagos adelantados", "1 cuota", 25],
      ["Compras terminadas", "0 compras", 0],
    ]);
  });
  it("sin desglose (backend viejo) no inventa filas", () =>
    expect(filasDeMisPuntos({})).toEqual([]));
});

describe("avanceDeInsignia", () => {
  it("ganada", () =>
    expect(avanceDeInsignia({ earned: true, current: 5, target: 5 })).toBe(
      "Ganada",
    ));
  it("pendiente con el avance real", () =>
    expect(
      avanceDeInsignia({ earned: false, current: 350, target: 1000 }),
    ).toBe("350 de 1.000"));
});
