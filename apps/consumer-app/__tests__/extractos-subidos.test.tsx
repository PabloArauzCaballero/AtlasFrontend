import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import * as creditLineApi from "../src/api/endpoints/credit-line";
import * as archivos from "../src/device/archivos";
import {
  descargarExtracto,
  resumenDeExtracto,
  subidoEl,
  tonoDeExtracto,
} from "../src/features/extractos-subidos";
import { ExtractosSubidosCard } from "../src/ui/extractos-subidos-card";

/**
 * «Tus extractos bancarios» en Mis datos: la persona ve los que subió y descarga cada PDF. El archivo se
 * pide a la API con la sesión; nunca a una dirección del almacén.
 */
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../src/api/endpoints/credit-line", () => ({
  listBankStatements: jest.fn(),
}));
jest.mock("../src/api/client", () => ({
  readAccessToken: jest.fn(async () => "token-de-prueba"),
}));
jest.mock("../src/api/config", () => ({
  apiConfig: { baseUrl: "https://api.prueba/api/v1", tenantId: "1" },
}));
jest.mock("../src/device/archivos", () => ({
  descargarConSesion: jest.fn(async () => "file:///cache/extracto.pdf"),
  guardarEnNavegador: jest.fn(() => false),
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const listar = creditLineApi.listBankStatements as jest.Mock;
const descargarConSesion = archivos.descargarConSesion as jest.Mock;
const guardarEnNavegador = archivos.guardarEnNavegador as jest.Mock;

function extracto(extra: Partial<creditLineApi.BankStatementArchiveItem> = {}) {
  return {
    reviewId: "7",
    status: "applied",
    statusLabel: "Aplicado a tu línea",
    statusDetail: "",
    submittedAt: "2026-09-14T15:30:00.000Z",
    promisedBy: "2026-09-15T15:30:00.000Z",
    appliedCreditLineId: "3",
    rejectionReason: null,
    rejectionCategory: null,
    institutionName: "Banco Unión",
    period: { from: "2026-06-01", to: "2026-08-31" },
    capacity: null,
    file: { available: true, fileName: "extracto-2026-09-14.pdf" },
    ...extra,
  } as creditLineApi.BankStatementArchiveItem;
}

/** Los dobles vuelven a su respuesta feliz antes de cada prueba (jest los vacía entre una y otra). */
function porDefecto() {
  (jest.requireMock("../src/api/client").readAccessToken as jest.Mock).mockResolvedValue("token-de-prueba");
  descargarConSesion.mockResolvedValue("file:///cache/extracto.pdf");
  guardarEnNavegador.mockReturnValue(false);
  const Sharing = jest.requireMock("expo-sharing");
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
}

describe("ExtractosSubidosCard · los cuatro estados", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    porDefecto();
  });

  it("lista cada extracto con su fecha, banco, período y estado, y un botón para descargarlo", async () => {
    listar.mockResolvedValue({
      items: [extracto(), extracto({ reviewId: "5", status: "rejected", statusLabel: "No pudimos usarlo" })],
    });
    await render(<ExtractosSubidosCard customerId="42" />);
    await waitFor(() => expect(screen.getByTestId("extracto-7")).toBeTruthy());
    expect(listar).toHaveBeenCalledWith("42");
    expect(screen.getByText("Aplicado a tu línea")).toBeTruthy();
    expect(screen.getByText("No pudimos usarlo")).toBeTruthy();
    expect(screen.getAllByText(/Banco Unión/)).toHaveLength(2);
    expect(screen.getAllByText("Ver o descargar el PDF")).toHaveLength(2);
  });

  it("al tocar, pide ESE archivo a la API con la sesión", async () => {
    listar.mockResolvedValue({ items: [extracto()] });
    await render(<ExtractosSubidosCard customerId="42" />);
    await fireEvent.press(await screen.findByText("Ver o descargar el PDF"));
    await waitFor(() => expect(descargarConSesion).toHaveBeenCalledTimes(1));
    expect(descargarConSesion).toHaveBeenCalledWith({
      url: "https://api.prueba/api/v1/customers/42/bank-statements/7/file",
      headers: { authorization: "Bearer token-de-prueba", "x-tenant-id": "1" },
      nombre: "extracto-2026-09-14.pdf",
    });
  });

  it("un extracto cuyo archivo ya no se guarda se enseña, pero sin botón", async () => {
    listar.mockResolvedValue({
      items: [extracto({ file: { available: false, fileName: "extracto-2026-09-14.pdf" } })],
    });
    await render(<ExtractosSubidosCard customerId="42" />);
    await waitFor(() => expect(screen.getByTestId("extracto-7")).toBeTruthy());
    expect(screen.queryByText("Ver o descargar el PDF")).toBeNull();
    expect(screen.getByText(/ya no está guardado en Atlas/)).toBeTruthy();
  });

  it("sin extractos lo dice y ofrece subir uno", async () => {
    listar.mockResolvedValue({ items: [] });
    await render(<ExtractosSubidosCard customerId="42" />);
    await fireEvent.press(await screen.findByText("Subir mi extracto"));
    expect(screen.getByText("Todavía no subiste ningún extracto")).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith("/(app)/extracto-bancario");
  });

  it("si la lista falla se dice y se reintenta", async () => {
    listar.mockRejectedValueOnce(new Error("sin red")).mockResolvedValue({ items: [extracto()] });
    await render(<ExtractosSubidosCard customerId="42" />);
    expect(await screen.findByText("No pudimos cargar tus extractos")).toBeTruthy();
    await fireEvent.press(screen.getByText("Reintentar"));
    await waitFor(() => expect(screen.getByTestId("extracto-7")).toBeTruthy());
  });

  it("si la descarga falla, avisa con el motivo y el botón vuelve a quedar disponible", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    descargarConSesion.mockRejectedValueOnce(new Error("El servidor respondió 500."));
    listar.mockResolvedValue({ items: [extracto()] });
    await render(<ExtractosSubidosCard customerId="42" />);
    await fireEvent.press(await screen.findByText("Ver o descargar el PDF"));
    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith(
        "No se pudo abrir tu extracto",
        "No pudimos descargar tu extracto. Inténtalo de nuevo.",
      ),
    );
    expect(screen.getByText("Ver o descargar el PDF")).toBeTruthy();
  });
});

