import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AtlasApiError } from '../src/api/errors';
import * as authApi from '../src/api/endpoints/auth';
import { ConfirmarPinSheet } from '../src/ui/confirmar-pin-sheet';

/**
 * Volver a pedir el PIN: con el cuarto dígito se comprueba solo; un PIN malo se dice y vacía las
 * casillas; el límite de intentos se explica; la sesión no se toca.
 */
jest.mock('../src/api/endpoints/auth', () => ({ verifyPin: jest.fn() }));
const verifyPin = authApi.verifyPin as jest.Mock;

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = (props: { onVerificado?: () => void; onClose?: () => void } = {}) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ConfirmarPinSheet visible onClose={props.onClose ?? jest.fn()} onVerificado={props.onVerificado ?? jest.fn()} />
    </SafeAreaProvider>,
  );
const escribir = (pin: string) => fireEvent.changeText(screen.getByLabelText('PIN'), pin);

beforeEach(() => jest.clearAllMocks());

it('con el cuarto dígito comprueba el PIN y avisa UNA vez', async () => {
  verifyPin.mockResolvedValue({ verified: true, verifiedAt: '2026-10-03T10:00:00Z' });
  const onVerificado = jest.fn();
  await montar({ onVerificado });
  await escribir('4821');
  await waitFor(() => expect(onVerificado).toHaveBeenCalledTimes(1));
  expect(verifyPin).toHaveBeenCalledWith('4821');
});

it('con menos de cuatro dígitos no comprueba nada', async () => {
  await montar();
  await escribir('482');
  expect(verifyPin).not.toHaveBeenCalled();
});

it('un PIN incorrecto lo dice, no avisa y deja las casillas para reescribir', async () => {
  verifyPin.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'PIN_INCORRECT', message: 'El PIN no es correcto.', status: 400 }));
  const onVerificado = jest.fn();
  await montar({ onVerificado });
  await escribir('0000');
  await waitFor(() => expect(screen.getAllByText('PIN incorrecto.').length).toBeGreaterThan(0));
  expect(onVerificado).not.toHaveBeenCalled();
  await act(async () => undefined);
  verifyPin.mockResolvedValue({ verified: true, verifiedAt: 'x' });
  await escribir('1111');
  await waitFor(() => expect(onVerificado).toHaveBeenCalledTimes(1));
});

it('el límite de intentos (429) se explica con otras palabras', async () => {
  verifyPin.mockRejectedValue(new AtlasApiError({ kind: 'rate_limited', code: 'THROTTLED', message: 'x', status: 429 }));
  await montar();
  await escribir('0000');
  await waitFor(() => expect(screen.getAllByText(/Espera un minuto/).length).toBeGreaterThan(0));
});

it('sin conexión no dice que el PIN está mal', async () => {
  verifyPin.mockRejectedValue(new AtlasApiError({ kind: 'network', code: 'NET', message: 'x' }));
  await montar();
  await escribir('4821');
  await waitFor(() => expect(screen.getAllByText(/Sin conexión/).length).toBeGreaterThan(0));
  expect(screen.queryByText('PIN incorrecto.')).toBeNull();
});

it('Cancelar cierra la hoja', async () => {
  const onClose = jest.fn();
  await montar({ onClose });
  await fireEvent.press(screen.getAllByRole('button', { name: 'Cancelar' })[0]!);
  expect(onClose).toHaveBeenCalled();
});
