/**
 * El icono propio de un punto: se pinta cuando llega, y cuando no se puede pintar la lista no cambia.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ContentBullets } from '../src/ui/content';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('icono propio en la lista de puntos', () => {
  it('pinta la imagen cuando el punto trae un icono propio valido', async () => {
    await render(<ContentBullets bullets={[{ text: 'Uno', icon: 'escudo', iconImage: PNG }]} />);
    expect(screen.getByTestId('icono-propio')).toBeTruthy();
    expect(screen.getByText('Uno')).toBeTruthy();
  });

  it('sin icono propio usa el del catalogo', async () => {
    await render(<ContentBullets bullets={[{ text: 'Uno', icon: 'escudo' }]} />);
    expect(screen.queryByTestId('icono-propio')).toBeNull();
    expect(screen.getByText('Uno')).toBeTruthy();
  });

  it('ignora lo que no es un PNG/WebP en data URI (un SVG, una URL) y cae al catalogo', async () => {
    await render(
      <ContentBullets
        bullets={[
          { text: 'Dos', iconImage: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
          { text: 'Tres', iconImage: 'https://ejemplo.com/i.png' },
        ]}
      />,
    );
    expect(screen.queryByTestId('icono-propio')).toBeNull();
  });

  it('si la imagen no se decodifica, el punto vuelve al icono del catalogo', async () => {
    await render(<ContentBullets bullets={[{ text: 'Uno', iconImage: PNG }]} />);
    await fireEvent(screen.getByTestId('icono-propio').children[0] as never, 'error');
    expect(screen.queryByTestId('icono-propio')).toBeNull();
    expect(screen.getByText('Uno')).toBeTruthy();
  });
});