describe("descargarExtracto · qué se le dice a la persona", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    porDefecto();
  });

  it("en el navegador se guarda como descarga y no abre la hoja de compartir", async () => {
    guardarEnNavegador.mockReturnValueOnce(true);
    const Sharing = jest.requireMock("expo-sharing");
    await expect(descargarExtracto("42", extracto())).resolves.toEqual({ ok: true });
    expect(guardarEnNavegador).toHaveBeenCalledWith("file:///cache/extracto.pdf", "extracto-2026-09-14.pdf");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("en el teléfono abre la hoja del sistema con el PDF", async () => {
    const Sharing = jest.requireMock("expo-sharing");
    await expect(descargarExtracto("42", extracto())).resolves.toEqual({ ok: true });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///cache/extracto.pdf",
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
  });

  it("un 404 es «ya no está guardado», no «inténtalo de nuevo»", async () => {
    descargarConSesion.mockRejectedValueOnce(new Error("El servidor respondió 404."));
    await expect(descargarExtracto("42", extracto())).resolves.toEqual({
      ok: false,
      reason: "Este archivo ya no está guardado en Atlas.",
    });
  });

  it("sin archivo disponible no llega a pedir nada", async () => {
    const resultado = await descargarExtracto(
      "42",
      extracto({ file: { available: false, fileName: "x.pdf" } }),
    );
    expect(resultado.ok).toBe(false);
    expect(descargarConSesion).not.toHaveBeenCalled();
  });
});

describe("cómo se describe un extracto", () => {
  it("banco y período cuando se leyeron; lo dice cuando todavía no", () => {
    expect(resumenDeExtracto(extracto())).toMatch(/^Banco Unión · .*2026 a .*2026$/);
    expect(resumenDeExtracto({ institutionName: null, period: null })).toBe(
      "Todavía no se leyó el banco ni el período",
    );
    expect(resumenDeExtracto({ institutionName: "BNB", period: null })).toBe("BNB");
  });

  it("la fecha de subida, o que no se conoce", () => {
    expect(subidoEl(extracto())).toMatch(/^Subido el .*2026$/);
    expect(subidoEl({ submittedAt: "no es fecha" })).toBe("Fecha de subida no disponible");
  });

  it("el tono sigue al estado", () => {
    expect(tonoDeExtracto("applied")).toBe("success");
    expect(tonoDeExtracto("rejected")).toBe("danger");
    expect(tonoDeExtracto("processing")).toBe("warning");
    expect(tonoDeExtracto("received")).toBe("warning");
  });
});
