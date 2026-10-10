import { render } from '@testing-library/react-native';
import AppLayout from '../app/(app)/_layout';

/**
 * «Para hacer logout tenés que cerrar la app» (Pablo, 2026-10-09).
 *
 * Sin sesión, la guarda del área autenticada redirigía a «/». Ese «/» es AMBIGUO: lo son la puerta de entrada y la
 * pestaña Inicio. Desde dentro del área el router lo resolvía a Inicio, que volvía a montar esta guarda: un bucle de
 * redirecciones (error 185 de React, «Maximum update depth exceeded») que dejaba la app colgada en la portada. Reproducido en
 * la web con Playwright (`e2e-web/sesion-y-refresco.mjs`). La guarda va ahora DIRECTO a la pantalla de entrada.
 */
const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children?: React.ReactNode }) => children ?? null;
  Stack.displayName = 'Stack';
  const Screen = () => null;
  Screen.displayName = 'Stack.Screen';
  Stack.Screen = Screen;
  return { Redirect: (props: { href: string }) => mockRedirect(props), Stack };
});
const mockSesion: { status: string; customerId: string | null; onboarding: unknown; me: unknown } = {
  status: 'anonymous',
  customerId: null,
  onboarding: null,
  me: null,
};
jest.mock('../src/session/session', () => ({
  useSession: () => mockSesion,
  // La misma regla que `areaFor` (importar la sesión de verdad arrastra módulos nativos).
  areaFor: (s: typeof mockSesion) =>
    s.status !== 'authenticated' || !s.customerId
      ? 'auth'
      : (s.onboarding as { lifecycleStatus?: string } | null)?.lifecycleStatus === 'active'
        ? 'app'
        : 'onboarding',
}));
jest.mock('../src/ui/assist-fab', () => ({ AssistFab: () => null }));
jest.mock('../src/ui/celebraciones-host', () => ({ CelebracionesHost: () => null }));
jest.mock('../src/web/Cascara', () => ({ BarraSuperior: () => null }));

beforeEach(() => mockRedirect.mockClear());

it('sin sesión (salir, tope de 8 h, 401 SESSION_EXPIRED) lleva a la pantalla de entrada, nunca a «/»', async () => {
  await render(<AppLayout />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/(auth)/ingresar' });
  expect(mockRedirect).not.toHaveBeenCalledWith({ href: '/' });
});

it('con el alta a medias sigue llevando al alta', async () => {
  Object.assign(mockSesion, { status: 'authenticated', customerId: '1', onboarding: { lifecycleStatus: 'registered' } });
  await render(<AppLayout />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/(onboarding)/progreso' });
  Object.assign(mockSesion, { status: 'anonymous', customerId: null, onboarding: null });
});
