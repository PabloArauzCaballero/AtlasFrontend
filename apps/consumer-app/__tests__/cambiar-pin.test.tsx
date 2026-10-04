import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as authApi from '../src/api/endpoints/auth';
import { AtlasApiError } from '../src/api/errors';
import { SEGUNDOS_ENTRE_ENVIOS, textoDeReenvio } from '../src/features/cambiar-pin-reenvio';
import ChangePin from '../app/(app)/cambiar-pin';

/**
 * Cambiar el PIN. El hueco que se cierra: «nunca manda el correo». El correo SÍ salía, pero la pantalla no decía a dónde,
 * no dejaba reenviar ni volver, y al terminar dejaba al cliente en una sesión que el servidor ya había cerrado.
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn(async () => undefined);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  usePathname: () => '/cambiar-pin',
}));
jest.mock('../src/session/session', () => ({ useSession: () => ({ signOut: mockSignOut }) }));
jest.mock('../src/api/endpoints/auth', () => ({ requestPinChange: jest.fn(), confirmPinChange: jest.fn() }));
const requestPinChange = authApi.requestPinChange as jest.Mock;
const confirmPinChange = authApi.confirmPinChange as jest.Mock;

const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ChangePin />
    </SafeAreaProvider>,
  );

const DESAFIO = { pinChallengeRequired: true, challengeToken: 'tok-1', expiresInMinutes: 10, deliveredTo: 'pa***@gmail.com' };

/** Paso 1 → paso 2: escribe el PIN actual y pide el código. */
async function pedirCodigo() {
  await montar();
  await fireEvent.changeText(screen.getByLabelText('Tu PIN actual'), '4821');
  await fireEvent.press(screen.getByRole('button', { name: /Enviarme el código/ }));
  await waitFor(() => expect(screen.getByTestId('codigo-enviado')).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  requestPinChange.mockResolvedValue(DESAFIO);
});
afterEach(() => jest.useRealTimers());

describe('paso 1: pedir el código', () => {
  it('con menos de 4 dígitos no se puede enviar y dice por qué', async () => {
    await montar();
    await fireEvent.changeText(screen.getByLabelText('Tu PIN actual'), '48');
    expect(screen.getByRole('button', { name: /Enviarme el código/ }).props.accessibilityState.disabled).toBe(true);
    expect(requestPinChange).not.toHaveBeenCalled();
  });

  it('con el PIN actual pide el código al servidor y pasa al paso 2', async () => {
    await pedirCodigo();
    expect(requestPinChange).toHaveBeenCalledWith('4821');
    expect(screen.getByText(/Paso 2 de 2/)).toBeTruthy();
  });

  it('un PIN actual incorrecto se dice y NO avanza al paso 2', async () => {
    requestPinChange.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'BAD_REQUEST', message: 'La contraseña actual no es correcta.', status: 400 }));
    await montar();
    await fireEvent.changeText(screen.getByLabelText('Tu PIN actual'), '0000');
    await fireEvent.press(screen.getByRole('button', { name: /Enviarme el código/ }));
    await waitFor(() => expect(screen.getByText(/Paso 1 de 2/)).toBeTruthy());
    expect(screen.queryByTestId('codigo-enviado')).toBeNull();
  });

  it('sin canal de correo (503) lo dice y no finge que mandó nada', async () => {
    requestPinChange.mockRejectedValue(new AtlasApiError({ kind: 'server', code: 'SERVICE_UNAVAILABLE', message: 'x', status: 503 }));
    await montar();
    await fireEvent.changeText(screen.getByLabelText('Tu PIN actual'), '4821');
    await fireEvent.press(screen.getByRole('button', { name: /Enviarme el código/ }));
    await waitFor(() => expect(screen.getByText(/Paso 1 de 2/)).toBeTruthy());
    expect(screen.queryByTestId('codigo-enviado')).toBeNull();
  });
});

describe('paso 2: dice a dónde fue el código', () => {
  it('enseña el correo ENMASCARADO al que se mandó', async () => {
    await pedirCodigo();
    expect(screen.getByTestId('codigo-destino').props.children).toBe('Te enviamos un código de 6 dígitos a pa***@gmail.com');
  });

  it('dice cuánto vale el código y dónde mirar si no llega', async () => {
    await pedirCodigo();
    expect(screen.getByText(/Vence en 10 minutos/)).toBeTruthy();
    expect(screen.getByText(/Spam o Promociones/)).toBeTruthy();
  });

  it('con un backend que no manda la dirección, no inventa una: dice «tu correo registrado»', async () => {
    requestPinChange.mockResolvedValue({ ...DESAFIO, deliveredTo: undefined });
    await pedirCodigo();
    expect(screen.getByTestId('codigo-destino').props.children).toBe('Te enviamos un código de 6 dígitos a tu correo registrado');
  });

  it('«Ese no es mi correo» lleva a Soporte', async () => {
    await pedirCodigo();
    await fireEvent.press(screen.getByRole('button', { name: /Ese no es mi correo/ }));
    expect(mockPush).toHaveBeenCalledWith('/(app)/soporte');
  });

  it('se puede volver al paso 1 para corregir el PIN actual', async () => {
    await pedirCodigo();
    await fireEvent.press(screen.getByRole('button', { name: /Cambiar el PIN actual/ }));
    expect(screen.getByText(/Paso 1 de 2/)).toBeTruthy();
  });
});

