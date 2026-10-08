// Las cifras que cuentan hacia arriba dependen del reloj de animación, que en jest no avanza. Con movimiento reducido —un
// camino real de la app— nacen ya en su destino; es lo que estas pruebas leen.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return new Proxy(actual, { get: (objetivo, clave) => (clave === "useReducedMotion" ? () => true : objetivo[clave]) });
});

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
  useFocusEffect: () => undefined,
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

/** La pantalla se reparte en pestañas: antes de buscar algo hay que abrir la que lo tiene. */
const abrir = async (nombre: string) => {
  await fireEvent.press(screen.getByLabelText(`Pestaña ${nombre}`));
};
/** «Calificación» es su propia pestaña: la cuenta 1-100 vive ahí, separada de los puntos. */
const abrirCalificacion = async () => {
  await abrir("Calificación");
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLibro.creditLine = null;
  Object.assign(mockEstado, { fase: "lista", progress: PROGRESO });
});

describe("NivelCard", () => {
  it("junta el nivel, los puntos de experiencia y la racha en una tarjeta corta", async () => {
    await render(envolver(<NivelCard progress={PROGRESO} />));
    expect(screen.getByText("Explorador")).toBeTruthy();
    expect(screen.getByText("NIVEL 2 DE 12")).toBeTruthy();
    // En PUNTOS de experiencia, nunca la calificación 24 de 100.
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.getByText("puntos")).toBeTruthy();
    expect(screen.getByText("Racha 3")).toBeTruthy();
    expect(screen.queryByText("24")).toBeNull();
    expect(screen.queryByText("de 100")).toBeNull();
    expect(screen.getByText("Faltan 150 para «En crecimiento»")).toBeTruthy();
  });

  it("«Más info» abre cómo se ganan los puntos: 1 por boliviano comprado, con la escalera de niveles", async () => {
    await render(envolver(<NivelCard progress={PROGRESO} />));
    expect(screen.queryByText("Los niveles")).toBeNull();
    await fireEvent.press(screen.getByTestId("nivel-mas-info"));
    expect(screen.getByText(/Cada boliviano que compras con Atlas te da 1 punto de experiencia/)).toBeTruthy();
    expect(screen.getByText("Los niveles")).toBeTruthy();
    expect(screen.getByText("desde 500")).toBeTruthy();
  });

  it("con onVerLogros ofrece ir a los logros", async () => {
    const onVerLogros = jest.fn();
    await render(envolver(<NivelCard progress={PROGRESO} onVerLogros={onVerLogros} />));
    await fireEvent.press(screen.getByTestId("nivel-logros"));
    expect(onVerLogros).toHaveBeenCalledTimes(1);
  });
});

