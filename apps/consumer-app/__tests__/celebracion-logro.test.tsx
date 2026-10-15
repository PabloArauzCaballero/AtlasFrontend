import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Logro } from "../src/features/celebraciones";
import * as Haptics from "expo-haptics";
import { CelebracionDeLogro, ARENGA } from "../src/ui/celebracion-logro";
import { RANGO } from "../src/ui/trofeo";

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
    expect(screen.getByText("INSIGNIA · ORO")).toBeTruthy();
    expect(screen.getByText("Racha de 6")).toBeTruthy();
    expect(screen.getByText(ARENGA.oro)).toBeTruthy();
    expect(screen.getByText("Seis cuotas seguidas a tiempo.")).toBeTruthy();
    expect(screen.getByText("Colección «Rachas»: 2 de 4")).toBeTruthy();
    expect(screen.getByText(/Lo próximo: «Racha de 12» · 6 de 12/)).toBeTruthy();
  });

  it("el botón la cierra tras el relevo, y dos toques no la cierran dos veces", async () => {
    jest.useFakeTimers();
    const onCerrar = jest.fn();
    await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 1 }} onCerrar={onCerrar} />));
    await fireEvent.press(screen.getByTestId("celebracion-cerrar"));
    await fireEvent.press(screen.getByTestId("celebracion-cerrar"));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("con más de una en la ceremonia ofrece «Saltar todas», que las cierra de una vez; en la última, no", async () => {
    jest.useFakeTimers();
    const onSaltarTodas = jest.fn();
    const onCerrar = jest.fn();
    const { rerender } = await render(
      envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 3 }} onCerrar={onCerrar} onSaltarTodas={onSaltarTodas} />),
    );
    expect(screen.getByText("LOGRO 1 DE 3")).toBeTruthy();
    expect(screen.getByText("Saltar todas (3)")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("celebracion-saltar-todas"));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(onSaltarTodas).toHaveBeenCalledTimes(1);
    expect(onCerrar).not.toHaveBeenCalled();
    await rerender(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 3, total: 3 }} onCerrar={onCerrar} onSaltarTodas={onSaltarTodas} />));
    expect(screen.queryByTestId("celebracion-saltar-todas")).toBeNull();
    jest.useRealTimers();
  });

  it("en una cola dice cuántas van, y sólo en la última habla de las que no cupieron", async () => {
    const { rerender } = await render(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 1, total: 3 }} masSinMostrar={2} onCerrar={jest.fn()} />));
    expect(screen.getByText("Siguiente (1 de 3)")).toBeTruthy();
    expect(screen.queryByText(/te esperan en tu vitrina/)).toBeNull();
    await rerender(envolver(<CelebracionDeLogro logro={insignia()} posicion={{ actual: 3, total: 3 }} masSinMostrar={2} onCerrar={jest.fn()} />));
    expect(screen.getByText("Continuar")).toBeTruthy();
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
    expect(screen.getByText("NUEVO NIVEL")).toBeTruthy();
    expect(screen.getByText("Explorador")).toBeTruthy();
    expect(screen.getByText(/Nivel 2 de 12/)).toBeTruthy();
    expect(screen.getByText(/Lo próximo: «En crecimiento» · te faltan 150 puntos/)).toBeTruthy();
  });
});

describe("ceremonia, no fiesta (2026-10-15)", () => {
  it("el rango se lee por escrito y por sus marcas, de una a cinco, no por un color", () => {
    const marcas = (["bronce", "plata", "oro", "platino", "diamante"] as const).map((r) => RANGO[r].marcas);
    expect(marcas).toEqual([1, 2, 3, 4, 5]);
  });

  it("las frases son sobrias: ninguna lleva signos de exclamación", () => {
    for (const frase of Object.values(ARENGA)) expect(frase).not.toMatch(/[¡!]/);
  });

  it("un único aviso háptico de éxito al asentarse; ni golpes pesados ni cascada", async () => {
    jest.useFakeTimers();
    const impacto = Haptics.impactAsync as jest.Mock;
    const aviso = Haptics.notificationAsync as jest.Mock;
    impacto.mockClear();
    aviso.mockClear();
    const diamante: Logro = { ...insignia(), rango: "diamante" } as Logro;
    const { unmount } = await render(envolver(<CelebracionDeLogro logro={diamante} posicion={{ actual: 1, total: 1 }} onCerrar={jest.fn()} />));
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(impacto).not.toHaveBeenCalled();
    await unmount();
    jest.useRealTimers();
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
