/**
 * «Al hacer un pago tenés que salirte de la app (cerrarla) para que recarguen las compras, puntos y otros elementos»
 * (Pablo, 2026-10-09), reproducido con las pantallas de verdad y la API simulada en jest.
 *
 * Inicio y la pantalla de pagar una cuota montadas A LA VEZ, como en el teléfono (las pestañas quedan montadas
 * debajo de la hoja de pago). Ninguna se vuelve a montar ni gana el foco: lo único que pasa es el pago. El servidor
 * confirma en diferido —el préstamo, la línea y los puntos cambian un par de segundos DESPUÉS de la respuesta al
 * aviso—, que es justo lo que antes se perdía.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Home from '../app/(app)/(tabs)/index';
import PayInstallmentScreen from '../app/(app)/pagar/[installmentId]';
import * as creditLineApi from '../src/api/endpoints/credit-line';
import * as loansApi from '../src/api/endpoints/loans';
import * as claimsApi from '../src/api/endpoints/payment-claims';
import { formatAmount } from '../src/features/spending-copy';
import { cancelarRepasos } from '../src/features/refresco';
import { PROGRESO_DE_PRUEBA } from './progreso-datos';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// Dos pantallas enteras con sus animaciones bajo relojes falsos: tardan más que una prueba de dominio.
jest.setTimeout(30_000);

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ installmentId: '9' }),
  usePathname: () => '/',
}));
const mockSesion = { customerId: '42', me: { profile: { firstName: 'Pablo' } }, refresh: jest.fn(async () => undefined) };
jest.mock('../src/session/session', () => ({ useSession: () => mockSesion }));
jest.mock('../src/sandbox/store', () => ({ useSandbox: () => ({ ready: true, nextDue: null, state: { orders: [] } }) }));
jest.mock('../src/ui/partner-banner', () => ({ PartnerBanner: () => null, usePartnerBanner: () => null }));
jest.mock('../src/ui/surface-content', () => ({ SurfaceContent: () => null, esBannerDePartner: () => false, useSurfaceContent: () => [] }));
jest.mock('../src/features/use-contenido-remoto', () => ({
  useCopy: () => ({ texto: (clave: string) => clave, titulo: (clave: string) => clave }),
  useTourInicio: () => [],
}));
jest.mock('../src/ui/tour', () => ({
  TourTarget: ({ children }: { children: React.ReactNode }) => children,
  shouldAutoStart: async () => false,
  useTour: () => ({ start: jest.fn() }),
}));
jest.mock('../src/api/endpoints/loans', () => ({
  ...jest.requireActual('../src/api/endpoints/loans'),
  listLoans: jest.fn(),
  getSpendingByCategory: jest.fn(),
  getCreditRating: jest.fn(),
  getPaymentCalendar: jest.fn(),
}));
jest.mock('../src/api/endpoints/credit-line', () => ({
  ...jest.requireActual('../src/api/endpoints/credit-line'),
  getCreditLine: jest.fn(),
  getProgress: jest.fn(),
}));
jest.mock('../src/api/endpoints/payment-claims', () => ({
  ...jest.requireActual('../src/api/endpoints/payment-claims'),
  getPaymentInstruction: jest.fn(),
  submitPaymentClaim: jest.fn(),
}));
jest.mock('../src/features/comprobante-de-pago', () => ({
  subirComprobante: jest.fn(async () => ({ storageKey: 'k', contentType: 'image/jpeg' })),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///comprobante.jpg' }] })),
}));

/** Lo que el servidor «sabe» en cada momento. El pago lo cambia, pero con retraso. */
const servidor = { disponible: 1250, porPagar: 250, puntos: 24 };
const linea = () => ({
  currencyCode: 'BOB',
  approvedLimit: 1500,
  used: servidor.porPagar,
  available: servidor.disponible,
  maxAffordableInstallment: null,
  disposableIncome: null,
});

