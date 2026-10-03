import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Compras from '../app/(app)/compras';

/**
 * «Mis compras» como pantalla: espera sin pintar un vacío, error con reintento, vacío con salida, y la
 * lista agrupada con su filtro.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/compras',
}));
jest.mock('../src/session/session', () => ({ useSession: () => ({ customerId: '42' }) }));
const mockBook = { ready: true, error: null as string | null, loans: [] as unknown[], reload: jest.fn() };
jest.mock('../src/features/use-credit-book', () => ({ useCreditBook: () => mockBook }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Compras />
    </SafeAreaProvider>,
  );
const credito = (id: string, extra: Record<string, unknown> = {}) => ({
  loanId: id,
  loanCode: `L-${id}`,
  currencyCode: 'BOB',
  principalAmount: '250.00',
  status: 'active',
  disbursedAt: '2026-09-10T12:00:00Z',
  firstDueDate: '2026-10-10',
  daysPastDue: 0,
  merchant: { partnerProfileId: 'p', displayName: 'Farmacia Andina', businessCategory: 'salud' },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockBook, { ready: true, error: null, loans: [] });
});

it('mientras carga no dice «Todavía no compraste»', async () => {
  mockBook.ready = false;
  await montar();
  expect(screen.queryByText('Todavía no compraste con Atlas')).toBeNull();
});

it('si falla la carga lo dice y deja reintentar', async () => {
  mockBook.error = 'No pudimos cargar tus créditos.';
  await montar();
  expect(screen.getByText('No pudimos cargar tus compras')).toBeTruthy();
  expect(screen.queryByText('Todavía no compraste con Atlas')).toBeNull();
});

it('sin compras ofrece escanear', async () => {
  await montar();
  expect(screen.getByText('Todavía no compraste con Atlas')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Escanear QR del comercio' }));
  expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/escanear');
});

it('muestra las compras agrupadas por mes, con su estado, y abre el detalle', async () => {
  mockBook.loans = [credito('1'), credito('2', { status: 'paid_off', disbursedAt: '2026-08-05T12:00:00Z', merchant: { partnerProfileId: 'q', displayName: 'Ferretería Sur', businessCategory: 'hogar' } })];
  await montar();
  expect(screen.getByText('septiembre de 2026')).toBeTruthy();
  expect(screen.getByText('agosto de 2026')).toBeTruthy();
  // «Al día» sale dos veces: como filtro y como estado de la compra.
  expect(screen.getAllByText('Al día')).toHaveLength(2);
  expect(screen.getByText('Pagada')).toBeTruthy();
  await fireEvent.press(screen.getByText('Farmacia Andina'));
  expect(mockPush).toHaveBeenCalledWith('/(app)/credito/1');
});

it('el filtro «Pagadas» deja sólo las pagadas y avisa si no hay', async () => {
  mockBook.loans = [credito('1')];
  await montar();
  await fireEvent.press(screen.getByRole('button', { name: 'Mostrar compras: Pagadas' }));
  expect(screen.getByText('Nada con ese filtro')).toBeTruthy();
  expect(screen.queryByText('Farmacia Andina')).toBeNull();
});
