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
jest.mock('../src/session/session', () => ({ useSession: () => ({ signIn: (...args: unknown[]) => mockSignIn(...args) }) }));

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
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(screen.getByText('Faltan 1 dígitos del PIN.')).toBeTruthy();
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
