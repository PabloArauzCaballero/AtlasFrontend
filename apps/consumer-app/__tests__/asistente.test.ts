/**
 * El hilo con Atlas Assist, del lado de la app.
 *
 * Las propiedades que fijan estas pruebas son las que hacen que el asistente sea barato y honesto:
 *
 * 1. **El 404 esconde el boton entero.** Apagado en el servidor no es un error: es «este
 *    despliegue no tiene asistente», y un boton que abre una hoja rota es peor que ningun boton.
 * 2. **El reintento viaja con la MISMA clave.** Manual o por el 409 de «sigue en curso», recoge la
 *    respuesta que el servidor ya guardo; jamas genera una segunda llamada facturada.
 * 3. **El fallo conserva lo que la persona escribio.** La burbuja propia queda y el reintento la
 *    reenvia; perder un mensaje tecleado por una señal mala es perder la confianza.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AtlasApiError } from '../src/api/errors';
import * as assistApi from '../src/api/endpoints/assist';
import { useAssist } from '../src/features/assist';

// Sin esto React cree que no hay entorno de act() y descarta las actualizaciones de estado.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/endpoints/assist', () => ({
  preguntar: jest.fn(),
  conversacion: jest.fn(),
}));

// SIN mock de la clave: la prueba tiene que ver la que viaja de verdad. Con `clave-N` mockeada la
// suite estuvo verde mientras el iPhone mandaba `atlas-…` y el backend devolvía 400 (2026-10-02).
// `expo-crypto` en jest es un doble nativo sin `randomUUID`; se le da el UUID v4 real de Node.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const preguntar = assistApi.preguntar as jest.Mock;
const conversacion = assistApi.conversacion as jest.Mock;

const RESPUESTA = {
  reply: 'Entra a «Pagos» y toca la cuota.',
  suggestHandoff: false,
  conversationId: 'conv-1',
  turnId: 'turno-1',
};

function apagado(): AtlasApiError {
  return new AtlasApiError({ kind: 'not_found', code: 'ASSIST_DISABLED', message: 'no', status: 404 });
}

beforeEach(() => {
  jest.clearAllMocks();
  conversacion.mockResolvedValue({ conversationId: null, turns: [] });
});

describe('useAssist', () => {
  it('rehidrata el hilo guardado: cada turno son dos burbujas en orden', async () => {
    conversacion.mockResolvedValue({
      conversationId: 'conv-1',
      turns: [{ turnId: 't1', prompt: '¿Como pago?', reply: 'Desde «Pagos».', suggestHandoff: false, createdAt: '2026-09-25' }],
    });

    const { result } = await renderHook(() => useAssist());

    await waitFor(() => expect(result.current.disponible).toBe(true));
    expect(result.current.burbujas).toEqual([
      { id: 't1-p', rol: 'persona', texto: '¿Como pago?' },
      { id: 't1', rol: 'asistente', texto: 'Desde «Pagos».', sugiereHumano: false },
    ]);
  });

  it('el 404 de la sonda esconde el boton entero', async () => {
    conversacion.mockRejectedValue(apagado());

    const { result } = await renderHook(() => useAssist());

    await waitFor(() => expect(result.current.disponible).toBe(false));
  });

  it('un historial ilegible NO esconde el boton: preguntar hoy no depende de leer lo de ayer', async () => {
    conversacion.mockRejectedValue(new AtlasApiError({ kind: 'server', code: 'X', message: 'x', status: 500 }));

    const { result } = await renderHook(() => useAssist());

    await waitFor(() => expect(result.current.disponible).toBe(true));
    expect(result.current.burbujas).toEqual([]);
  });

  it('enviar pinta la burbuja propia al instante y la respuesta al llegar', async () => {
    preguntar.mockResolvedValue(RESPUESTA);
    const { result } = await renderHook(() => useAssist());
    await waitFor(() => expect(result.current.disponible).toBe(true));

    await act(async () => result.current.enviar('¿Como pago una cuota?', 'pagos'));

    await waitFor(() => expect(result.current.estado.fase).toBe('lista'));
    // La pregunta primero y la respuesta despues: el hilo se lee como se vivio.
    expect(result.current.burbujas.at(-2)).toMatchObject({ rol: 'persona', texto: '¿Como pago una cuota?' });
    expect(result.current.burbujas.at(-1)).toMatchObject({ rol: 'asistente', texto: RESPUESTA.reply });
    expect(preguntar).toHaveBeenCalledWith({ prompt: '¿Como pago una cuota?', clientMessageId: expect.stringMatching(UUID_V4), screen: 'pagos' });
  });

  it('el fallo conserva el mensaje y el reintento viaja con la MISMA clave', async () => {
    preguntar.mockRejectedValueOnce(new AtlasApiError({ kind: 'network', code: 'NET', message: 'x' }));
    preguntar.mockResolvedValueOnce(RESPUESTA);
    const { result } = await renderHook(() => useAssist());
    await waitFor(() => expect(result.current.disponible).toBe(true));

    await act(async () => result.current.enviar('hola', 'inicio'));
    await waitFor(() => expect(result.current.estado.fase).toBe('error'));
    expect(result.current.estado).toMatchObject({ mensaje: expect.stringContaining('Sin conexión') });
    // La burbuja propia sigue en pantalla: nada se perdio.
    expect(result.current.burbujas.at(-1)).toMatchObject({ rol: 'persona', texto: 'hola' });

    await act(async () => result.current.reintentar('inicio'));
    await waitFor(() => expect(result.current.estado.fase).toBe('lista'));

    const claves = preguntar.mock.calls.map(([entrada]) => (entrada as { clientMessageId: string }).clientMessageId);
    expect(claves).toHaveLength(2);
    expect(claves[0]).toMatch(UUID_V4);
    expect(claves[1]).toBe(claves[0]);
  });

  it('el 409 de «sigue en curso» se reintenta solo, con la misma clave, sin molestar a nadie', async () => {
    jest.useFakeTimers();
    try {
      preguntar.mockRejectedValueOnce(new AtlasApiError({ kind: 'conflict', code: 'ASSIST_IN_FLIGHT', message: 'en curso', status: 409 }));
      preguntar.mockResolvedValueOnce(RESPUESTA);
      const { result } = await renderHook(() => useAssist());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.disponible).toBe(true);

      await act(async () => result.current.enviar('hola', 'inicio'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.estado.fase).toBe('enviando');

      await act(async () => {
        jest.advanceTimersByTime(2_000);
        await Promise.resolve();
      });

      expect(result.current.estado.fase).toBe('lista');
      const claves = preguntar.mock.calls.map(([entrada]) => (entrada as { clientMessageId: string }).clientMessageId);
      expect(claves).toHaveLength(2);
      expect(claves[0]).toMatch(UUID_V4);
      expect(claves[1]).toBe(claves[0]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('el 404 a mitad de conversacion tambien esconde el boton: el interruptor manda', async () => {
    preguntar.mockRejectedValue(apagado());
    const { result } = await renderHook(() => useAssist());
    await waitFor(() => expect(result.current.disponible).toBe(true));

    await act(async () => result.current.enviar('hola', 'inicio'));

    await waitFor(() => expect(result.current.disponible).toBe(false));
  });

  it('mientras hay una peticion en viaje no se envia nada mas; despues del error si', async () => {
    let resolver: (valor: typeof RESPUESTA) => void = () => undefined;
    preguntar.mockImplementationOnce(() => new Promise((res) => (resolver = res)));
    const { result } = await renderHook(() => useAssist());
    await waitFor(() => expect(result.current.disponible).toBe(true));

    await act(async () => result.current.enviar('primera', 'inicio'));
    await act(async () => result.current.enviar('segunda', 'inicio'));
    // La segunda no salio: una sola llamada y una sola burbuja propia.
    expect(preguntar).toHaveBeenCalledTimes(1);
    expect(result.current.burbujas).toHaveLength(1);

    await act(async () => {
      resolver(RESPUESTA);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.estado.fase).toBe('lista'));

    preguntar.mockResolvedValueOnce({ ...RESPUESTA, turnId: 'turno-2' });
    await act(async () => result.current.enviar('tercera', 'inicio'));
    await waitFor(() => expect(preguntar).toHaveBeenCalledTimes(2));
  });
});
