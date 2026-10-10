import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import SignIn from '../app/(auth)/ingresar';
import { AtlasApiError } from '../src/api/errors';

/**
 * El ingreso con PIN de cuatro casillas: se envía solo al cuarto dígito, conserva el ojo y, si el
 * servidor lo rechaza, vacía las casillas para reescribirlo.
 */
const mockSignIn = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/ingresar',
}));
const mockSesion: { motivoDeSalida: string | null } = { motivoDeSalida: null };
jest.mock('../src/session/session', () => ({
  useSession: () => ({ ...mockSesion, signIn: (...args: unknown[]) => mockSignIn(...args) }),
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <SignIn />
    </SafeAreaProvider>,
  );
const escribirCorreo = () => fireEvent.changeText(screen.getByLabelText('Correo o teléfono'), 'valeria@example.com');
const escribirPin = (digitos: string) => fireEvent.changeText(screen.getByLabelText('PIN'), digitos);

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue(undefined);
  mockSesion.motivoDeSalida = null;
});

it('si la sesión venció por el tope de 8 h, lo dice claro en la entrada', async () => {
  mockSesion.motivoDeSalida = 'sesion_caducada';
  await montar();
  expect(screen.getByText('Por seguridad, tu sesión dura 8 horas. Vuelve a entrar con tu PIN.')).toBeTruthy();
});

it('tras un cierre pedido no dice nada', async () => {
  await montar();
  expect(screen.queryByTestId('ingresar-motivo-salida')).toBeNull();
});

it('con el cuarto dígito entra solo, con el PIN completo', async () => {
  await montar();
  await escribirCorreo();
  await escribirPin('1234');
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('valeria@example.com', '1234'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('con tres dígitos no envía y dice cuántos faltan', async () => {
  await montar();
  await escribirCorreo();
  await escribirPin('123');
  await fireEvent.press(screen.getByTestId('ingresar-enviar'));
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(screen.getByText('Faltan 1 dígitos del PIN.')).toBeTruthy();
});

it('«Ingresar» está habilitado desde el primer momento (va en verde, no apagado en gris)', async () => {
  await montar();
  expect(screen.getByTestId('ingresar-enviar').props.accessibilityState?.disabled).not.toBe(true);
});

it('pulsar «Ingresar» vacío señala los dos campos y no envía nada', async () => {
  await montar();
  await fireEvent.press(screen.getByTestId('ingresar-enviar'));
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(screen.getByText('Escribe el correo o teléfono con el que te registraste.')).toBeTruthy();
  expect(screen.getByText('Falta tu PIN.')).toBeTruthy();
});

it('«Crear una cuenta» está a la vista y lleva al registro', async () => {
  await montar();
  await fireEvent.press(screen.getByRole('button', { name: /Crear una cuenta/ }));
  expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/registro');
});

it('el ojo alterna entre puntos y números', async () => {
  await montar();
  await escribirPin('4821');
  expect(screen.queryByText('4')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar PIN' }));
  expect(screen.getByText('4')).toBeTruthy();
  expect(screen.getByText('8')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ocultar PIN' })).toBeTruthy();
});

it('un PIN rechazado lo dice y vacía las casillas para reescribirlo', async () => {
  mockSignIn.mockRejectedValueOnce(new AtlasApiError({ kind: 'auth', code: 'UNAUTHORIZED', message: 'x', status: 401 }));
  await montar();
  await escribirCorreo();
  await escribirPin('0000');
  await waitFor(() => expect(screen.getAllByText(/PIN incorrecto|PIN incorrectos/).length).toBeGreaterThan(0));
  await act(async () => undefined);
  await escribirPin('1111');
  await waitFor(() => expect(mockSignIn).toHaveBeenLastCalledWith('valeria@example.com', '1111'));
});
