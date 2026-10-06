import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, Text } from 'react-native';

/**
 * El reclamo: «el bot se buguea y se cierra solo». Al tocar el campo para escribir aparecía el teclado,
 * `AssistFab` devolvía `null` para esconder el botón y, con él, desmontaba la hoja del chat abierta.
 */
const mockTour = { activo: false };
const mockAssist: { disponible: boolean | null } = { disponible: true };
jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/features/assist', () => ({ useAssist: () => mockAssist }));
jest.mock('../src/ui/tour', () => ({ useTour: () => mockTour }));
jest.mock('../src/ui/responsive', () => ({ ...jest.requireActual('../src/ui/responsive'), useTramo: () => 'telefono' }));
jest.mock('../src/ui/assist-sheet', () => ({
  AssistSheet: ({ visible }: { visible: boolean }) => {
    const { Text: T } = jest.requireActual('react-native');
    return visible ? <T testID="hoja-asistente">chat</T> : null;
  },
}));

const oyentes: Record<string, () => void> = {};
beforeEach(() => {
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evento: string, cb: () => void) => {
    oyentes[evento] = cb;
    return { remove: jest.fn() };
  }) as never);
  mockTour.activo = false;
  mockAssist.disponible = true;
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AssistFab } = require('../src/ui/assist-fab') as typeof import('../src/ui/assist-fab');

const mostrarTeclado = () =>
  act(() => {
    (oyentes.keyboardWillShow ?? oyentes.keyboardDidShow)?.();
  });

test('con la hoja abierta, aparecer el teclado NO cierra el chat', async () => {
  await render(<AssistFab />);
  await fireEvent.press(screen.getByTestId('asistente-fab'));
  expect(screen.getByTestId('hoja-asistente')).toBeTruthy();
  await mostrarTeclado();
  expect(screen.getByTestId('hoja-asistente')).toBeTruthy();
  expect(screen.queryByTestId('asistente-fab')).toBeNull();
});

test('con la hoja cerrada, el teclado sólo esconde el botón', async () => {
  await render(<AssistFab />);
  await mostrarTeclado();
  expect(screen.queryByTestId('asistente-fab')).toBeNull();
  expect(screen.queryByTestId('hoja-asistente')).toBeNull();
});

test('si el sondeo del asistente parpadea con la hoja abierta, la conversación sigue', async () => {
  const { rerender } = await render(<AssistFab />);
  await fireEvent.press(screen.getByTestId('asistente-fab'));
  mockAssist.disponible = null;
  await rerender(<AssistFab />);
  expect(screen.getByTestId('hoja-asistente')).toBeTruthy();
});

test('sin asistente en el despliegue no hay botón', async () => {
  mockAssist.disponible = false;
  await render(<AssistFab />);
  expect(screen.queryByTestId('asistente-fab')).toBeNull();
  void Text;
});
