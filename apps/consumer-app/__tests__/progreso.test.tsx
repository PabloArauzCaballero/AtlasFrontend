import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import Progreso from '../app/(app)/progreso';
import type { Progress } from '../src/api/endpoints/credit-line';
import { NivelCard } from '../src/ui/nivel-card';

/**
 * El nivel Atlas: se ve aunque no haya línea de crédito, dice cuánto falta, explica de dónde salen los puntos,
 * lista las misiones y jamás invita a endeudarse.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/progreso',
}));
jest.mock('../src/session/session', () => ({ useSession: () => ({ customerId: '42' }) }));
const mockEstado: { fase: string; progress: unknown; recargar: jest.Mock } = { fase: 'cargando', progress: null, recargar: jest.fn() };
jest.mock('../src/features/use-progress', () => ({ useProgress: () => mockEstado }));

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const envolver = (hijo: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICAS}>{hijo}</SafeAreaProvider>;

const PROGRESO: Progress = {
  customerId: '42',
  hasCreditLine: false,
  score: 30,
  tier: { code: 'EN_CONSTRUCCION', label: 'En construcción', index: 2, of: 5, multiplier: 1.5 },
  nextTier: { code: 'ESTABLECIDO', label: 'Establecido', from: 50, pointsMissing: 20, multiplier: 2.5 },
  ladder: [
    { code: 'NUEVO', label: 'Nuevo', from: 0, multiplier: 1, reached: true },
    { code: 'EN_CONSTRUCCION', label: 'En construcción', from: 25, multiplier: 1.5, reached: true },
    { code: 'ESTABLECIDO', label: 'Establecido', from: 50, multiplier: 2.5, reached: false },
    { code: 'CONSOLIDADO', label: 'Consolidado', from: 70, multiplier: 4, reached: false },
    { code: 'PREFERENTE', label: 'Preferente', from: 85, multiplier: 6, reached: false },
  ],
  components: [
    { code: 'paymentHistory', label: 'Pagos a tiempo', value: 50, weight: 0.45 },
    { code: 'loyalty', label: 'Compras terminadas de pagar', value: 0, weight: 0.25 },
    { code: 'tenure', label: 'Antigüedad', value: 25, weight: 0.2 },
    { code: 'verification', label: 'Identidad verificada', value: 100, weight: 0.1 },
  ],
  missions: [
    { code: 'verificar_identidad', label: 'Verifica tu identidad', detail: 'Cédula confirmada.', done: true, points: 'hasta +10' },
    { code: 'terminar_una_compra', label: 'Termina de pagar una compra', detail: 'Cada compra cerrada suma.', done: false, points: 'hasta +15' },
  ],
  signals: { tenureMonths: 3, loansSettled: 0, loansActive: 0, onTimeRatio: null, kycComplete: true },
  history: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEstado, { fase: 'lista', progress: PROGRESO });
});

describe('NivelCard', () => {
  it('enseña el nivel, los puntos y cuánto falta para el siguiente', async () => {
    await render(envolver(<NivelCard progress={PROGRESO} />));
    expect(screen.getByText('En construcción')).toBeTruthy();
    expect(screen.getByText('NIVEL 2 DE 5')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('Te faltan 20 puntos para «Establecido».')).toBeTruthy();
  });

  it('con onPress es un botón accesible que describe el nivel entero', async () => {
    const onPress = jest.fn();
    await render(envolver(<NivelCard progress={PROGRESO} onPress={onPress} />));
    const tarjeta = screen.getByRole('button', { name: /Tu nivel Atlas: En construcción, nivel 2 de 5, 30 puntos/ });
    await fireEvent.press(tarjeta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('pantalla «Tu nivel Atlas»', () => {
  it('sin línea de crédito igual muestra el nivel y los puntos (no una pantalla vacía)', async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText('NIVEL 2 DE 5')).toBeTruthy();
    expect(screen.getByText('De dónde salen tus puntos')).toBeTruthy();
    expect(screen.getByText('Pagos a tiempo')).toBeTruthy();
    expect(screen.getByText('pesa 45 %')).toBeTruthy();
  });

  it('lista las misiones y marca las cumplidas', async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByLabelText(/Verifica tu identidad\. Cumplida/)).toBeTruthy();
    expect(screen.getByLabelText(/Termina de pagar una compra\. Pendiente/)).toBeTruthy();
  });

  it('dice que pedir crédito no suma puntos', async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText(/Pedir más crédito no suma puntos/)).toBeTruthy();
  });

  it('marca dónde está la persona en la escalera de niveles', async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText(/En construcción · estás aquí/)).toBeTruthy();
    expect(screen.getByLabelText(/Establecido, desde 50 puntos\. Por alcanzar/)).toBeTruthy();
  });

  it('sin línea, la evolución lo explica y ofrece subir el extracto', async () => {
    await render(envolver(<Progreso />));
    expect(screen.getByText('Tu historia empieza aquí')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Subir mi extracto bancario' }));
    expect(mockPush).toHaveBeenCalledWith('/(app)/extracto-bancario');
  });

  it('con historial muestra cada versión con su cambio de límite', async () => {
    Object.assign(mockEstado, {
      progress: {
        ...PROGRESO,
        hasCreditLine: true,
        history: [
          { validFrom: '2026-09-20T10:00:00Z', trigger: 'repayment', scoring: 640, approvedLimit: 1500, relationshipScore: 31, relationshipTier: 'EN_CONSTRUCCION' },
          { validFrom: '2026-08-01T10:00:00Z', trigger: 'onboarding', scoring: 560, approvedLimit: 800, relationshipScore: 12, relationshipTier: 'NUEVO' },
        ],
      },
    });
    await render(envolver(<Progreso />));
    expect(screen.getByText(/Pago · 31 pts de nivel/)).toBeTruthy();
    expect(screen.getByText(/Alta · 12 pts de nivel/)).toBeTruthy();
    expect(screen.getByText(/▲/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Subir mi extracto bancario' })).toBeNull();
  });

  it('mientras carga no pinta un vacío; si falla, lo dice y deja reintentar', async () => {
    Object.assign(mockEstado, { fase: 'cargando', progress: null });
    const { unmount } = await render(envolver(<Progreso />));
    expect(screen.queryByText('Tu historia empieza aquí')).toBeNull();
    await unmount();

    Object.assign(mockEstado, { fase: 'fallo', progress: null });
    await render(envolver(<Progreso />));
    expect(screen.getByText('No pudimos cargar tu nivel')).toBeTruthy();
  });
});
