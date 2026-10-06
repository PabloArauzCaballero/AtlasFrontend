import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Perfil from '../app/(app)/(tabs)/perfil';

/**
 * El reclamo: «lo de mostrar el puntaje, nada». Sin línea de crédito calculada, Perfil no pintaba NINGUNA
 * tarjeta de puntaje y la persona no sabía ni que existía. Ahora el nivel se ve siempre y, si falta la línea,
 * se explica y se ofrece qué hacer.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/perfil',
}));
jest.mock('../src/ui/tour', () => ({ useTour: () => ({ start: jest.fn(), activo: false }), resetTour: jest.fn(), TourTarget: ({ children }: { children: unknown }) => children }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../src/api/endpoints/auth', () => ({ setMfaPreference: jest.fn(), verifyPin: jest.fn() }));
jest.mock('../src/api/endpoints/app-content', () => ({ getContent: jest.fn(async () => []) }));
jest.mock('../src/device/version-app', () => ({
  leerVersionApp: jest.fn(async () => ({})),
  resumenDeVersion: () => 'v1',
  textoParaSoporte: () => 'v1',
}));
jest.mock('../src/session/session', () => ({
  useSession: () => ({
    customerId: '42',
    refresh: jest.fn(),
    signOut: jest.fn(),
    me: { customer: { customerCode: '33F148', status: 'active' }, profile: { firstName: 'Pablo', lastName: 'Arauz' }, contacts: [] },
  }),
}));
const mockLibro = { ready: true, error: null as string | null, creditLine: null as unknown, rating: null, spending: null, loans: [], reload: jest.fn() };
jest.mock('../src/features/use-credit-book', () => ({ useCreditBook: () => mockLibro }));
const mockNivel: { fase: string; progress: unknown; recargar: jest.Mock } = { fase: 'lista', progress: null, recargar: jest.fn() };
jest.mock('../src/features/use-progress', () => ({ useProgress: () => mockNivel }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Perfil />
    </SafeAreaProvider>,
  );
const NIVEL = {
  customerId: '42',
  hasCreditLine: false,
  score: 12,
  tier: { code: 'NUEVO', label: 'Nuevo', index: 1, of: 5, multiplier: 1 },
  nextTier: { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, pointsMissing: 13, multiplier: 1.5 },
  ladder: [
    { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, reached: true },
    { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, multiplier: 1.5, reached: false },
  ],
  components: [],
  missions: [],
  signals: { tenureMonths: 0, loansSettled: 0, loansActive: 0, onTimeRatio: null, kycComplete: false },
  history: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockLibro, { ready: true, error: null, creditLine: null });
  Object.assign(mockNivel, { fase: 'lista', progress: NIVEL });
});

it('SIN línea de crédito, Perfil muestra igual el nivel y los puntos', async () => {
  await montar();
  expect(screen.getByText('NIVEL 1 DE 5')).toBeTruthy();
  expect(screen.getByText('Nuevo')).toBeTruthy();
  // Sin compras pagadas: 0 puntos, aunque la calificación sea 12. El nivel se mide en puntos.
  expect(screen.getByText('Te faltan 500 puntos para «En construcción». Los ganas pagando tus compras a tiempo.')).toBeTruthy();
});

it('SIN línea, explica por qué falta el puntaje (no es un hueco que parezca un fallo) y ofrece el extracto', async () => {
  await montar();
  expect(screen.getByText('Tu índice de crédito')).toBeTruthy();
  expect(screen.getByText('Todavía no calculamos tu línea de crédito.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Subir mi extracto bancario' }));
  expect(mockPush).toHaveBeenCalledWith('/(app)/extracto-bancario');
});

it('tocar la tarjeta del nivel abre «Tu nivel Atlas»', async () => {
  await montar();
  await fireEvent.press(screen.getByTestId('nivel-card'));
  expect(mockPush).toHaveBeenCalledWith('/(app)/progreso');
});

it('mientras el nivel carga no pinta ni el nivel ni un error', async () => {
  Object.assign(mockNivel, { fase: 'cargando', progress: null });
  await montar();
  expect(screen.queryByTestId('nivel-card')).toBeNull();
  expect(screen.queryByText('No pudimos cargar tu nivel')).toBeNull();
});

it('si el nivel falla, lo dice con reintento', async () => {
  Object.assign(mockNivel, { fase: 'fallo', progress: null });
  await montar();
  expect(screen.getByText('No pudimos cargar tu nivel')).toBeTruthy();
});

it('si el libro de créditos falla, el nivel se sigue viendo y el fallo del puntaje se dice aparte', async () => {
  mockLibro.error = 'No pudimos cargar tus créditos.';
  await montar();
  expect(screen.getByText('NIVEL 1 DE 5')).toBeTruthy();
  expect(screen.getByText('No pudimos cargar tu índice de crédito')).toBeTruthy();
});
