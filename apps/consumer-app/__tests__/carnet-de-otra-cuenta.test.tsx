import { act, renderHook } from '@testing-library/react-native';
import { AtlasApiError, describeError } from '../src/api/errors';
import * as onboardingApi from '../src/api/endpoints/onboarding';
import {
  CODIGO_ALTA_BLOQUEADA,
  CODIGO_CARNET_REGISTRADO,
  ESPERA_DE_LA_CONSULTA_MS,
  esAltaBloqueada,
  esCarnetRegistrado,
  useCarnetDeOtraCuenta,
} from '../src/features/carnet-de-otra-cuenta';

jest.mock('../src/api/endpoints/onboarding');

const error = (code: string, status: number, kind: 'permission' | 'conflict') => new AtlasApiError({ kind, code, message: code, status });
const bloqueo = () => error(CODIGO_ALTA_BLOQUEADA, 403, 'permission');
const yaRegistrado = () => error(CODIGO_CARNET_REGISTRADO, 409, 'conflict');
const consulta = onboardingApi.checkIdentityDocument as jest.Mock;

describe('carnet que ya es de otra cuenta', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    consulta.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  const pasarLaEspera = async () => {
    await act(async () => {
      jest.advanceTimersByTime(ESPERA_DE_LA_CONSULTA_MS + 1);
    });
  };

  it('consulta el número una vez terminado de teclear, no por cada dígito', async () => {
    consulta.mockResolvedValue({ available: true });
    const { rerender } = await renderHook(({ numero }: { numero: string }) => useCarnetDeOtraCuenta('10', numero, 5), {
      initialProps: { numero: '84521' },
    });
    await rerender({ numero: '845213' });
    await rerender({ numero: '8452136' });
    await pasarLaEspera();
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith('10', '8452136');
  });

  it('no consulta con menos dígitos que el mínimo ni sin cliente', async () => {
    await renderHook(() => useCarnetDeOtraCuenta('10', '1234', 5));
    await renderHook(() => useCarnetDeOtraCuenta(null, '8452136', 5));
    await pasarLaEspera();
    expect(consulta).not.toHaveBeenCalled();
  });

  it('un carnet ya registrado AVISA sin bloquear, y el aviso se va al corregir el número', async () => {
    consulta.mockRejectedValue(yaRegistrado());
    const { result, rerender } = await renderHook(({ numero }: { numero: string }) => useCarnetDeOtraCuenta('10', numero, 5), {
      initialProps: { numero: '8452136' },
    });
    await pasarLaEspera();
    expect(esCarnetRegistrado(result.current.avisoDelCarnet)).toBe(true);
    expect(result.current.bloqueo).toBeNull();
    await rerender({ numero: '8452137' });
    expect(result.current.avisoDelCarnet).toBeNull();
  });

  it('al reincidir el servidor bloquea y la pantalla se queda con el bloqueo', async () => {
    consulta.mockRejectedValue(bloqueo());
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', '8452136', 5));
    await pasarLaEspera();
    expect(esAltaBloqueada(result.current.bloqueo)).toBe(true);
    expect(result.current.avisoDelCarnet).toBeNull();
  });

  it('un fallo de red en la consulta no avisa ni bloquea: lo decide el envío', async () => {
    consulta.mockRejectedValue(new AtlasApiError({ kind: 'network', code: 'NETWORK_ERROR', message: 'x' }));
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', '8452136', 5));
    await pasarLaEspera();
    expect(result.current.bloqueo).toBeNull();
    expect(result.current.avisoDelCarnet).toBeNull();
  });

  it('el envío también puede descubrir el aviso o el bloqueo, y ignora otros errores', async () => {
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', ' 8452136 ', 5));
    await act(async () => result.current.alFallarElEnvio(new Error('otro')));
    expect(result.current.bloqueo).toBeNull();
    expect(result.current.avisoDelCarnet).toBeNull();
    await act(async () => result.current.alFallarElEnvio(yaRegistrado()));
    expect(esCarnetRegistrado(result.current.avisoDelCarnet)).toBe(true);
    await act(async () => result.current.alFallarElEnvio(bloqueo()));
    expect(esAltaBloqueada(result.current.bloqueo)).toBe(true);
  });

  it('el aviso de carnet registrado dice qué hacer, y el bloqueo no confirma que el carnet exista', () => {
    const aviso = describeError(yaRegistrado());
    expect(aviso.title).toBe('Ese carnet ya tiene cuenta');
    expect(aviso.detail).toMatch(/ingresa con tu cuenta/i);
    const bloqueado = describeError(bloqueo());
    expect(bloqueado.title).toBe('No podemos continuar');
    expect(bloqueado.detail).toMatch(/desde esta conexión/);
    expect(`${bloqueado.title} ${bloqueado.detail}`).not.toMatch(/carnet|cédula|registrad/i);
    expect(bloqueado.canRetry).toBe(false);
  });
});
