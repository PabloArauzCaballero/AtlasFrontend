import { render, screen } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Home from "../app/(app)/(tabs)/index";
import { porcentajeUsado } from "../src/ui/credito-habilitado-card";
import { fechaDeVencimiento } from "../src/ui/proximo-pago-card";

/**
 * El orden de la portada, que es un pedido de negocio y no un detalle de maquetación: primero SIEMPRE cuánto crédito
 * hay habilitado (Pablo, 2026-10-05), la mora justo debajo y después el próximo pago. El nivel, la calificación, cuánto
 * puede crecer el crédito y el gasto por rubro salieron de la portada (Pablo, 2026-10-12).
 */
jest.mock("expo-router", () => ({
  useFocusEffect: () => undefined,
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
  beforeEach(() => libro());

  it("primero el crédito habilitado y después los pagos", async () => {
    await montar();
    const [credito, pagos] = posiciones(["Disponible para comprar", "Tus pagos"]);
    expect(credito).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(pagos as number);
  });

  it("no lleva nivel, calificación, crecimiento del crédito ni gasto por rubro", async () => {
    libro({
      spending: {
        currencyCode: "BOB",
        categories: [{ category: "retail", share: 100, financed: 640, overdue: 0, merchants: [{ displayName: "Multicenter" }] }],
        totals: { overdue: 0, financed: 640, outstanding: 640, loanCount: 2 },
      },
    });
    await montar();
    expect(screen.queryByTestId("nivel-card")).toBeNull();
    expect(screen.queryByTestId("calificacion-card")).toBeNull();
    expect(screen.queryByText("Tu calificación")).toBeNull();
    expect(screen.queryByText("Cuánto puede crecer tu crédito")).toBeNull();
    expect(screen.queryByText("En qué gastas")).toBeNull();
    expect(screen.queryByText("Descargar informe en PDF")).toBeNull();
  });

  it("enseña el disponible como la cifra principal y cómo se consume la línea: barra y «usado de límite»", async () => {
    await montar();
    expect(screen.getByText(/1[.,]250/)).toBeTruthy();
    expect(screen.getByTestId("credito-consumo").props.children).toBe("Bs\u00A0250 usado de Bs\u00A01.500 de límite");
    // La barra se llena con lo USADO: 250 de 1.500 es un 17 %.
    const barra = screen.getByLabelText("Usaste Bs\u00A0250 de tu límite de Bs\u00A01.500");
    expect(barra.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 17 });
  });

  it("sin límite aprobado la barra queda vacía en vez de dividir por cero", () => {
    expect(porcentajeUsado({ used: 0, approvedLimit: 0 })).toBe(0);
    expect(porcentajeUsado({ used: 2000, approvedLimit: 1500 })).toBe(100);
  });

  it("con pagos vencidos, el crédito sigue yendo primero y la mora justo debajo, antes del próximo pago", async () => {
    libro({
      spending: {
        currencyCode: "BOB",
        categories: [],
        totals: { overdue: 320, financed: 0, outstanding: 320, loanCount: 1 },
      },
    });
    await montar();
    const [credito, mora, pagos] = posiciones(["Disponible para comprar", "Tienes pagos que regularizar", "Tus pagos"]);
    expect(credito).toBeGreaterThan(-1);
    expect(credito).toBeLessThan(mora as number);
    expect(mora).toBeLessThan(pagos as number);
  });

  it("sin línea calculada todavía, la portada no se cae", async () => {
    libro({ creditLine: null });
    await montar();
    expect(screen.getByText("Disponible para comprar")).toBeTruthy();
  });
});

describe("Inicio · próximo pago en una fila", () => {
  const cuota = (extra: Record<string, unknown> = {}) => ({
    loanId: "5",
    installmentNumber: 1,
    dueDate: "2026-10-21",
    state: "upcoming",
    pendingAmount: 213.33,
    currencyCode: "BOB",
    merchant: { displayName: "Multicenter" },
    ...extra,
  });

  it("dice cuánto y cuándo, y toda la fila es el botón", async () => {
    libro({ calendar: { entries: [cuota()] } });
    await montar();
    expect(screen.getByText("Próximo pago")).toBeTruthy();
    expect(screen.getByLabelText("Próximo pago: Bs\u00A0213,33, vence el 21 de oct. Toca para ver cómo pagar.")).toBeTruthy();
    expect(screen.queryByText("Ver cómo pagar")).toBeNull();
  });

  it("vencida, lo dice", async () => {
    libro({ calendar: { entries: [cuota({ state: "overdue" })] } });
    await montar();
    expect(screen.getByLabelText("Pago vencido: Bs\u00A0213,33, venció el 21 de oct. Toca para ver cómo pagar.")).toBeTruthy();
  });

  it("la fecha no retrocede un día por la zona horaria", () => {
    expect(fechaDeVencimiento("2026-11-01")).toBe("1 de nov");
    expect(fechaDeVencimiento("2026-10-21T00:00:00.000Z")).toBe("21 de oct");
    expect(fechaDeVencimiento("pronto")).toBe("pronto");
  });
});

describe("Inicio · tarjeta Crédito habilitado", () => {
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
