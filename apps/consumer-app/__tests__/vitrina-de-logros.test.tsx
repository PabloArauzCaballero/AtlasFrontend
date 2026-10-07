import { fireEvent, render, screen } from "@testing-library/react-native";
import type { Badge, Progress } from "../src/api/endpoints/credit-line";
import * as bus from "../src/features/celebraciones-bus";
import { masCercano, porColeccion, VitrinaDeLogros } from "../src/ui/vitrina-de-logros";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

const b = (code: string, extra: Partial<Badge> = {}): Badge => ({
  code,
  label: code,
  detail: `detalle ${code}`,
  icon: "estrella",
  rank: "plata",
  category: "pagos",
  secret: false,
  hint: null,
  earned: false,
  current: 0,
  target: 10,
  ...extra,
});

const con = (badges: Badge[]): Progress => ({ ...PROGRESO_DE_PRUEBA, experience: { ...PROGRESO_DE_PRUEBA.experience, badges } });

describe("masCercano", () => {
  it("el de más avance proporcional, no el de más puntos", () => {
    const r = masCercano([b("a", { current: 9, target: 10 }), b("b", { current: 400, target: 1000 }), b("c", { current: 6, target: 10 })]);
    expect(r?.code).toBe("a");
  });

  it("ignora las ganadas, las secretas y las que no han empezado", () => {
    expect(masCercano([b("a", { earned: true, current: 10 }), b("s", { secret: true, current: 9 }), b("z", { current: 0 })])).toBeNull();
  });
});

describe("porColeccion", () => {
  it("agrupa y ordena las colecciones como se enseñan", () => {
    const g = porColeccion([b("1", { category: "cuenta" }), b("2", { category: "compras" }), b("3", { category: "rachas" })]);
    expect(g.map((x) => x.clave)).toEqual(["compras", "rachas", "cuenta"]);
  });

  it("un backend anterior (sin category) va en un solo grupo", () => {
    const g = porColeccion([b("1", { category: undefined }), b("2", { category: undefined })]);
    expect(g).toHaveLength(1);
    expect(g[0]!.items).toHaveLength(2);
  });
});

describe("VitrinaDeLogros", () => {
  it("muestra el avance de cada colección y lo más cercano arriba", async () => {
    await render(
      <VitrinaDeLogros
        progress={con([
          b("r3", { category: "rachas", earned: true, current: 3, target: 3, label: "Racha de 3" }),
          b("r6", { category: "rachas", current: 4, target: 6, label: "Racha de 6" }),
          b("c1", { category: "compras", earned: true, current: 1, target: 1, label: "Primera compra" }),
        ])}
      />,
    );
    expect(screen.getByText("2 de 3 ganadas · de bronce a diamante")).toBeTruthy();
    expect(screen.getByTestId("logro-mas-cercano")).toBeTruthy();
    // La cabecera es la de la colección que se ve (la primera: Compras, completa); las demás están a un deslizamiento.
    expect(screen.getByText("Completa")).toBeTruthy();
    expect(screen.getByLabelText("Colección Rachas")).toBeTruthy();
  });

  it("una secreta sin ganar no dice su nombre: enseña su pista", async () => {
    await render(<VitrinaDeLogros progress={con([b("s", { secret: true, hint: "Ni el día de descanso te frena.", label: "Pago de domingo" })])} />);
    expect(screen.queryByText("Pago de domingo")).toBeNull();
    expect(screen.getByText("Insignia secreta")).toBeTruthy();
    expect(screen.getByText("SECRETA")).toBeTruthy();
    expect(screen.getByLabelText(/Secreto\. Ni el día de descanso te frena/)).toBeTruthy();
  });

  it("una secreta ya ganada enseña su nombre", async () => {
    await render(<VitrinaDeLogros progress={con([b("s", { secret: true, hint: "x", label: "Pago de domingo", earned: true, current: 10 })])} />);
    expect(screen.getByText("Pago de domingo")).toBeTruthy();
  });

  it("tocar CUALQUIER insignia abre su carta, ganada o pendiente", async () => {
    const abrir = jest.spyOn(bus, "abrirCartaDeInsignia").mockImplementation(() => {});
    await render(<VitrinaDeLogros progress={con([b("g", { earned: true, current: 10, label: "Ganada" }), b("p", { label: "Pendiente", current: 2 })])} />);
    await fireEvent.press(screen.getByTestId("insignia-g"));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0]![0]).toMatchObject({ tipo: "insignia", insignia: { code: "g" } });
    await fireEvent.press(screen.getByTestId("insignia-p"));
    expect(abrir).toHaveBeenCalledTimes(2);
    expect(abrir.mock.calls[1]![0]).toMatchObject({ insignia: { code: "p", earned: false } });
    abrir.mockRestore();
  });

  it("va paginada: una página por colección, con un punto por colección", async () => {
    await render(<VitrinaDeLogros progress={con([b("a", { category: "compras" }), b("b", { category: "rachas" }), b("c", { category: "cuenta" })])} />);
    expect(screen.getByTestId("coleccion-compras")).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("cada rango tiene su metal: un diamante se anuncia como diamante", async () => {
    await render(<VitrinaDeLogros progress={con([b("d", { rank: "diamante", earned: true, current: 10, label: "Imparable" })])} />);
    expect(screen.getByText("DIAMANTE")).toBeTruthy();
    expect(screen.getByLabelText(/Insignia de diamante: Imparable\. Ganado/)).toBeTruthy();
  });
});
