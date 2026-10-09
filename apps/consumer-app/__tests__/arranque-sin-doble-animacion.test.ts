import { decidirArranque, type Actualizador } from "../src/device/aplicar-actualizacion";

/**
 * La animación de arranque se veía DOS veces (Pablo, 2026-10-08): el update llegaba con la animación ya corriendo y
 * `reloadAsync` la reiniciaba. Regla: o se recarga ANTES de animar (bajo el splash nativo), o no se recarga en esta
 * apertura. Nunca una recarga después de que se decidió seguir.
 */
function falso({ hay = true, nuevo = true, demoraCheck = 0, demoraBajada = 0 } = {}) {
  const recargas = jest.fn(async () => {});
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const u = {
    checkForUpdateAsync: jest.fn(async () => {
      await espera(demoraCheck);
      return { isAvailable: hay };
    }),
    fetchUpdateAsync: jest.fn(async () => {
      await espera(demoraBajada);
      return { isNew: nuevo };
    }),
    reloadAsync: recargas,
  } as unknown as Actualizador;
  return { u, recargas };
}

describe("arranque sin doble animación", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("update a tiempo: recarga bajo el splash nativo, antes de animar", async () => {
    const { u, recargas } = falso({ demoraCheck: 300, demoraBajada: 600 });
    const p = decidirArranque(u, 2500);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await p).toBe("recarga");
    expect(recargas).toHaveBeenCalledTimes(1);
  });

  it("sin update: sigue y anima, sin recargar", async () => {
    const { u, recargas } = falso({ hay: false });
    const p = decidirArranque(u, 2500);
    await jest.advanceTimersByTimeAsync(10);
    expect(await p).toBe("seguir");
    expect(recargas).not.toHaveBeenCalled();
  });

  it("red lenta: a los 2,5 s sigue, y el update que llega DESPUÉS ya no recarga (queda para la próxima apertura)", async () => {
    const { u, recargas } = falso({ demoraCheck: 2000, demoraBajada: 3000 });
    const p = decidirArranque(u, 2500);
    await jest.advanceTimersByTimeAsync(2500);
    expect(await p).toBe("seguir");
    await jest.advanceTimersByTimeAsync(10_000);
    expect(u.fetchUpdateAsync).toHaveBeenCalled();
    expect(recargas).not.toHaveBeenCalled();
  });

  it("sin red: sigue con el código que tiene", async () => {
    const { u, recargas } = falso();
    (u.checkForUpdateAsync as unknown as jest.Mock).mockRejectedValue(new Error("offline"));
    const p = decidirArranque(u, 2500);
    await jest.advanceTimersByTimeAsync(10);
    expect(await p).toBe("seguir");
    expect(recargas).not.toHaveBeenCalled();
  });

  it("lo bajado no es nuevo: no recarga (evita un bucle)", async () => {
    const { u, recargas } = falso({ nuevo: false });
    const p = decidirArranque(u, 2500);
    await jest.advanceTimersByTimeAsync(10);
    expect(await p).toBe("seguir");
    expect(recargas).not.toHaveBeenCalled();
  });
});
