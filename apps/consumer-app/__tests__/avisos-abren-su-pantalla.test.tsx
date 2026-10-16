/**
 * La bandeja de Avisos: tocar un aviso con destino abre su pantalla (2026-10-16: «tu capacidad fue actualizada»
 * lleva a Inicio, «no pudimos usar tu extracto» a Recalcular mi línea). Un destino que no es una ruta interna
 * no navega, y un aviso sin destino sólo se marca leído.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Avisos from '../app/(app)/(tabs)/avisos';
import * as notificationsApi from '../src/api/endpoints/notifications';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/avisos' }));

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const pintar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Avisos />
    </SafeAreaProvider>,
  );
jest.mock('../src/session/session', () => ({ useSession: () => ({ customerId: '53' }) }));
jest.mock('../src/features/al-volver', () => ({ useAlVolver: () => undefined }));
jest.mock('../src/features/use-contenido-remoto', () => ({ useCopy: () => ({ texto: () => '' }) }));
jest.mock('../src/api/endpoints/notifications', () => ({
  listNotifications: jest.fn(),
  markRead: jest.fn(async () => ({})),
  markAllRead: jest.fn(async () => ({})),
}));

const aviso = (id: string, title: string, payload: Record<string, unknown> | null) => ({
  id,
  title,
  body: null,
  subject: null,
  channel: 'in_app',
  status: 'delivered',
  category: 'credit',
  icon: null,
  priority: null,
  readAt: null,
  createdAt: new Date().toISOString(),
  payload,
});

beforeEach(() => {
  mockPush.mockClear();
  (notificationsApi.markRead as jest.Mock).mockClear();
  (notificationsApi.listNotifications as jest.Mock).mockResolvedValue([
    aviso('1', 'Tu capacidad fue actualizada', { deepLink: '/' }),
    aviso('2', 'No pudimos usar tu extracto', { deepLink: '/extracto-bancario' }),
    aviso('3', 'Enlace ajeno', { deepLink: 'https://evil.example/login' }),
    aviso('4', 'Aviso sin destino', null),
  ]);
});

describe('Avisos · cada aviso abre su pantalla', () => {
  it('tocar un aviso con destino navega allí y lo marca leído', async () => {
    await pintar();
    await fireEvent.press(await screen.findByLabelText('No pudimos usar tu extracto'));
    expect(mockPush).toHaveBeenCalledWith('/extracto-bancario');
    expect(notificationsApi.markRead).toHaveBeenCalledWith('53', '2');
  });

  it('un enlace que no es una ruta interna no navega; sin destino, sólo se marca leído', async () => {
    await pintar();
    await fireEvent.press(await screen.findByLabelText('Enlace ajeno'));
    await fireEvent.press(screen.getByLabelText('Aviso sin destino'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(notificationsApi.markRead).toHaveBeenCalledWith('53', '4');
  });

  it('sólo los avisos con destino anuncian que abren algo', async () => {
    await pintar();
    expect((await screen.findByLabelText('Tu capacidad fue actualizada')).props.accessibilityHint).toBe('Abre la pantalla del aviso');
    expect(screen.getByLabelText('Aviso sin destino').props.accessibilityHint).toBeUndefined();
  });
});
