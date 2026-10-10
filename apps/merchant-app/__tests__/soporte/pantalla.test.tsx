/**
 * La pestaña de casos de Soporte montada, con la API simulada: los casos son tarjetas compactas con
 * el estado en español, y tocar una abre su detalle (con «Ver conversación» si sigue viva).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
  usePathname: () => '/soporte',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const CASO = {
  caseId: 'c-1',
  caseNumber: 'ATL-SUP-2026-367',
  title: 'No me llega el pago',
  caseType: 'INCIDENT',
  domain: 'PAYMENTS',
  status: 'WAITING_PARTNER',
  openedAt: '2026-10-02T15:00:00Z',
  lastActivityAt: null,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  summary: null,
  channels: [{ channelId: 'ch-1', status: 'OPEN', type: 'CHAT' }],
};
jest.mock('@/api/servicios/supportService', () => ({
  supportService: {
    listarCasos: () => Promise.resolve({ cases: [CASO] }),
    listarMotivos: () => Promise.resolve({ categories: [] }),
    verCaso: () => Promise.resolve({ ...CASO, channels: undefined }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VistaSoporte } = require('@/ui/soporte/vista-soporte') as typeof import('@/ui/soporte/vista-soporte');

test('los casos son tarjetas compactas y el detalle lleva a la conversación viva', async () => {
  const partner = { partnerId: 'p-1', cargando: false, error: null } as unknown as Parameters<typeof VistaSoporte>[0]['partner'];
  await render(<VistaSoporte partner={partner} vuelta={0} />);
  expect(await screen.findByText('No me llega el pago')).toBeTruthy();
  expect(screen.getByText('Espera tu respuesta')).toBeTruthy();
  expect(screen.queryByText('WAITING_PARTNER')).toBeNull();
  expect(screen.getByText(/^ATL-SUP-2026-367 · 2 oct$/)).toBeTruthy();
  expect(screen.getByTestId('hablar-con-soporte')).toBeTruthy();
  expect(screen.getByTestId('abrir-un-caso')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('caso-c-1'));
  await fireEvent.press(await screen.findByTestId('ver-conversacion'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/conversacion/[channelId]', params: { channelId: 'ch-1' } });
});
