import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Badge, Progress } from "../src/api/endpoints/credit-line";
import { CelebracionesHost, ESPERA_MS } from "../src/ui/celebraciones-host";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

/**
 * El anfitrión: mira el progreso, anota lo visto y celebra sólo lo nuevo y sólo en un sitio tranquilo.
 */
let mockRuta = "/";
const mockObtener = jest.fn();
jest.mock("expo-router", () => ({ usePathname: () => mockRuta }));
jest.mock("../src/session/session", () => ({ useSession: () => ({ customerId: "42" }) }));
jest.mock("../src/ui/tour", () => ({ useTour: () => ({ activo: false }) }));
jest.mock("../src/api/endpoints/credit-line", () => ({ getProgress: (...a: unknown[]) => mockObtener(...a) }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <CelebracionesHost />
    </SafeAreaProvider>,
  );

const insignia = (code: string, earned: boolean): Badge => ({
  code,
  label: `Logro ${code}`,
  detail: "d",
  icon: "estrella",
  rank: "plata",
  category: "pagos",
  secret: false,
  hint: null,
  earned,
  current: earned ? 1 : 0,
  target: 1,
});
const progreso = (...badges: Badge[]): Progress => ({
  ...PROGRESO_DE_PRUEBA,
  level: undefined,
  nextLevel: undefined,
  levelLadder: undefined,
  points: undefined,
  experience: { ...PROGRESO_DE_PRUEBA.experience, xp: 0, badges },
});

const pasar = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(async () => {
  jest.useFakeTimers();
  mockRuta = "/";
  mockObtener.mockReset();
  await AsyncStorage.clear();
});
afterEach(() => jest.useRealTimers());

it("la primera vez en el teléfono NO celebra lo ya ganado: lo anota", async () => {
  mockObtener.mockResolvedValue(progreso(insignia("a", true), insignia("b", true)));
  await montar();
  await pasar(2000);
  await pasar(ESPERA_MS + 100);
  expect(screen.queryByTestId("celebracion-logro")).toBeNull();
  expect(JSON.parse((await AsyncStorage.getItem("atlas.logros.vistos.v1:42"))!).insignias).toEqual(["a", "b"]);
});

it("una insignia nueva se celebra tras el respiro, y no se repite al volver a mirar", async () => {
  await AsyncStorage.setItem("atlas.logros.vistos.v1:42", JSON.stringify({ insignias: ["a"], nivel: "NUEVO" }));
  mockObtener.mockResolvedValue(progreso(insignia("a", true), insignia("b", true)));
  await montar();
  await pasar(100);
  // Hay que dejar que la pantalla termine de entrar antes de celebrar.
  expect(screen.queryByTestId("celebracion-logro")).toBeNull();
  await pasar(ESPERA_MS + 100);
  expect(screen.getByTestId("celebracion-logro")).toBeTruthy();
  expect(screen.getByText("Logro b")).toBeTruthy();
  // Ya anotada: aunque se vuelva a mirar, no vuelve a salir.
  expect(JSON.parse((await AsyncStorage.getItem("atlas.logros.vistos.v1:42"))!).insignias).toEqual(["a", "b"]);
});

it("encima de una tarea (pagar) espera; al llegar a una pantalla tranquila, celebra", async () => {
  await AsyncStorage.setItem("atlas.logros.vistos.v1:42", JSON.stringify({ insignias: [], nivel: "NUEVO" }));
  mockObtener.mockResolvedValue(progreso(insignia("a", true)));
  mockRuta = "/pagar/12";
  const { rerender } = await montar();
  await pasar(2000);
  await pasar(ESPERA_MS + 100);
  expect(screen.queryByTestId("celebracion-logro")).toBeNull();
  mockRuta = "/";
  await rerender(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <CelebracionesHost />
    </SafeAreaProvider>,
  );
  await pasar(ESPERA_MS + 100);
  expect(screen.getByTestId("celebracion-logro")).toBeTruthy();
});

it("sin red no pasa nada: ni celebración ni error", async () => {
  mockObtener.mockRejectedValue(new Error("red"));
  await montar();
  await pasar(3000);
  expect(screen.queryByTestId("celebracion-logro")).toBeNull();
});
