import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
  // En la prueba «tomar el foco» es montar: basta con ejecutar el efecto una vez.
  useFocusEffect: (efecto: () => void | (() => void)) => (require('react') as typeof import('react')).useEffect(efecto, []),
}));
const mockUltimoExtracto = jest.fn(async (): Promise<unknown> => null);
jest.mock('../src/api/endpoints/credit-line', () => ({
  ...jest.requireActual('../src/api/endpoints/credit-line'),
  getLatestBankStatement: () => mockUltimoExtracto(),
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
  nextTier: { code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 25, pointsMissing: 13, multiplier: 1.5 },
  ladder: [
    { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, reached: true },
    { code: 'EN_CONSTRUCCION', label: 'En crecimiento', from: 25, multiplier: 1.5, reached: false },
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
  expect(screen.getByText('NIVEL 1 DE 12')).toBeTruthy();
  expect(screen.getByText('Nuevo')).toBeTruthy();
  // Sin compras pagadas: 0 puntos, aunque la calificación sea 12. El nivel se mide en puntos.
  expect(screen.getByText('Faltan 100 para «Explorador»')).toBeTruthy();
});

it('SIN línea, explica por qué falta el puntaje (no es un hueco que parezca un fallo) y ofrece el extracto', async () => {
  await montar();
  expect(screen.getByText('Tu índice de crédito')).toBeTruthy();
  expect(screen.getByText('Todavía no calculamos tu línea de crédito.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Subir mi extracto bancario' }));
  expect(mockPush).toHaveBeenCalledWith('/(app)/extracto-bancario');
});

it('«Mis logros» en la tarjeta del nivel abre «Tu nivel Atlas»', async () => {
  await montar();
  await fireEvent.press(screen.getByTestId('nivel-logros'));
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
  expect(screen.getByText('NIVEL 1 DE 12')).toBeTruthy();
  expect(screen.getByText('No pudimos cargar tu índice de crédito')).toBeTruthy();
});

it('lo primero de Perfil es el saldo de crédito, antes de la tarjeta y del nivel', async () => {
  await montar();
  const textos = screen.getAllByText(/\S/).map((nodo) => [nodo.props.children].flat().join(''));
  const credito = textos.findIndex((t) => t.includes('Crédito habilitado'));
  const nivel = textos.findIndex((t) => t.includes('NIVEL 1 DE 12'));
  expect(credito).toBeGreaterThan(-1);
  expect(credito).toBeLessThan(nivel);
});

describe('el extracto bancario en Perfil, sin línea calculada', () => {
  beforeEach(() => {
    Object.assign(mockLibro, { creditLine: null, error: null, ready: true });
    mockUltimoExtracto.mockReset();
  });

  it('con un extracto recibido NO se vuelve a pedir: dice «pendiente de evaluar»', async () => {
    mockUltimoExtracto.mockResolvedValue({ status: 'received', rejectionReason: null });
    await montar();
    await waitFor(() => expect(screen.getAllByText(/pendiente de evaluar/).length).toBeGreaterThan(0));
    expect(screen.queryByText('Subir mi extracto bancario')).toBeNull();
    expect(screen.getByText('Ver mis extractos')).toBeTruthy();
  });

  it('sin nada subido sí lo pide', async () => {
    mockUltimoExtracto.mockResolvedValue(null);
    await montar();
    expect(await screen.findByText('Subir mi extracto bancario')).toBeTruthy();
    expect(screen.queryByText(/pendiente de evaluar/)).toBeNull();
  });
});