describe('reenvío del código', () => {
  it('el texto cuenta hacia atrás y al llegar a cero ofrece reenviar', () => {
    expect(SEGUNDOS_ENTRE_ENVIOS).toBe(60);
    expect(textoDeReenvio(42)).toBe('Reenviar código en 42 s');
    expect(textoDeReenvio(0)).toBe('Reenviar el código');
  });

  it('recién enviado, el reenvío está bloqueado con la cuenta atrás de 60 s (la misma espera del servidor)', async () => {
    await pedirCodigo();
    const boton = screen.getByRole('button', { name: /Reenviar código en 60 s/ });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it('pasados los 60 s se puede reenviar, y cada reenvío pide un desafío NUEVO', async () => {
    jest.useFakeTimers();
    await pedirCodigo();
    requestPinChange.mockResolvedValue({ ...DESAFIO, challengeToken: 'tok-2' });
    for (let i = 0; i < SEGUNDOS_ENTRE_ENVIOS; i += 1) await act(async () => void jest.advanceTimersByTime(1000));
    const boton = screen.getByRole('button', { name: /Reenviar el código/ });
    expect(boton.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(boton);
    await waitFor(() => expect(requestPinChange).toHaveBeenCalledTimes(2));
    // Tras reenviar vuelve a empezar la espera.
    await waitFor(() => expect(screen.getByRole('button', { name: /Reenviar código en 60 s/ })).toBeTruthy());
  });
});

describe('guardar el PIN nuevo', () => {
  async function llegarAlPaso2ConDatos(pinNuevo = '7391', codigo = '123456') {
    await pedirCodigo();
    await fireEvent.changeText(screen.getByLabelText('Código de 6 dígitos'), codigo);
    await fireEvent.changeText(screen.getByLabelText('Tu PIN nuevo'), pinNuevo);
  }

  it('manda el desafío, el código y el PIN nuevo', async () => {
    confirmPinChange.mockResolvedValue({ updated: true });
    await llegarAlPaso2ConDatos();
    await fireEvent.press(screen.getByRole('button', { name: /Guardar mi PIN nuevo/ }));
    await waitFor(() => expect(confirmPinChange).toHaveBeenCalledWith({ challengeToken: 'tok-1', code: '123456', newPassword: '7391' }));
  });

  it('no deja guardar el mismo PIN de antes', async () => {
    await llegarAlPaso2ConDatos('4821');
    expect(screen.getByRole('button', { name: /Guardar mi PIN nuevo/ }).props.accessibilityState.disabled).toBe(true);
    expect(confirmPinChange).not.toHaveBeenCalled();
  });

  it('un código incorrecto se dice y se queda en el paso 2 para reintentar', async () => {
    confirmPinChange.mockRejectedValue(new AtlasApiError({ kind: 'validation', code: 'BAD_REQUEST', message: 'Código inválido o expirado.', status: 400 }));
    await llegarAlPaso2ConDatos();
    await fireEvent.press(screen.getByRole('button', { name: /Guardar mi PIN nuevo/ }));
    await waitFor(() => expect(confirmPinChange).toHaveBeenCalled());
    expect(screen.getByText(/Paso 2 de 2/)).toBeTruthy();
    expect(screen.queryByText('PIN actualizado')).toBeNull();
  });

  it('al terminar DICE que cierra todas las sesiones, también ésta, y lleva a entrar con el PIN nuevo', async () => {
    confirmPinChange.mockResolvedValue({ updated: true });
    await llegarAlPaso2ConDatos();
    await fireEvent.press(screen.getByRole('button', { name: /Guardar mi PIN nuevo/ }));
    await waitFor(() => expect(screen.getByText('PIN actualizado')).toBeTruthy());
    expect(screen.getByText(/cerramos todas tus sesiones, también ésta/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Entrar con mi PIN nuevo/ }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/ingresar');
  });

  it('el éxito no ofrece «volver al perfil»: la sesión ya no existe', async () => {
    confirmPinChange.mockResolvedValue({ updated: true });
    await llegarAlPaso2ConDatos();
    await fireEvent.press(screen.getByRole('button', { name: /Guardar mi PIN nuevo/ }));
    await waitFor(() => expect(screen.getByText('PIN actualizado')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Volver a mi perfil/ })).toBeNull();
  });
});
