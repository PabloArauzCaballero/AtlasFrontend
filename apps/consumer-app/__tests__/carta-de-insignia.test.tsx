import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Badge } from "../src/api/endpoints/credit-line";
import { logroDeInsignia } from "../src/features/celebraciones";
import { CartaDeInsignia, fechaLarga } from "../src/ui/carta-de-insignia";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

const b = (extra: Partial<Badge> = {}): Badge => ({
  code: "x", label: "Racha de 6", detail: "Seis cuotas seguidas a tiempo.", icon: "fuego", rank: "oro", category: "rachas",
  secret: false, hint: null, earned: false, current: 4, target: 6, ...extra,
});
const logro = (badge: Badge) => logroDeInsignia({ ...PROGRESO_DE_PRUEBA, experience: { ...PROGRESO_DE_PRUEBA.experience, badges: [badge] } }, badge) as Extract<ReturnType<typeof logroDeInsignia>, { tipo: "insignia" }>;
const pintar = (badge: Badge, onRevivir = jest.fn(), onCerrar = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <CartaDeInsignia logro={logro(badge)} onCerrar={onCerrar} onRevivir={onRevivir} />
    </SafeAreaProvider>,
  );

describe("fechaLarga", () => {
  it("una fecha válida sale en español; una que no se entiende, no sale", () => {
    expect(fechaLarga("2026-10-07T12:00:00Z")).toMatch(/2026/);
    expect(fechaLarga("no es fecha")).toBeNull();
    expect(fechaLarga(null)).toBeNull();
  });
});

describe("CartaDeInsignia", () => {
  it("pendiente: dice cuánto falta y no ofrece la celebración", async () => {
    await pintar(b());
    expect(screen.getByText("Racha de 6")).toBeTruthy();
    expect(screen.getByText("Te faltan 2")).toBeTruthy();
    expect(screen.queryByTestId("carta-revivir")).toBeNull();
  });

  it("ganada: sello, sin puntos (las insignias no dan) y sin fecha si el servidor no la manda", async () => {
    await pintar(b({ earned: true, current: 6 }));
    expect(screen.getByText("GANADA")).toBeTruthy();
    expect(screen.queryByText("puntos")).toBeNull();
    expect(screen.queryByText(/^El /)).toBeNull();
    expect(screen.getByTestId("carta-revivir")).toBeTruthy();
  });

  it("ganada con fecha del servidor: la enseña", async () => {
    await pintar(b({ earned: true, current: 6, earnedAt: "2026-10-07T12:00:00Z" }));
    expect(screen.getByText(/^El .*2026/)).toBeTruthy();
  });

  it("una secreta sin ganar enseña su pista, no su nombre", async () => {
    await pintar(b({ secret: true, hint: "Tropezar no es el final.", label: "La remontada" }));
    expect(screen.queryByText("La remontada")).toBeNull();
    expect(screen.getByText("Insignia secreta")).toBeTruthy();
  });

  it("cerrar y revivir llaman a lo suyo", async () => {
    const onRevivir = jest.fn();
    const onCerrar = jest.fn();
    await pintar(b({ earned: true, current: 6 }), onRevivir, onCerrar);
    await fireEvent.press(screen.getByTestId("carta-revivir"));
    await fireEvent.press(screen.getByTestId("carta-cerrar"));
    expect(onRevivir).toHaveBeenCalledTimes(1);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
