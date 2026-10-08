import { sondeo, avisarFalloDeRed, avisarRespuesta, escucharConexion, haySinConexion, reiniciarConexion, ESPERA_SONDEO_MS } from '../src/api/conexion';

/** Pablo (2026-10-08): sin internet, el logo de Atlas girando; y que se vaya solo cuando vuelve. */
describe('estado de conexión', () => {
  beforeEach(() => {
    sondeo.activo = true;
    reiniciarConexion();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    sondeo.activo = false;
  });

  const sinRed = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  const conRed = jest.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;

  it('un fallo de red sólo se anuncia si el sondeo confirma que no hay conexión', async () => {
    avisarFalloDeRed(conRed);
    await Promise.resolve();
    await Promise.resolve();
    expect(haySinConexion()).toBe(false);
  });

  it('sin red lo anuncia, sigue probando, y al volver la red lo quita solo', async () => {
    const cambios: boolean[] = [];
    escucharConexion((v) => cambios.push(v));
    const fetcher = jest.fn(sinRed);
    avisarFalloDeRed(fetcher as unknown as typeof fetch);
    await jest.advanceTimersByTimeAsync(0);
    expect(haySinConexion()).toBe(true);

    await jest.advanceTimersByTimeAsync(ESPERA_SONDEO_MS);
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2);

    avisarRespuesta();
    expect(haySinConexion()).toBe(false);
    expect(cambios).toEqual([true, false]);
  });
});