describe("pantalla «Tu nivel Atlas»", () => {
  it("sin línea de crédito igual muestra el nivel y los puntos (no una pantalla vacía)", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("NIVEL 2 DE 12")).toBeTruthy();
    await abrirCalificacion();
    expect(screen.getByText("Por qué tienes esta calificación")).toBeTruthy();
    expect(screen.getByText("Pagos a tiempo")).toBeTruthy();
  });

  it("lista las misiones y marca las cumplidas", async () => {
    await render(envolver(<Progreso />));
    await abrir("Logros");
    // Paginadas: están todas, a un deslizamiento; nada queda escondido tras un botón.
    expect(
      screen.getByLabelText(/Termina de pagar una compra\. Pendiente/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Verifica tu identidad\. Cumplida/),
    ).toBeTruthy();
  });

  it("los niveles son una línea de progreso vertical: están los 12, el actual marcado, sin paginar", async () => {
    await render(envolver(<Progreso />));
    await abrir("Historia");
    expect(screen.getByTestId("niveles")).toBeTruthy();
    expect(screen.getByLabelText(/^Explorador, desde 100 puntos\. Alcanzado/)).toBeTruthy();
    expect(screen.getByLabelText(/^Titán Atlas, desde 50\.000 puntos\. Por alcanzar/)).toBeTruthy();
    expect(screen.getByText("Explorador · estás aquí")).toBeTruthy();
    expect(screen.queryByLabelText(/^Ir a la página/)).toBeNull();
  });

  it("dice que pedir crédito no suma puntos", async () => {
    await render(envolver(<Progreso />));
    await abrir("Logros");
    expect(screen.getByText(/Pedir más crédito no sube tu calificación/)).toBeTruthy();
  });

  it("marca dónde está la persona en la escalera de niveles", async () => {
    await render(envolver(<Progreso />));
    await abrir("Historia");
    expect(screen.getByText(/Explorador · estás aquí/)).toBeTruthy();
    expect(
      screen.getByLabelText(/Establecido, desde 2\.000 puntos\. Por alcanzar/),
    ).toBeTruthy();
  });

  it("sin línea, la evolución lo explica y ofrece subir el extracto", async () => {
    await render(envolver(<Progreso />));
    await abrir("Historia");
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
    await abrir("Historia");
    expect(screen.getByText(/Pago · calificación 31/)).toBeTruthy();
    expect(screen.getByText(/Alta · calificación 12/)).toBeTruthy();
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
    await abrirCalificacion();
    expect(screen.getByText("50 de 100 × 45 % = 22,5")).toBeTruthy();
    expect(screen.getByText("8 de 100 × 20 % = 1,6")).toBeTruthy();
    expect(screen.getByText("100 de 100 × 10 % = 10")).toBeTruthy();
  });

  it("y la razón en una frase de cada una", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByText(/partes de 50: un valor neutro/)).toBeTruthy();
    expect(
      screen.getByText(/Tu identidad, domicilio y contacto están verificados/),
    ).toBeTruthy();
  });

  it("si un tope recortó el resultado, dice cuánto sumaba y cuál es el tope", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(
      screen.getByText(
        "Tus partes suman 33, pero hay un tope: tu calificación queda en 24.",
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
    await abrirCalificacion();
    expect(
      screen.getByText("Tu calificación es 33 de 100."),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/^Tope\./)).toBeNull();
  });
});

describe("experiencia e insignias", () => {
  it("enseña los puntos de experiencia y la racha en la tarjeta del nivel", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.getByText("Racha 3")).toBeTruthy();
  });

  it("los trofeos ganados se distinguen de los pendientes, con su rango, y los pendientes dicen su avance", async () => {
    await render(envolver(<Progreso />));
    await abrir("Logros");
    expect(screen.getByText(/2 de 4 ganadas/)).toBeTruthy();
    expect(screen.getByLabelText(/Insignia de bronce: Primera compra\. Ganado/)).toBeTruthy();
    expect(screen.getByLabelText(/Racha de 6\. Pendiente, 3 de 6/)).toBeTruthy();
    expect(screen.getByLabelText(/1\.000 Bs a tiempo\. Pendiente, 350 de 1\.000/)).toBeTruthy();
  });
});

describe("el índice de 0 a 1000 del motor", () => {
  it("sin línea explica que es otro número, quién lo calcula y por qué todavía no aparece", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByText("Lo que miró el motor para tu crédito")).toBeTruthy();
    expect(
      screen.getByText(/lo calcula el motor de decisión de Atlas/),
    ).toBeTruthy();
    expect(screen.getByText(/Todavía no se calculó tu línea/)).toBeTruthy();
  });
});

