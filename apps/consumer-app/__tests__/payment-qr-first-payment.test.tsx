import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import PaymentScreen from '../app/(app)/pago/[itemId]';
import { getPaymentQrForPos } from '../src/api/endpoints/loans';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ itemId: 'initial-1' }),
  usePathname: () => '/pago/initial-1',
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('../src/api/endpoints/loans', () => ({ getPaymentQrForPos: jest.fn() }));
jest.mock('../src/session/session', () => ({ useSession: () => ({ customerId: '42' }) }));
jest.mock('../src/sandbox/store', () => ({
  useSandbox: () => {
    const React = require('react') as typeof import('react');
    const { issueUploadedQrInstruction } = require('../src/sandbox/engine') as typeof import('../src/sandbox/engine');
    const { minor } = require('../src/domain/money') as typeof import('../src/domain/money');
    const [instruction, setInstruction] = React.useState<ReturnType<typeof issueUploadedQrInstruction> | null>(null);
    const item = { id: 'initial-1', sequenceNo: 0, itemType: 'INITIAL' as const, dueAt: '2026-09-23T00:00:00.000Z', amount: minor(60_000), status: 'PENDING' as const, resolvedPaidAt: null };
    const order = { id: 'order-1', context: { tradeName: 'Comercio Andino', organizationId: '7', posId: '9' }, currency: 'BOB' as const };
    const ensureUploadedQrInstruction = React.useCallback((_itemId: string, qr: Parameters<typeof issueUploadedQrInstruction>[0]['qr']) => {
      setInstruction(issueUploadedQrInstruction({ item, qr, beneficiaryName: 'Comercio Andino', currency: 'BOB', now: Date.UTC(2026, 8, 23) }));
    }, []);
    return {
      ready: true,
      state: { schedules: [{ purchaseOrderId: 'order-1', items: [item] }], orders: [order], claims: [] },
      ensureInstruction: jest.fn(),
      ensureUploadedQrInstruction,
      instructionFor: () => instruction,
    };
  },
}));

it('muestra la imagen bancaria subida por el partner para el pago inicial del 60 %', async () => {
  (getPaymentQrForPos as jest.Mock).mockResolvedValue({
    qrId: '8', imageDataUrl: 'data:image/png;base64,UE5H', bankInstitutionCode: 'BNB', accountNumberMasked: '****1234',
  });
  render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <PaymentScreen />
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('QR bancario de Comercio Andino')).toBeTruthy());
  expect(getPaymentQrForPos).toHaveBeenCalledWith('7', '9');
  expect(screen.getByText('Bs 600,00')).toBeTruthy();
});

it('sin QR bancario aprobado no inventa un código de pago', async () => {
  (getPaymentQrForPos as jest.Mock).mockResolvedValue(null);
  render(
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <PaymentScreen />
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText(/no tiene un QR bancario aprobado/i)).toBeTruthy());
  expect(screen.queryByLabelText('QR bancario de Comercio Andino')).toBeNull();
});
