import { render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IndexGate from '../app/index';
import { marcarPresentacionVista, presentacionVista } from '../src/session/primera-vez';

/**
 * La primera vez la app cuenta qué es Atlas; después, quien no tiene sesión entra directo a Ingresar
 * (pedido de Pablo, 2026-10-06).
 */
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
const mockSesion = { status: 'anonymous' };
jest.mock('../src/session/session', () => ({
  useSession: () => mockSesion,
  areaFor: () => 'auth',
}));

beforeEach(async () => {
  mockRedirect.mockClear();
  await AsyncStorage.clear();
});

it('la primera vez abre la presentación de Atlas', async () => {
  await render(<IndexGate />);
  await new Promise((r) => setTimeout(r, 0));
  expect(mockRedirect).toHaveBeenLastCalledWith('/(public)/bienvenida');
});

it('si ya la vio, va directo a Ingresar', async () => {
  await marcarPresentacionVista();
  await render(<IndexGate />);
  await new Promise((r) => setTimeout(r, 0));
  expect(mockRedirect).toHaveBeenLastCalledWith('/(auth)/ingresar');
  expect(mockRedirect).not.toHaveBeenCalledWith('/(public)/bienvenida');
});

it('si el almacenamiento falla, enseña la presentación', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('roto'));
  expect(await presentacionVista()).toBe(false);
});