describe("pestañas de «Tu nivel Atlas»", () => {
  it("hay cuatro pestañas —Puntaje, Calificación, Logros, Historia— y abre en Puntaje", async () => {
    await render(envolver(<Progreso />));
    for (const nombre of ["Puntaje", "Calificación", "Logros", "Historia"])
      expect(screen.getByLabelText(`Pestaña ${nombre}`)).toBeTruthy();
    expect(screen.queryByLabelText("Pestaña Resumen")).toBeNull();
    expect(
      screen.getByLabelText("Pestaña Puntaje").props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      screen.getByLabelText("Pestaña Calificación").props.accessibilityState
        .selected,
    ).toBe(false);
  });

  it("Puntaje enseña la tarjeta y el nivel con sus puntos (cómo se ganan, en «Más info»), y NADA de la calificación", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByTestId("tarjeta-seccion")).toBeTruthy();
    expect(screen.getByText("NIVEL 2 DE 12")).toBeTruthy();
    expect(screen.getByTestId("nivel-card")).toBeTruthy();
    expect(screen.getByTestId("nivel-mas-info")).toBeTruthy();
    expect(screen.queryByTestId("calificacion-card")).toBeNull();
    expect(screen.queryByText("Por qué tienes esta calificación")).toBeNull();
    expect(screen.queryByText("Misiones")).toBeNull();
    expect(screen.queryByText("Los niveles")).toBeNull();
  });

  it("al cambiar de pestaña desaparece lo anterior y aparece lo nuevo", async () => {
    await render(envolver(<Progreso />));
    await abrir("Logros");
    expect(screen.getByText("Tus insignias")).toBeTruthy();
    expect(screen.getByText("Misiones")).toBeTruthy();
    expect(screen.queryByTestId("tarjeta-seccion")).toBeNull();
    expect(
      screen.getByLabelText("Pestaña Logros").props.accessibilityState.selected,
    ).toBe(true);
    await abrir("Puntaje");
    expect(screen.getByTestId("tarjeta-seccion")).toBeTruthy();
    expect(screen.queryByText("Misiones")).toBeNull();
  });

  it("Calificación junta la cuenta parte por parte y el índice 0-1000 del motor", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByTestId("por-que-puntaje")).toBeTruthy();
    expect(screen.getByText("Lo que miró el motor para tu crédito")).toBeTruthy();
    expect(screen.queryByText("Insignias")).toBeNull();
  });

  it("Historia junta la escalera de niveles y la evolución", async () => {
    await render(envolver(<Progreso />));
    await abrir("Historia");
    expect(screen.getByText("Los niveles")).toBeTruthy();
    expect(screen.getByText("Tu evolución")).toBeTruthy();
    expect(screen.queryByTestId("tarjeta-seccion")).toBeNull();
  });

  it("la cuenta de cada parte sigue visible aunque el nombre sea largo (no se sale de la fila)", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByText("Compras terminadas de pagar")).toBeTruthy();
    expect(screen.getByText(/0 de 100 × 25 % = 0/)).toBeTruthy();
  });
});

describe("Puntaje y Calificación son pestañas SEPARADAS", () => {
  it("Puntaje: los puntos de experiencia, sin la calificación ni subpestañas", async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText("350")).toBeTruthy();
    expect(screen.queryByLabelText(/^Subpestaña/)).toBeNull();
    expect(screen.queryByTestId("calificacion-card")).toBeNull();
    expect(screen.queryByTestId("por-que-puntaje")).toBeNull();
  });

  it("Calificación: el número de 1 a 100 y su cuenta, sin los puntos ni la tarjeta", async () => {
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByLabelText("Pestaña Calificación").props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId("calificacion-card")).toBeTruthy();
    expect(screen.getByText("de 100")).toBeTruthy();
    expect(screen.getByTestId("por-que-puntaje")).toBeTruthy();
    expect(screen.queryByTestId("nivel-card")).toBeNull();
    expect(screen.queryByTestId("tarjeta-seccion")).toBeNull();
  });

  it("la calificación nunca dice 0: la escala empieza en 1", async () => {
    Object.assign(mockEstado, { progress: { ...PROGRESO_DE_PRUEBA, score: 0, rating: undefined } });
    await render(envolver(<Progreso />));
    await abrirCalificacion();
    expect(screen.getByLabelText("Calificación 1 de 100")).toBeTruthy();
  });

  it("con el nivel que publica el backend, la tarjeta de nivel usa ese (en puntos)", async () => {
    Object.assign(mockEstado, {
      progress: {
        ...PROGRESO_DE_PRUEBA,
        level: { code: "ESTABLECIDO", label: "Establecido", index: 3, of: 5, points: 2400 },
        nextLevel: { code: "CONSOLIDADO", label: "Consolidado", from: 5000, pointsMissing: 2600 },
        levelLadder: [
          { code: "NUEVO", label: "Nuevo", from: 0, reached: true },
          { code: "EN_CONSTRUCCION", label: "En crecimiento", from: 500, reached: true },
          { code: "ESTABLECIDO", label: "Establecido", from: 2000, reached: true },
          { code: "CONSOLIDADO", label: "Consolidado", from: 5000, reached: false },
          { code: "PREFERENTE", label: "Preferente", from: 10000, reached: false },
        ],
      },
    });
    await render(envolver(<Progreso />));
    expect(screen.getByText("NIVEL 3 DE 5")).toBeTruthy();
    expect(screen.getByText("Faltan 2.600 para «Consolidado»")).toBeTruthy();
  });
});