const METRICAS = initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Object.assign(servidor, { disponible: 1250, porPagar: 250, puntos: 24 });
  (loansApi.listLoans as jest.Mock).mockImplementation(async () => ({ items: [] }));
  (loansApi.getSpendingByCategory as jest.Mock).mockImplementation(async () => ({ currencyCode: 'BOB', totals: { overdue: 0, outstanding: servidor.porPagar }, categories: [] }));
  (loansApi.getCreditRating as jest.Mock).mockRejectedValue(new Error('404'));
  (loansApi.getPaymentCalendar as jest.Mock).mockImplementation(async () => ({ entries: [] }));
  (creditLineApi.getCreditLine as jest.Mock).mockImplementation(async () => linea());
  (creditLineApi.getProgress as jest.Mock).mockImplementation(async () => ({ ...PROGRESO_DE_PRUEBA, score: servidor.puntos }));
  (claimsApi.getPaymentInstruction as jest.Mock).mockImplementation(async () => ({
    installmentId: '9',
    loanId: '5',
    loanCode: 'L-5',
    installmentNumber: 1,
    dueDate: '2026-10-20',
    currencyCode: 'BOB',
    amountDue: '250.00',
    amountOutstanding: '250.00',
    status: 'pending',
    merchant: { partnerProfileId: 'p', displayName: 'Farmacia Andina' },
    paymentQr: null,
    paymentQrUnavailableReason: 'PARTNER_HAS_NO_PAYMENT_QR',
    openClaim: null,
  }));
  (claimsApi.submitPaymentClaim as jest.Mock).mockImplementation(async () => {
    // El servidor acepta el aviso YA, pero el préstamo, la línea y los puntos cambian 2 s después (comercio + desembolso).
    setTimeout(() => Object.assign(servidor, { disponible: 1400, porPagar: 100, puntos: 31 }), 2_000);
    return { claimId: 'c1' };
  });
});

afterEach(() => {
  cancelarRepasos();
  jest.useRealTimers();
});

const pasar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

it('pagar una cuota actualiza la línea de Inicio sin cerrar la app ni volver a montarla', async () => {
  await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Home />
      <PayInstallmentScreen />
    </SafeAreaProvider>,
  );
  await pasar(0);
  expect(screen.getByText(formatAmount(1250, 'BOB'))).toBeTruthy();
  const pedidasAntes = (creditLineApi.getCreditLine as jest.Mock).mock.calls.length;

  await fireEvent.press(screen.getByRole('button', { name: /Adjuntar comprobante/ }));
  await pasar(0);
  await fireEvent.press(screen.getByRole('button', { name: /Ya realicé el pago/ }));
  await pasar(0);
  expect(claimsApi.submitPaymentClaim).toHaveBeenCalledTimes(1);
  // Recarga en el acto (el servidor todavía no cambió)…
  expect((creditLineApi.getCreditLine as jest.Mock).mock.calls.length).toBeGreaterThan(pedidasAntes);
  expect(screen.getByText(formatAmount(1250, 'BOB'))).toBeTruthy();

  // …y el repaso de los 3 s alcanza la confirmación diferida del servidor.
  await pasar(3_000);
  expect(screen.getByText(formatAmount(1400, 'BOB'))).toBeTruthy();
  expect(screen.queryByText(formatAmount(1250, 'BOB'))).toBeNull();
  expect((creditLineApi.getProgress as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
});

it('tirar hacia abajo en Inicio recarga la línea y los puntos, no sólo el perfil', async () => {
  const { container } = await render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Home />
    </SafeAreaProvider>,
  );
  await pasar(0);
  Object.assign(servidor, { disponible: 900 });
  const lineaAntes = (creditLineApi.getCreditLine as jest.Mock).mock.calls.length;
  const puntosAntes = (creditLineApi.getProgress as jest.Mock).mock.calls.length;

  // El gesto de tirar: el `onRefresh` del control de recarga de la pantalla.
  const [desplazable] = container.queryAll((nodo) => nodo.type === 'RCTScrollView' && Boolean(nodo.props.refreshControl));
  await act(async () => {
    desplazable!.props.refreshControl.props.onRefresh();
  });
  await pasar(0);

  expect(mockSesion.refresh).toHaveBeenCalled();
  expect((creditLineApi.getCreditLine as jest.Mock).mock.calls.length).toBe(lineaAntes + 1);
  expect((creditLineApi.getProgress as jest.Mock).mock.calls.length).toBe(puntosAntes + 1);
  expect(screen.getByText(formatAmount(900, 'BOB'))).toBeTruthy();
});
