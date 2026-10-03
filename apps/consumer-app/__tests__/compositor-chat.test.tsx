import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CompositorChat } from '../src/ui/compositor-chat';
import { AdjuntoImagen, vaciarCacheDeAdjuntos } from '../src/ui/adjunto-imagen';
import * as supportApi from '../src/api/endpoints/support';

/**
 * El compositor estilo WhatsApp y la imagen del adjunto.
 */
jest.mock('../src/api/endpoints/support', () => ({ readAttachment: jest.fn() }));
const readAttachment = supportApi.readAttachment as jest.Mock;

const base = { texto: '', onChangeText: jest.fn(), onEnviar: jest.fn(), onAdjuntar: jest.fn() };

describe('CompositorChat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin texto ni foto, enviar está apagado y no envía', async () => {
    await render(<CompositorChat {...base} />);
    const enviar = screen.getByRole('button', { name: 'Enviar' });
    expect(enviar.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(enviar);
    expect(base.onEnviar).not.toHaveBeenCalled();
  });

  it('con texto, enviar funciona', async () => {
    await render(<CompositorChat {...base} texto="hola" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(base.onEnviar).toHaveBeenCalledTimes(1);
  });

  it('con una foto pendiente y SIN texto, enviar ya funciona y se ve la miniatura', async () => {
    await render(<CompositorChat {...base} adjuntoUri="file:///foto.jpg" onQuitarAdjunto={jest.fn()} />);
    expect(screen.getByTestId('compositor-adjunto')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar' }).props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('la ✕ quita la foto pendiente', async () => {
    const quitar = jest.fn();
    await render(<CompositorChat {...base} adjuntoUri="file:///foto.jpg" onQuitarAdjunto={quitar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar la foto' }));
    expect(quitar).toHaveBeenCalledTimes(1);
  });

  it('el clip pide adjuntar', async () => {
    await render(<CompositorChat {...base} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Adjuntar una foto' }));
    expect(base.onAdjuntar).toHaveBeenCalledTimes(1);
  });

  it('mientras envía no deja volver a enviar', async () => {
    await render(<CompositorChat {...base} texto="hola" enviando />);
    expect(screen.getByRole('button', { name: 'Enviar' }).props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});

describe('AdjuntoImagen', () => {
  const adjunto = (scanStatus: string) => ({ attachmentId: 'a1', filename: 'foto.jpg', mime: 'image/jpeg', sizeBytes: 10, scanStatus, sha256: 'x' });
  beforeEach(() => {
    jest.clearAllMocks();
    vaciarCacheDeAdjuntos();
  });

  it('pinta la imagen descargada con la sesión', async () => {
    readAttachment.mockResolvedValue('data:image/jpeg;base64,AAAA');
    await render(<AdjuntoImagen adjunto={adjunto('clean')} />);
    await waitFor(() => expect(screen.getByTestId('adjunto-imagen')).toBeTruthy());
    expect(readAttachment).toHaveBeenCalledWith('a1');
  });

  it('no baja dos veces la misma imagen', async () => {
    readAttachment.mockResolvedValue('data:image/jpeg;base64,AAAA');
    const primera = await render(<AdjuntoImagen adjunto={adjunto('clean')} />);
    await waitFor(() => expect(screen.getByTestId('adjunto-imagen')).toBeTruthy());
    await primera.unmount();
    await render(<AdjuntoImagen adjunto={adjunto('clean')} />);
    expect(screen.getByTestId('adjunto-imagen')).toBeTruthy();
    expect(readAttachment).toHaveBeenCalledTimes(1);
  });

  it('una imagen en revisión no se pide: dice que se está revisando', async () => {
    await render(<AdjuntoImagen adjunto={adjunto('pending')} />);
    expect(screen.getByText('Revisando la imagen…')).toBeTruthy();
    expect(readAttachment).not.toHaveBeenCalled();
  });

  it('una infectada no se pinta', async () => {
    await render(<AdjuntoImagen adjunto={adjunto('infected')} />);
    expect(screen.getByText('No se pudo mostrar esta imagen')).toBeTruthy();
    expect(readAttachment).not.toHaveBeenCalled();
  });

  it('si la descarga falla, vuelve al chip con el nombre', async () => {
    readAttachment.mockResolvedValue(null);
    await render(<AdjuntoImagen adjunto={adjunto('clean')} />);
    await waitFor(() => expect(screen.getByText(/foto\.jpg/i)).toBeTruthy());
  });
});
