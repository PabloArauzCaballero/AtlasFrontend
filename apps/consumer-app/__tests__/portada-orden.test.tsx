import { render, screen } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Home from "../app/(app)/(tabs)/index";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

/**
 * El orden de la portada, que es un pedido de negocio y no un detalle de maquetación (Pablo, 2026-10-05):
 * primero SIEMPRE cuánto crédito hay habilitado; después los puntos XP; después la calificación desglosada.
 * Ni el aviso de mora va por encima de la línea.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
}));
const mockSesion = {
  customerId: "42",
  me: { profile: { firstName: "Pablo" } },
  refresh: jest.fn(),
};
jest.mock("../src/session/session", () => ({ useSession: () => mockSesion }));
jest.mock("../src/sandbox/store", () => ({
  useSandbox: () => ({ ready: true, nextDue: null, state: { orders: [] } }),
}));
jest.mock("../src/ui/partner-banner", () => ({
  PartnerBanner: () => null,
  usePartnerBanner: () => null,
}));
jest.mock("../src/ui/surface-content", () => ({
  SurfaceContent: () => null,
  esBannerDePartner: () => false,
  useSurfaceContent: () => [],
}));
jest.mock("../src/features/use-contenido-remoto", () => ({
  useCopy: () => ({ texto: (clave: string) => clave }),
  useTourInicio: () => [],
}));
jest.mock("../src/ui/tour", () => ({
  TourTarget: ({ children }: { children: React.ReactNode }) => children,
  shouldAutoStart: async () => false,
  useTour: () => ({ start: jest.fn() }),
}));

const LINEA = {
  currencyCode: "BOB",
  approvedLimit: 1500,
  used: 250,
  available: 1250,
  maxAffordableInstallment: null,
  disposableIncome: null,
};
const mockLibro: Record<string, unknown> = {};
jest.mock("../src/features/use-credit-book", () => ({
  useCreditBook: () => mockLibro,
}));
const mockNivel: { fase: string; progress: unknown; recargar: jest.Mock } = {
  fase: "lista",
  progress: PROGRESO_DE_PRUEBA,
  recargar: jest.fn(),
};
jest.mock("../src/features/use-progress", () => ({
  useProgress: () => mockNivel,
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = async () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Home />
    </SafeAreaProvider>,
  );

/** Todos los textos pintados, en el orden en que aparecen de arriba abajo. */
function textosEnOrden(): string[] {
  const plano = (hijos: unknown): string =>
    Array.isArray(hijos) ? hijos.map(plano).join("") : typeof hijos === "string" || typeof hijos === "number" ? String(hijos) : "";
  return screen.getAllByText(/\S/).map((nodo) => plano(nodo.props.children));
}

/** En qué posición aparece el primer texto que contiene cada fragmento: menor es más arriba. */
function posiciones(fragmentos: string[]): number[] {
  const textos = textosEnOrden();
  return fragmentos.map((fragmento) => textos.findIndex((texto) => texto.includes(fragmento)));
}

function libro(extra: Record<string, unknown> = {}) {
  Object.assign(mockLibro, {
    ready: true,
    error: null,
    reload: jest.fn(),
    loans: [],
    rating: null,
    calendar: null,
    spending: null,
    creditLine: LINEA,
    ...extra,
  });
}

describe("Inicio · el orden de la portada", () => {
  beforeEach(() => {
    mockNivel.fase = "lista";
    mockNivel.progress = PROGRESO_DE_PRUEBA;
    libro();
  });

  it("primero el crédito habilitado, después los puntos XP y después la calificación desglosada", async () => {
    await montar();
    const [credito, puntos, nivel, desglose, pagos] = posiciones([
      "Disponible para comprar",
      "PUNTOS XP",
      "NIVEL ",
      "Tu calificación, parte por parte",
      "Tus pagos",
    ]);
    for (const posicion of [credito, puntos, nivel, desglose, pagos])
      expect(posicion).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(puntos as number);
    expect(puntos).toBeLessThan(nivel as number);
    expect(nivel).toBeLessThan(desglose as number);
    expect(desglose).toBeLessThan(pagos as number);
  });

  it("enseña el disponible como la cifra de la tarjeta principal, con el límite y lo que falta por pagar", async () => {
    await montar();
    expect(screen.getByText(/1[.,]250/)).toBeTruthy();
    expect(screen.getByText("Límite aprobado")).toBeTruthy();
    expect(screen.getByText(/1[.,]500/)).toBeTruthy();
  });

  it("con pagos vencidos, el crédito sigue yendo primero y la mora justo debajo, antes de los puntos", async () => {
    libro({
      spending: {
        currencyCode: "BOB",
        categories: [],
        totals: { overdue: 320, financed: 0, outstanding: 320, loanCount: 1 },
      },
    });
    await montar();
    const [credito, mora, puntos] = posiciones([
      "Disponible para comprar",
      "Tienes pagos que regularizar",
      "PUNTOS XP",
    ]);
    expect(credito).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(mora as number);
    expect(mora).toBeLessThan(puntos as number);
  });

  it("la calificación trae cada parte con su razón, no sólo el número", async () => {
    await montar();
    const progreso = PROGRESO_DE_PRUEBA;
    for (const parte of progreso.components) {
      expect(screen.getByText(parte.label)).toBeTruthy();
      expect(screen.getByText(parte.why)).toBeTruthy();
    }
  });

  it("sin línea calculada todavía, los puntos y la calificación se ven igual: no dependen del motor", async () => {
    libro({ creditLine: null });
    await montar();
    expect(screen.getByText("Disponible para comprar")).toBeTruthy();
    expect(screen.getByTestId("experiencia-card")).toBeTruthy();
    expect(screen.getByTestId("por-que-puntaje")).toBeTruthy();
  });

  it("si los puntos no cargan se dice y se puede reintentar; la línea no desaparece", async () => {
    mockNivel.fase = "fallo";
    mockNivel.progress = null;
    await montar();
    expect(screen.getByText("Disponible para comprar")).toBeTruthy();
    expect(
      screen.getByText("No pudimos cargar tus puntos y tu calificación"),
    ).toBeTruthy();
    expect(screen.queryByTestId("experiencia-card")).toBeNull();
  });
});
