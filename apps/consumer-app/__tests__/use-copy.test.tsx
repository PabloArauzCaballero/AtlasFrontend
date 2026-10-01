/**
 * `useCopy`: el texto del portal si la pieza llega completa; si no, el de fábrica. Nunca un hueco.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ContentEntry } from '../src/api/endpoints/app-content';
import { COPY } from '../src/features/copy-catalog';
import { copyRemoto, olvidarCopyRemoto } from '../src/features/copy-cache';
import { olvidarContenidoPedido, useCopy } from '../src/features/use-contenido-remoto';

const mockGetContent = jest.fn();
jest.mock('../src/api/endpoints/app-content', () => ({
  getContent: (...args: unknown[]) => mockGetContent(...args),
}));

const pieza = (parcial: Partial<ContentEntry>): ContentEntry => ({
  contentKey: 'k',
  surface: 'copy',
  title: null,
  subtitle: null,
  body: null,
  bullets: [],
  metadata: {},
  action: null,
  displayOrder: 1,
  ...parcial,
});

function Probe() {
  const t = useCopy();
  return (
    <>
      <Text testID="texto">{t.texto('pagos.vacio')}</Text>
      <Text testID="titulo">{t.titulo('pagos.vacio')}</Text>
      <Text testID="solo-texto">{t.texto('inicio.calculando')}</Text>
    </>
  );
}

describe('useCopy', () => {
  beforeEach(() => {
    olvidarContenidoPedido();
    olvidarCopyRemoto();
    mockGetContent.mockReset();
  });

  it('sin respuesta del servidor (o antes de que llegue) sale el texto de fábrica', async () => {
    mockGetContent.mockResolvedValue([]);
    await render(<Probe />);
    expect(screen.getByTestId('texto').props.children).toBe(COPY['pagos.vacio'].texto);
    expect(screen.getByTestId('titulo').props.children).toBe(COPY['pagos.vacio'].titulo);
  });

  it('una pieza completa del portal sustituye el texto y el título', async () => {
    mockGetContent.mockResolvedValue([
      pieza({ contentKey: 'pagos.vacio', title: 'Aún no hay cuotas', body: 'Cuando compres, verás tus cuotas aquí.' }),
    ]);
    await render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('texto').props.children).toBe('Cuando compres, verás tus cuotas aquí.'));
    expect(screen.getByTestId('titulo').props.children).toBe('Aún no hay cuotas');
    // Lo que el portal no tocó sigue siendo de fábrica.
    expect(screen.getByTestId('solo-texto').props.children).toBe(COPY['inicio.calculando'].texto);
  });

  it('una pieza en blanco no deja la pantalla sin texto: queda el de fábrica', async () => {
    mockGetContent.mockResolvedValue([pieza({ contentKey: 'pagos.vacio', title: '  ', body: '   ' })]);
    await render(<Probe />);
    await waitFor(() => expect(mockGetContent).toHaveBeenCalled());
    expect(screen.getByTestId('texto').props.children).toBe(COPY['pagos.vacio'].texto);
  });

  it('pide la superficie una sola vez aunque varias pantallas usen el hook', async () => {
    mockGetContent.mockResolvedValue([pieza({ contentKey: 'pagos.vacio', body: 'X' })]);
    await render(
      <>
        <Probe />
        <Probe />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId('texto')[0]?.props.children).toBe('X'));
    expect(mockGetContent).toHaveBeenCalledTimes(1);
    expect(mockGetContent).toHaveBeenCalledWith('copy');
  });

  it('al cargar, deja los textos a mano de las funciones que no son componentes (etapas, bloqueos)', async () => {
    mockGetContent.mockResolvedValue([pieza({ contentKey: 'etapa.address', title: 'Dónde vives', body: 'Tu dirección.' })]);
    await render(<Probe />);
    await waitFor(() => expect(copyRemoto('etapa.address')).toEqual({ title: 'Dónde vives', body: 'Tu dirección.' }));
  });
});
