import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Progreso from "../app/(app)/progreso";
import type { Progress } from "../src/api/endpoints/credit-line";
import { NivelCard } from "../src/ui/nivel-card";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

/**
 * El nivel Atlas: se ve aunque no haya línea de crédito, dice cuánto falta, explica de dónde salen los puntos,
 * lista las misiones y jamás invita a endeudarse.
 */
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  usePathname: () => "/progreso",
}));
jest.mock("../src/session/session", () => ({
  useSession: () => ({ customerId: "42" }),
}));
const mockEstado: { fase: string; progress: unknown; recargar: jest.Mock } = {
  fase: "cargando",
  progress: null,
  recargar: jest.fn(),
};
const mockLibro = {
  ready: true,
  error: null as string | null,
  creditLine: null as unknown,
  reload: jest.fn(),
};
jest.mock("../src/features/use-credit-book", () => ({
  useCreditBook: () => mockLibro,
}));
jest.mock("../src/features/use-progress", () => ({
  useProgress: () => mockEstado,
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const envolver = (hijo: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICAS}>{hijo}</SafeAreaProvider>
);

const PROGRESO: Progress = PROGRESO_DE_PRUEBA;

beforeEach(() => {
  jest.clearAllMocks();
  mockLibro.creditLine = null;
  Object.assign(mockEstado, { fase: "lista", progress: PROGRESO });
});

describe("NivelCard", () => {
  it("enseña el nivel, los puntos y cuánto falta para el siguiente", async () => {
    await render(envolver(<NivelCard progress={PROGRESO} />));
    expect(screen.getByText("Nuevo")).toBeTruthy();
    expect(screen.getByText("NIVEL 1 DE 5")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(
      screen.getByText("Te falta 1 punto para «En construcción»."),
    ).toBeTruthy();
  });

  it("con onPress es un botón accesible que describe el nivel entero", async () => {
    const onPress = jest.fn();
    await render(envolver(<NivelCard progress={PROGRESO} onPress={onPress} />));
    const tarjeta = screen.getByRole("button", {
      name: /Tu nivel Atlas: Nuevo, nivel 1 de 5, 24 puntos/,
    });
    await fireEvent.press(tarjeta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("pantalla «Tu nivel Atlas»", () => {
  it("sin línea de crédito igual muestra el nivel y los puntos (no una pantalla vacía)", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("NIVEL 1 DE 5")).toBeTruthy();
    expect(screen.getByText("Por qué tienes este puntaje")).toBeTruthy();
    expect(screen.getByText("Pagos a tiempo")).toBeTruthy();
  });

  it("lista las misiones y marca las cumplidas", async () => {
    await render(envolver(<Progreso />));
    expect(
      screen.getByLabelText(/Verifica tu identidad\. Cumplida/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Termina de pagar una compra\. Pendiente/),
    ).toBeTruthy();
  });

  it("dice que pedir crédito no suma puntos", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText(/Pedir más crédito no suma puntos/)).toBeTruthy();
  });

  it("marca dónde está la persona en la escalera de niveles", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText(/Nuevo · estás aquí/)).toBeTruthy();
    expect(
      screen.getByLabelText(/Establecido, desde 50 puntos\. Por alcanzar/),
    ).toBeTruthy();
  });

  it("sin línea, la evolución lo explica y ofrece subir el extracto", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("Tu historia empieza aquí")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Subir mi extracto bancario" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/(app)/extracto-bancario");
  });

  it("con historial muestra cada versión con su cambio de límite", async () => {
    Object.assign(mockEstado, {
      progress: {
        ...PROGRESO,
        hasCreditLine: true,
        history: [
          {
            validFrom: "2026-09-20T10:00:00Z",
            trigger: "repayment",
            scoring: 640,
            approvedLimit: 1500,
            relationshipScore: 31,
            relationshipTier: "EN_CONSTRUCCION",
          },
          {
            validFrom: "2026-08-01T10:00:00Z",
            trigger: "onboarding",
            scoring: 560,
            approvedLimit: 800,
            relationshipScore: 12,
            relationshipTier: "NUEVO",
          },
        ],
      },
    });
    await render(envolver(<Progreso />));
    expect(screen.getByText(/Pago · 31 pts de nivel/)).toBeTruthy();
    expect(screen.getByText(/Alta · 12 pts de nivel/)).toBeTruthy();
    expect(screen.getByText(/▲/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Subir mi extracto bancario" }),
    ).toBeNull();
  });

  it("mientras carga no pinta un vacío; si falla, lo dice y deja reintentar", async () => {
    Object.assign(mockEstado, { fase: "cargando", progress: null });
    const { unmount } = await render(envolver(<Progreso />));
    expect(screen.queryByText("Tu historia empieza aquí")).toBeNull();
    await unmount();

    Object.assign(mockEstado, { fase: "fallo", progress: null });
    await render(envolver(<Progreso />));
    expect(screen.getByText("No pudimos cargar tu nivel")).toBeTruthy();
  });
});

describe("«Por qué tienes este puntaje»", () => {
  it("cada parte enseña su cuenta con los números de la persona", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("50 de 100 × 45 % = 22,5 pts")).toBeTruthy();
    expect(screen.getByText("8 de 100 × 20 % = 1,6 pts")).toBeTruthy();
    expect(screen.getByText("100 de 100 × 10 % = 10 pts")).toBeTruthy();
  });

  it("y la razón en una frase de cada una", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText(/partes de 50: un valor neutro/)).toBeTruthy();
    expect(
      screen.getByText(/Tu identidad, domicilio y contacto están verificados/),
    ).toBeTruthy();
  });

  it("si un tope recortó el resultado, dice cuánto sumaba y cuál es el tope", async () => {
    await render(envolver(<Progreso />));
    expect(
      screen.getByText(
        "Tus partes suman 33, pero hay un tope: tu nivel cuenta 24 y estás en «Nuevo».",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Tope\. Hasta cumplir 3 meses con Atlas/),
    ).toBeTruthy();
  });

  it("sin tope, la cuenta cuadra y no se anuncia ninguno", async () => {
    Object.assign(mockEstado, {
      progress: { ...PROGRESO_DE_PRUEBA, score: 33, rawScore: 33, caps: [] },
    });
    await render(envolver(<Progreso />));
    expect(
      screen.getByText("Suma 33 puntos: estás en el nivel «Nuevo»."),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/^Tope\./)).toBeNull();
  });
});

