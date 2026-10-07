import { render, screen } from '@testing-library/react-native';
import { Ilustracion, NOMBRES_DE_ILUSTRACION } from '../src/ui/ilustraciones-bienvenida';

/**
 * Las cuatro ilustraciones se montan, mantienen su proporción a cualquier ancho y son accesibles o decorativas
 * según se pida.
 */
describe('Ilustracion', () => {
  it.each(NOMBRES_DE_ILUSTRACION)('«%s» se monta y tiene descripción para el lector de pantalla', async (nombre) => {
    await render(<Ilustracion nombre={nombre} />);
    expect(screen.getByRole('image')).toBeTruthy();
  });

  it('el alto sale de la proporción del dibujo: no se deforma a ningún ancho', async () => {
    const { toJSON } = await render(<Ilustracion nombre="que-es-atlas" ancho={640} />);
    const texto = JSON.stringify(toJSON());
    expect(texto).toContain('"width":640');
    expect(texto).toContain('"height":440');
  });

  it('decorativa no se anuncia: el título de debajo ya dice lo mismo', async () => {
    await render(<Ilustracion nombre="escaneas-y-listo" decorativa />);
    expect(screen.queryByRole('image')).toBeNull();
  });
});
