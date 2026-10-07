import { aplicarActualizacionPendiente, type Actualizador } from "../src/device/aplicar-actualizacion";

const falso = (hay: boolean, esNuevo = true): { u: Actualizador; recargas: jest.Mock } => {
  const recargas = jest.fn(async () => {});
  return {
    recargas,
    u: {
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: hay })) as unknown as Actualizador["checkForUpdateAsync"],
      fetchUpdateAsync: jest.fn(async () => ({ isNew: esNuevo })) as unknown as Actualizador["fetchUpdateAsync"],
      reloadAsync: recargas as unknown as Actualizador["reloadAsync"],
    },
  };
};

describe("aplicarActualizacionPendiente", () => {
  it("con un update nuevo lo baja y recarga una vez", async () => {
    const { u, recargas } = falso(true);
    expect(await aplicarActualizacionPendiente(u)).toBe(true);
    expect(recargas).toHaveBeenCalledTimes(1);
  });

  it("sin update no recarga", async () => {
    const { u, recargas } = falso(false);
    expect(await aplicarActualizacionPendiente(u)).toBe(false);
    expect(recargas).not.toHaveBeenCalled();
  });

  it("si lo bajado no es nuevo, no recarga (evita un bucle de recargas)", async () => {
    const { u, recargas } = falso(true, false);
    expect(await aplicarActualizacionPendiente(u)).toBe(false);
    expect(recargas).not.toHaveBeenCalled();
  });

  it("sin red no rompe: sigue con el código que tiene", async () => {
    const { u, recargas } = falso(true);
    (u.checkForUpdateAsync as unknown as jest.Mock).mockRejectedValue(new Error("offline"));
    expect(await aplicarActualizacionPendiente(u)).toBe(false);
    expect(recargas).not.toHaveBeenCalled();
  });
});
