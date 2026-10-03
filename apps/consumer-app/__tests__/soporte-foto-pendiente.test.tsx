import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Conversacion from '../app/(app)/soporte/[channelId]';
import * as supportApi from '../src/api/endpoints/support';
import { subirFotoAlChat } from '../src/features/support-chat';

/**
 * La foto del chat de soporte NO se envía al elegirla: queda pendiente, se ve y admite un texto.
 */
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ channelId: 'canal-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/soporte/canal-1',
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///galeria/foto.jpg' }] })),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../src/api/endpoints/support', () => ({
  readTranscript: jest.fn(async () => ({ messages: [], readState: [] })),
  markRead: jest.fn(async () => undefined),
  sendMessage: jest.fn(),
  announceTyping: jest.fn(async () => undefined),
  closeChannel: jest.fn(),
  readAttachment: jest.fn(async () => null),
}));
jest.mock('../src/features/support-chat', () => ({
  ...jest.requireActual('../src/features/support-chat'),
  subirFotoAlChat: jest.fn(),
}));

const sendMessage = supportApi.sendMessage as jest.Mock;
const subir = subirFotoAlChat as jest.Mock;
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ADJUNTO = { storageObjectKey: 'k', filename: 'foto.jpg', declaredMime: 'image/jpeg', sizeBytes: 5, sha256: 'h' };
const respuesta = (body: string) => ({
  messageId: 'm1', sequence: '1', body, senderActorType: 'CUSTOMER', visibility: 'PUBLIC', redacted: false,
  createdAt: '2026-10-03T10:00:00Z', attachments: [],
});

async function elegirFotoDeLaGaleria() {
  // `Alert.alert` es el menú del clip: se activa la opción «Elegir de la galería».
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => {
    botones?.find((b) => b.text === 'Elegir de la galería')?.onPress?.();
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Adjuntar una foto' }));
  await waitFor(() => expect(screen.getByTestId('compositor-adjunto')).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  subir.mockResolvedValue(ADJUNTO);
  sendMessage.mockImplementation(async (_c, entrada: { body: string }) => respuesta(entrada.body));
});

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Conversacion />
    </SafeAreaProvider>,
  );

it('elegir la foto la deja pendiente y NO envía nada', async () => {
  await montar();
  await elegirFotoDeLaGaleria();
  expect(subir).not.toHaveBeenCalled();
  expect(sendMessage).not.toHaveBeenCalled();
});

it('con la foto pendiente se escribe un texto y se envía junto a ella', async () => {
  await montar();
  await elegirFotoDeLaGaleria();
  await fireEvent.changeText(screen.getByTestId('compositor-campo'), 'mira esto');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
  });
  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  expect(subir).toHaveBeenCalledWith({ channelId: 'canal-1', localUri: 'file:///galeria/foto.jpg' });
  expect(sendMessage.mock.calls[0]?.[1]).toMatchObject({ body: 'mira esto', messageType: 'IMAGE', attachment: ADJUNTO });
  await waitFor(() => expect(screen.queryByTestId('compositor-adjunto')).toBeNull());
});

it('sin texto, la foto sale con el cuerpo de siempre', async () => {
  await montar();
  await elegirFotoDeLaGaleria();
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
  });
  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  expect(sendMessage.mock.calls[0]?.[1]).toMatchObject({ body: 'Te envío una imagen', messageType: 'IMAGE' });
});

it('si el envío falla, la foto y el texto se quedan para reintentar', async () => {
  sendMessage.mockRejectedValueOnce(new Error('red'));
  await montar();
  await elegirFotoDeLaGaleria();
  await fireEvent.changeText(screen.getByTestId('compositor-campo'), 'mira esto');
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
  });
  await waitFor(() => expect(screen.getByText('No pudimos enviar la imagen. Inténtalo de nuevo.')).toBeTruthy());
  expect(screen.getByTestId('compositor-adjunto')).toBeTruthy();
  expect(screen.getByTestId('compositor-campo').props.value).toBe('mira esto');
});

it('la advertencia de no escribir el PIN sigue a la vista', async () => {
  await montar();
  expect(screen.getByText(/Nunca escribas tu PIN/)).toBeTruthy();
});
