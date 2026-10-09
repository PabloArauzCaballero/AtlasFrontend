/**
 * APP-08: la lectura del carnet (nombre y nacimiento leídos por OCR) se borra al confirmar los datos,
 * como prometía el comentario de `lectura-del-carnet.ts`. Al cerrar sesión la borra
 * `session/datos-locales.ts` (ver `datos-locales.test.ts`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import PersonalData from '../app/(onboarding)/perfil';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/perfil',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({ customerId: '23', me: { profile: null }, refresh: jest.fn(async () => undefined) }),
}));
jest.mock('../src/api/endpoints/onboarding', () => ({
  getAnswers: jest.fn(async () => ({ personalData: null })),
  updateProfile: jest.fn(async () => ({})),
}));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('confirmar los datos borra la lectura del carnet', async () => {
  await AsyncStorage.setItem(
    'atlas.identidad.lectura.v1',
    JSON.stringify({ firstNames: 'MARIA RENEE', lastNames: 'RODRIGUEZ', dateOfBirth: '1990-05-01' }),
  );
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PersonalData />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(screen.getByDisplayValue('MARIA RENEE')).toBeTruthy();

  await act(async () => {
    fireEvent.press(screen.getByText('Confirmar mis datos'));
  });

  expect(await AsyncStorage.getItem('atlas.identidad.lectura.v1')).toBeNull();
  expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/progreso');
});
