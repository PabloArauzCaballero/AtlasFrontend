import { render, screen, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import MisDatos from "../app/(app)/mis-datos";
import * as customerApi from "../src/api/endpoints/customer";
import * as onboardingApi from "../src/api/endpoints/onboarding";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";
import {
  marcarPinConfirmado,
  olvidarPinConfirmado,
} from "../src/features/pin-verificado";

/**
 * «Mis datos»: todo lo que Atlas sabe de la persona, siempre disponible pero tras volver a pedir el PIN.
 * Llegar por un enlace directo no se salta el PIN: sin confirmación reciente no se pide ni se pinta nada.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  usePathname: () => "/mis-datos",
}));
jest.mock("../src/session/session", () => ({
  useSession: () => ({ customerId: "42" }),
}));
jest.mock("../src/api/endpoints/customer", () => ({ getMe: jest.fn() }));
jest.mock("../src/api/endpoints/onboarding", () => ({ getAnswers: jest.fn() }));
jest.mock("../src/api/endpoints/auth", () => ({ verifyPin: jest.fn() }));
const mockNivel: { fase: string; progress: unknown; recargar: jest.Mock } = {
  fase: "lista",
  progress: PROGRESO_DE_PRUEBA,
  recargar: jest.fn(),
};
jest.mock("../src/features/use-progress", () => ({
  useProgress: () => mockNivel,
}));
jest.mock("../src/features/use-credit-book", () => ({
  useCreditBook: () => ({
    creditLine: {
      inputs: { monthlyIncome: "expediente", dependents: "ausente" },
    },
    ready: true,
    error: null,
    reload: jest.fn(),
  }),
}));

const getMe = customerApi.getMe as jest.Mock;
const getAnswers = onboardingApi.getAnswers as jest.Mock;
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <MisDatos />
    </SafeAreaProvider>,
  );

const ME = {
  customer: {
    customerId: "42",
    customerCode: "33F148",
    status: "active",
    phoneLast4: "7232",
    emailDomain: "@gmail.com",
  },
  profile: {
    firstName: "Pablo",
    lastName: "Arauz",
    birthDate: "1990-05-17",
    preferredLanguage: "es-BO",
  },
  onboarding: null,
  eligibility: { eligible: true, completionPercentage: 100, blockerCodes: [] },
  contacts: [
    {
      contactType: "phone",
      status: "verified",
      isPrimary: true,
      valueLast4: "7232",
    },
  ],
  consents: {
    accepted: ["device_address_book"],
    declined: ["location_tracking"],
  },
};
const RESPUESTAS = {
  customerId: "42",
  personalData: null,
  financialProfile: { monthlyIncome: 4500 },
  address: {
    countryCode: "BO",
    department: "Santa Cruz",
    city: "Santa Cruz de la Sierra",
    zone: "Equipetrol",
    addressLine: "Calle 5 #120",
    gps: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  olvidarPinConfirmado();
  getMe.mockResolvedValue(ME);
  getAnswers.mockResolvedValue(RESPUESTAS);
});

it("sin PIN confirmado pide el PIN y NO pide ni pinta ningún dato", async () => {
  await montar();
  expect(screen.getAllByText("Confirma tu PIN").length).toBeGreaterThan(0);
  expect(getMe).not.toHaveBeenCalled();
  expect(getAnswers).not.toHaveBeenCalled();
  expect(screen.queryByText("Pablo Arauz")).toBeNull();
  expect(screen.queryByText("33F148")).toBeNull();
});

it("con el PIN recién confirmado enseña todo lo que Atlas sabe", async () => {
  marcarPinConfirmado();
  await montar();
  await waitFor(() => expect(screen.getByText("Pablo Arauz")).toBeTruthy());
  expect(screen.getByText("33F148")).toBeTruthy();
  expect(screen.getByText("…7232 · principal")).toBeTruthy();
  expect(screen.getByText("Calle 5 #120")).toBeTruthy();
  expect(screen.getByText("Equipetrol")).toBeTruthy();
  expect(screen.getByText("Agenda del dispositivo")).toBeTruthy();
  expect(screen.getByText("Diste el permiso")).toBeTruthy();
  expect(screen.getByText("Ubicación del dispositivo")).toBeTruthy();
  expect(screen.getByText("No lo diste")).toBeTruthy();
  expect(screen.getByText("Lo declaraste tú")).toBeTruthy();
  expect(screen.getByText("Falta")).toBeTruthy();
});

it("si el domicilio no carga, el resto se enseña igual", async () => {
  marcarPinConfirmado();
  getAnswers.mockRejectedValue(new Error("red"));
  await montar();
  await waitFor(() => expect(screen.getByText("Pablo Arauz")).toBeTruthy());
  expect(screen.getByText("Todavía no registraste tu domicilio.")).toBeTruthy();
});

it("si los datos no cargan, lo dice y deja reintentar (no se ve vacío)", async () => {
  marcarPinConfirmado();
  getMe.mockRejectedValue(new Error("red"));
  await montar();
  await waitFor(() =>
    expect(screen.getByText("No pudimos cargar tus datos")).toBeTruthy(),
  );
  expect(screen.queryByText("Todavía no registraste tu domicilio.")).toBeNull();
});

it("muestra tu nivel y la experiencia, con la explicación a un toque", async () => {
  marcarPinConfirmado();
  await montar();
  await waitFor(() => expect(screen.getByText("Pablo Arauz")).toBeTruthy());
  expect(screen.getByText("NIVEL 1 DE 5")).toBeTruthy();
  expect(
    screen.getByText(
      /350 puntos: 1 por cada boliviano que pagaste a tiempo\. Toca la tarjeta para ver por qué tienes este puntaje\./,
    ),
  ).toBeTruthy();
});

it("sin PIN confirmado el nivel tampoco se enseña", async () => {
  await montar();
  expect(screen.queryByText("NIVEL 1 DE 5")).toBeNull();
});
