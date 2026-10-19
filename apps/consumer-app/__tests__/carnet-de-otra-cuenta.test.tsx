import { act, renderHook } from '@testing-library/react-native';
import { AtlasApiError, describeError } from '../src/api/errors';
import * as onboardingApi from '../src/api/endpoints/onboarding';
import {
  CODIGO_ALTA_BLOQUEADA,
  ESPERA_DE_LA_CONSULTA_MS,
  esAltaBloqueada,
  useCarnetDeOtraCuenta,
} from '../src/features/carnet-de-otra-cuenta';

jest.mock('../src/api/endpoints/onboarding');

const bloqueo = () =>
  new AtlasApiError({
    kind: 'permission',
    code: CODIGO_ALTA_BLOQUEADA,
    message: CODIGO_ALTA_BLOQUEADA,
    status: 403,
  });
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
    const { rerender } = await renderHook(({ numero }: { numero: string }) => useCarnetDeOtraCuenta('10', numero, 5), { initialProps: { numero: '84521' } });
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

  it('si el servidor bloquea la conexión, la pantalla se queda con el bloqueo', async () => {
    consulta.mockRejectedValue(bloqueo());
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', '8452136', 5));
    await pasarLaEspera();
    expect(result.current.bloqueo).not.toBeNull();
    expect(esAltaBloqueada(result.current.bloqueo)).toBe(true);
  });

  it('un fallo de red en la consulta no bloquea: lo decide el envío', async () => {
    consulta.mockRejectedValue(
      new AtlasApiError({
        kind: 'network',
        code: 'NETWORK_ERROR',
        message: 'x',
      }),
    );
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', '8452136', 5));
    await pasarLaEspera();
    expect(result.current.bloqueo).toBeNull();
  });

  it('el envío también puede descubrir el bloqueo', async () => {
    const { result } = await renderHook(() => useCarnetDeOtraCuenta('10', '', 5));
    await act(async () => result.current.alFallarElEnvio(new Error('otro')));
    expect(result.current.bloqueo).toBeNull();
    await act(async () => result.current.alFallarElEnvio(bloqueo()));
    expect(result.current.bloqueo).not.toBeNull();
  });

  it('el mensaje dice que no se puede seguir y NO confirma que el carnet exista', () => {
    const texto = describeError(bloqueo());
    expect(texto.title).toBe('No podemos continuar');
    expect(texto.detail).toMatch(/desde esta conexión/);
    expect(`${texto.title} ${texto.detail}`).not.toMatch(/carnet|cédula|registrad/i);
    expect(texto.canRetry).toBe(false);
  });
});
