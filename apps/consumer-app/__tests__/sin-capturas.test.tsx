/**
 * APP-18: el PIN, el carnet y los extractos no se dejan capturar ni grabar.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useSinCapturas } from '../src/device/sin-capturas';

jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));
const prevenir = ScreenCapture.preventScreenCaptureAsync as jest.Mock;
const permitir = ScreenCapture.allowScreenCaptureAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

it('bloquea al montarse con su propia clave y lo devuelve al desmontarse', async () => {
  const { unmount } = await renderHook(() => useSinCapturas('pin-ingreso'));
  expect(prevenir).toHaveBeenCalledWith('atlas:pin-ingreso');
  expect(permitir).not.toHaveBeenCalled();
  await unmount();
  expect(permitir).toHaveBeenCalledWith('atlas:pin-ingreso');
});

it('una hoja cerrada no bloquea; al abrirse si', async () => {
  const { rerender } = await renderHook(({ visible }: { visible: boolean }) => useSinCapturas('confirmar-pin', visible), {
    initialProps: { visible: false },
  });
  expect(prevenir).not.toHaveBeenCalled();
  await rerender({ visible: true });
  expect(prevenir).toHaveBeenCalledWith('atlas:confirmar-pin');
  await rerender({ visible: false });
  expect(permitir).toHaveBeenCalledWith('atlas:confirmar-pin');
});

it('un fallo del modulo nativo no rompe la pantalla', async () => {
  prevenir.mockRejectedValueOnce(new Error('sin modulo'));
  await expect(renderHook(() => useSinCapturas('x'))).resolves.toBeTruthy();
});

describe('las pantallas sensibles lo usan', () => {
  const SENSIBLES = [
    'app/(auth)/ingresar.tsx',
    'app/(auth)/recuperar.tsx',
    'app/(app)/cambiar-pin.tsx',
    'app/(onboarding)/registro.tsx',
    'app/(onboarding)/identidad.tsx',
    'app/(onboarding)/extracto.tsx',
    'app/(app)/extracto-bancario.tsx',
    'app/(app)/extracto-credito.tsx',
    'app/(app)/mis-datos.tsx',
    'src/ui/confirmar-pin-sheet.tsx',
    'src/ui/bloqueo-local.tsx',
  ];
  it.each(SENSIBLES)('%s', (ruta) => {
    expect(readFileSync(join(__dirname, '..', ruta), 'utf8')).toMatch(/useSinCapturas\('[a-z-]+'/);
  });
});
