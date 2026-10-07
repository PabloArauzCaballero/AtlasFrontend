import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { AtlasApiError } from "../src/api/errors";
import VerifyContact from "../app/(onboarding)/verificar-contacto";
import * as onboardingApi from "../src/api/endpoints/onboarding";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    navigate: jest.fn(),
  }),
  usePathname: () => "/verificar-contacto",
}));
jest.mock("../src/session/session", () => ({
  useSession: () => ({
    customerId: "42",
    refresh: jest.fn(),
    status: "authenticated",
    me: null,
    profile: null,
    onboarding: null,
  }),
}));
jest.mock("../src/api/endpoints/onboarding", () => ({
  listVerificationChannels: jest.fn(),
  requestContactVerification: jest.fn(),
  submitContactVerification: jest.fn(),
}));

it("tras un timeout no afirma que falló el envío y reconcilia el código al reintentar", async () => {
  (onboardingApi.listVerificationChannels as jest.Mock).mockResolvedValue({
    channels: [{ channel: "sms", available: true }],
  });
  (onboardingApi.requestContactVerification as jest.Mock)
    .mockRejectedValueOnce(
      new AtlasApiError({
        kind: "timeout",
        code: "REQUEST_TIMEOUT",
        message: "timeout",
        status: 0,
      }),
    )
    .mockRejectedValueOnce(
      new AtlasApiError({
        kind: "conflict",
        code: "VERIFICATION_RATE_LIMITED",
        message: "VERIFICATION_RATE_LIMITED",
        status: 409,
      }),
    );
  const metricas = initialWindowMetrics ?? {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };
  render(
    <SafeAreaProvider initialMetrics={metricas}>
      <VerifyContact />
    </SafeAreaProvider>,
  );

  await waitFor(() =>
    expect(
      screen.getByText(/No pudimos confirmar si se envió el código/i),
    ).toBeTruthy(),
  );
  fireEvent.press(screen.getByText("Intentar de nuevo"));
  await waitFor(() => expect(screen.getByText("Código enviado")).toBeTruthy());
  expect(screen.getByLabelText(/^Código recibido/)).toBeTruthy();
  expect(onboardingApi.requestContactVerification).toHaveBeenCalledTimes(2);
});
