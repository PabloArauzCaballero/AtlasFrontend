import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Logro } from "../src/features/celebraciones";
import { CelebracionDeLogro, ARENGA, PARTICULAS, azar, trazoDe } from "../src/ui/celebracion-logro";

/**
 * La escena de un logro: dice qué se ganó, de qué colección y lo siguiente más cercano; pasa de uno a otro en una cola;
 * y la fiesta crece con el rango.
 */
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const envolver = (ui: ReactElement) => <SafeAreaProvider initialMetrics={METRICAS}>{ui}</SafeAreaProvider>;

const insignia = (extra: Partial<Extract<Logro, { tipo: "insignia" }>> = {}): Logro => ({
  tipo: "insignia",
  insignia: {
    code: "racha_6",
    label: "Racha de 6",
    detail: "Seis cuotas seguidas a tiempo.",
    icon: "fuego",
    rank: "oro",
    category: "rachas",
    secret: false,
    hint: null,
    earned: true,
    current: 6,
    target: 6,
  },
  rango: "oro",
  coleccion: { ganadas: 2, total: 4 },
  siguiente: {
    code: "racha_12",
    label: "Racha de 12",
    detail: "Doce seguidas.",
    icon: "rayo",
    earned: false,
    current: 6,
    target: 12,
  },
  ...extra,
});

describe("CelebracionDeLogro · insignia", () => {
  it("anuncia la insignia con su rango, su nombre, su colección y lo próximo", async () => {
    await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    expect(screen.getByText("¡INSIGNIA DE ORO!")).toBeTruthy();
    expect(screen.getByText("Racha de 6")).toBeTruthy();
    expect(screen.getByText(ARENGA.oro)).toBeTruthy();
    expect(screen.getByText("Seis cuotas seguidas a tiempo.")).toBeTruthy();
    expect(screen.getByText("Colección «Rachas»: 2 de 4")).toBeTruthy();
    expect(screen.getByText(/Lo próximo: «Racha de 12» · 6 de 12/)).toBeTruthy();
  });

  it("el botón la cierra", async () => {
    const onCerrar = jest.fn();
    await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 1 }} onCerrar={onCerrar} />));
    await fireEvent.press(screen.getByTestId("celebracion-cerrar"));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("en una cola dice cuántas van, y sólo en la última habla de las que no cupieron", async () => {
    const { rerender } = await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 3 }} masSinMostrar={2} onCerrar={jest.fn()} />));
    expect(screen.getByText("Siguiente (1 de 3)")).toBeTruthy();
    expect(screen.queryByText(/te esperan en tu vitrina/)).toBeNull();
    await rerender(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 3, total: 3 }} masSinMostrar={2} onCerrar={jest.fn()} />));
    expect(screen.getByText("¡Genial!")).toBeTruthy();
    expect(screen.getByText("Y 2 logros más te esperan en tu vitrina.")).toBeTruthy();
  });

  it("sin lo siguiente ni colección (backend anterior) no inventa nada", async () => {
    await render(envolver(<CelebracionDeLogro logro={insignia({ coleccion: null, siguiente: null })} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    expect(screen.queryByText(/Colección/)).toBeNull();
    expect(screen.queryByText(/Lo próximo/)).toBeNull();
  });

  it("es una capa modal para el lector de pantalla y se anuncia", async () => {
    await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    expect(screen.getByLabelText("Insignia ganada: Racha de 6")).toBeTruthy();
  });
});

describe("CelebracionDeLogro · nivel", () => {
  const nivel: Logro = {
    tipo: "nivel",
    nivel: { id: "EXPLORADOR", label: "Explorador", index: 2, of: 12 },
    rango: "bronce",
    siguiente: { label: "En crecimiento", pointsMissing: 150, porcentaje: 62 },
  };

  it("celebra el cambio de nivel con su escudo y lo que falta para el siguiente", async () => {
    await render(envolver(<CelebracionDeLogro logro={nivel} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    expect(screen.getByText("¡SUBISTE DE NIVEL!")).toBeTruthy();
    expect(screen.getByText("Explorador")).toBeTruthy();
    expect(screen.getByText(/Nivel 2 de 12/)).toBeTruthy();
    expect(screen.getByText(/Lo próximo: «En crecimiento» · te faltan 150 puntos/)).toBeTruthy();
  });
});

describe("la fiesta crece con el rango", () => {
  it("más partículas cuanto más difícil", () => {
    const n = (["bronce", "plata", "oro", "platino", "diamante"] as const).map((r) => PARTICULAS[r]);
    expect(n).toEqual([...n].sort((a, b) => a - b));
    expect(new Set(n).size).toBe(5);
  });

  it("la ráfaga es determinista: la misma partícula sale siempre igual", () => {
    expect(trazoDe(7, "oro", 1)).toEqual(trazoDe(7, "oro", 1));
    expect(azar(3, 1)).toBe(azar(3, 1));
  });

  it("las partículas del diamante usan colores de prisma y las del bronce no", () => {
    const colores = (r: "bronce" | "diamante") => new Set(Array.from({ length: 64 }, (_, i) => trazoDe(i, r, 1).color));
    expect(colores("diamante").size).toBeGreaterThan(colores("bronce").size);
  });

  it("cada partícula arranca dentro de su ventana y gira a su manera", () => {
    for (let i = 0; i < 64; i += 1) {
      const t = trazoDe(i, "diamante", 1);
      expect(t.retardo).toBeGreaterThanOrEqual(0);
      expect(t.retardo).toBeLessThan(0.13);
      expect(t.velocidad).toBeGreaterThan(100);
    }
  });
});

describe("las pruebas no dejan temporizadores colgados", () => {
  it("desmontar a media escena no revienta", async () => {
    jest.useFakeTimers();
    const { unmount } = await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    jest.useRealTimers();
  });
});
