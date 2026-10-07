import { render, screen } from "@testing-library/react-native";
import { Insignia } from "../src/ui/insignia";
import { PROGRESO_DE_PRUEBA } from "./progreso-datos";

const [ganada, , pendiente] = PROGRESO_DE_PRUEBA.experience.badges as [
  (typeof PROGRESO_DE_PRUEBA.experience.badges)[number],
  unknown,
  (typeof PROGRESO_DE_PRUEBA.experience.badges)[number],
];

describe("Insignia", () => {
  it("una ganada se anuncia como ganada, con lo que significa", async () => {
    await render(<Insignia insignia={ganada} />);
    expect(
      screen.getByLabelText(
        /Insignia de bronce: Primera compra\. Ganado\. Hiciste tu primera compra/,
      ),
    ).toBeTruthy();
    // El rango del trofeo, en su placa.
    expect(screen.getByText("BRONCE")).toBeTruthy();
  });

  it("una pendiente dice cuánto avanzó y cuánto falta", async () => {
    await render(<Insignia insignia={pendiente} />);
    expect(
      screen.getByLabelText(/Racha de 6\. Pendiente, 3 de 6/),
    ).toBeTruthy();
    expect(screen.getByText("3 de 6")).toBeTruthy();
  });

  it("un icono que la app no conoce no la rompe: cae a la estrella", async () => {
    await render(
      <Insignia insignia={{ ...ganada, icon: "icono-inventado" }} />,
    );
    expect(screen.getByTestId("insignia-primera_compra")).toBeTruthy();
  });

  it("un avance mayor que la meta no se sale del anillo", async () => {
    await render(
      <Insignia insignia={{ ...pendiente, current: 99, target: 6 }} />,
    );
    expect(screen.getByTestId("insignia-racha_6")).toBeTruthy();
  });
});