describe("experiencia e insignias", () => {
  it("enseña los puntos por boliviano pagado a tiempo y la racha", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("350 XP")).toBeTruthy();
    expect(screen.getByText("Racha 3")).toBeTruthy();
    expect(
      screen.getByText(
        "350 puntos: 1 por cada boliviano que pagaste a tiempo.",
      ),
    ).toBeTruthy();
  });

  it("sin pagos aún, dice que comprar no suma y pagar sí", async () => {
    Object.assign(mockEstado, {
      progress: {
        ...PROGRESO_DE_PRUEBA,
        experience: {
          ...PROGRESO_DE_PRUEBA.experience,
          xp: 0,
          bestStreak: 0,
          currentStreak: 0,
        },
      },
    });
    await render(envolver(<Progreso />));
    expect(
      screen.getByText(
        "Cada boliviano que pagues a tiempo suma 1 punto. Comprar no suma: sólo pagar.",
      ),
    ).toBeTruthy();
  });

  it("las insignias ganadas se distinguen de las pendientes y las pendientes dicen su avance", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("2 de 4 ganadas")).toBeTruthy();
    expect(screen.getByLabelText(/Primera compra\. Ganada/)).toBeTruthy();
    expect(
      screen.getByLabelText(/Racha de 6\. Pendiente, 3 de 6/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/1\.000 Bs a tiempo\. Pendiente, 350 de 1\.000/),
    ).toBeTruthy();
  });
});

describe("el puntaje de 0 a 1000", () => {
  it("sin línea explica que es otro número, quién lo calcula y por qué todavía no aparece", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("Tu puntaje Atlas de 0 a 1000")).toBeTruthy();
    expect(
      screen.getByText(/lo calcula el motor de decisión de Atlas/),
    ).toBeTruthy();
    expect(screen.getByText(/Todavía no se calculó tu línea/)).toBeTruthy();
  });
});
