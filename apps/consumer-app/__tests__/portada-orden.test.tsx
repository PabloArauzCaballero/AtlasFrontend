import { fireEvent, render, screen } from "@testing-library/react-native";
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

  it("primero el crédito habilitado, después el nivel con sus puntos y después la calificación 1-100", async () => {
    await montar();
    const [credito, nivel, calificacion, pagos] = posiciones(["Crédito habilitado", "NIVEL ", "Tu calificación", "Tus pagos"]);
    for (const posicion of [credito, nivel, calificacion, pagos]) expect(posicion).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(nivel as number);
    expect(nivel).toBeLessThan(calificacion as number);
    expect(calificacion).toBeLessThan(pagos as number);
  });

  it("no repite: una sola tarjeta de puntos (la del nivel) y las explicaciones quedan tras «Más info»", async () => {
    await montar();
    expect(screen.queryByText("TU PUNTAJE")).toBeNull();
    expect(screen.queryByTestId("por-que-puntaje")).toBeNull();
    expect(screen.getAllByText("Más info")).toHaveLength(2);
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
      "Crédito habilitado",
      "Tienes pagos que regularizar",
      "NIVEL ",
    ]);
    expect(credito).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(mora as number);
    expect(mora).toBeLessThan(puntos as number);
  });

  it("«Más info» de la calificación trae cada parte con su razón, no sólo el número", async () => {
    await montar();
    await fireEvent.press(screen.getByTestId("calificacion-mas-info"));
    const progreso = PROGRESO_DE_PRUEBA;
    for (const parte of progreso.components) {
      expect(screen.getByText(parte.label)).toBeTruthy();
      expect(screen.getByText(parte.why)).toBeTruthy();
    }
  });

  it("sin línea calculada todavía, los puntos y la calificación se ven igual: no dependen del motor", async () => {
    libro({ creditLine: null });
    await montar();
    expect(screen.getByText("Crédito habilitado")).toBeTruthy();
    expect(screen.getByTestId("nivel-card")).toBeTruthy();
    expect(screen.getByTestId("calificacion-card")).toBeTruthy();
  });

  it("si los puntos no cargan se dice y se puede reintentar; la línea no desaparece", async () => {
    mockNivel.fase = "fallo";
    mockNivel.progress = null;
    await montar();
    expect(screen.getByText("Crédito habilitado")).toBeTruthy();
    expect(
      screen.getByText("No pudimos cargar tu nivel y tu calificación"),
    ).toBeTruthy();
    expect(screen.queryByTestId("nivel-card")).toBeNull();
  });
});

describe("Inicio · tarjeta Crédito habilitado", () => {
  beforeEach(() => {
    mockNivel.fase = "lista";
    mockNivel.progress = PROGRESO_DE_PRUEBA;
  });

  it("dice que la cifra la decidió el motor cuando hay una ejecución que lo respalda", async () => {
    libro({ creditLine: { ...LINEA, decision: { executionId: "exe-1", calculatedAt: "2026-10-01T12:00:00Z" } } });
    await montar();
    expect(screen.getByTestId("credito-procedencia")).toBeTruthy();
    expect(screen.getByText(/Lo decidió el motor de decisión de Atlas/)).toBeTruthy();
  });

  it("sin ejecución del motor no afirma la procedencia", async () => {
    libro({ creditLine: { ...LINEA, decision: { executionId: null, calculatedAt: "2026-10-01T12:00:00Z" } } });
    await montar();
    expect(screen.queryByTestId("credito-procedencia")).toBeNull();
  });

  it("mientras carga no muestra el «todavía calculando»", async () => {
    libro({ ready: false, creditLine: null });
    await montar();
    expect(screen.getByText("Consultando tu crédito…")).toBeTruthy();
    expect(screen.queryByText("inicio.calculando")).toBeNull();
  });

  it("si falla, lo dice y deja reintentar", async () => {
    libro({ creditLine: null, error: "Sin conexión" });
    await montar();
    expect(screen.getByText("No pudimos cargar tu crédito")).toBeTruthy();
  });

  it("sin línea calculada dice que se está calculando, sin inventar una cifra", async () => {
    libro({ creditLine: null });
    await montar();
    expect(screen.getByText("inicio.calculando")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });
});
