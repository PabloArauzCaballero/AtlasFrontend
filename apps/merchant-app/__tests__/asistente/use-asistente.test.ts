/**
 * `useAsistente` contra un `fetch` simulado: la sonda decide si el botón existe (404 = no), el hilo se
 * rehidrata, una pregunta fallida se reintenta con la MISMA llave, y el historial abre y borra sin
 * tocar el chat cuando falla.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { clearAccessToken, setAccessToken } from '@/api/client';
import { useAsistente } from '@/features/asistente/use-asistente';

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));

type Llamada = { url: string; init: RequestInit };

function respuesta(status: number, cuerpo?: unknown): Response {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  return new Response(texto, { status, headers: { 'content-type': 'application/json' } });
}
const ok = (data: unknown) => respuesta(200, { success: true, data });

let llamadas: Llamada[];
function simular(...respuestas: Response[]) {
  llamadas = [];
  const cola = [...respuestas];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    const siguiente = cola.shift();
    if (!siguiente) throw new Error('fetch sin respuesta preparada');
    return siguiente;
  }) as unknown as typeof fetch;
}
const cuerpoDe = (n: number) => JSON.parse(String(llamadas[n]!.init.body)) as Record<string, unknown>;

const TURNO = { turnId: 't-0', prompt: '¿Hola?', reply: 'Hola.', suggestHandoff: false, createdAt: '2026-10-10T00:00:00Z' };

beforeEach(() => {
  mockUuid = 0;
  clearAccessToken();
  setAccessToken('token-1');
});

test('con el asistente apagado (404) no está disponible', async () => {
  simular(respuesta(404, { success: false, error: { code: 'ASSIST_DISABLED', message: 'Apagado' } }));
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(false));
});

test('rehidrata el hilo vigente y sigue la conversación con su id y la sección', async () => {
  simular(
    ok({ conversationId: 'c-1', turns: [{ ...TURNO, mode: 'sin-ia', suggestHandoff: true }] }),
    ok({ reply: 'En Cartera.', suggestHandoff: false, conversationId: 'c-1', turnId: 't-1' }),
  );
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(true));
  expect(result.current.burbujas).toEqual([
    { id: 't-0-p', rol: 'persona', texto: '¿Hola?' },
    { id: 't-0', rol: 'asistente', texto: 'Hola.', sugiereHumano: true, sinIa: true },
  ]);
  expect(result.current.actualId).toBe('c-1');

  await act(async () => result.current.enviar('  ¿Dónde cobro?  ', 'Mi cartera'));
  await waitFor(() => expect(result.current.estado).toEqual({ fase: 'lista' }));

  expect(cuerpoDe(1)).toEqual({
    prompt: '¿Dónde cobro?',
    clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    conversationId: 'c-1',
    screen: 'Mi cartera',
  });
  expect(result.current.burbujas.map((b) => b.texto)).toEqual(['¿Hola?', 'Hola.', '¿Dónde cobro?', 'En Cartera.']);
});

test('una pregunta fallida se reintenta con la MISMA llave y no duplica la burbuja', async () => {
  simular(
    ok(null),
    respuesta(503, { success: false, error: { code: 'ASSIST_UNAVAILABLE', message: 'No disponible' } }),
    ok({ reply: 'Listo.', suggestHandoff: false, conversationId: 'c-9', turnId: null }),
  );
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(true));

  await act(async () => result.current.enviar('Hola', 'Gestión POS'));
  await waitFor(() => expect(result.current.estado.fase).toBe('error'));
  expect(result.current.estado).toEqual({ fase: 'error', mensaje: expect.stringMatching(/no está disponible/) });
  expect(result.current.disponible).toBe(true);

  const llave = cuerpoDe(1).clientMessageId;
  await act(async () => result.current.reintentar('Gestión POS'));
  await waitFor(() => expect(result.current.estado).toEqual({ fase: 'lista' }));

  expect(cuerpoDe(2).clientMessageId).toBe(llave);
  expect(result.current.burbujas).toEqual([
    { id: `local-${llave}`, rol: 'persona', texto: 'Hola' },
    { id: `local-r-${llave}`, rol: 'asistente', texto: 'Listo.', sugiereHumano: false, sinIa: false },
  ]);
  expect(result.current.actualId).toBe('c-9');
});

test('si se apaga a mitad de conversación, deja de estar disponible', async () => {
  simular(ok(null), respuesta(404, { success: false, error: { code: 'ASSIST_DISABLED', message: 'Apagado' } }));
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(true));
  await act(async () => result.current.enviar('Hola', 'Gestión POS'));
  await waitFor(() => expect(result.current.disponible).toBe(false));
});

test('el historial abre una conversación y borrar la abierta deja el hilo en blanco', async () => {
  simular(
    ok(null),
    ok({ conversations: [{ conversationId: 'c-2', title: null, updatedAt: '2026-10-10T00:00:00Z', turnCount: 1 }] }),
    ok({ conversationId: 'c-2', turns: [TURNO] }),
    ok({ deleted: 1 }),
  );
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(true));

  await act(async () => result.current.cargarHistorial());
  expect(result.current.historial).toEqual({
    fase: 'lista',
    items: [{ conversationId: 'c-2', title: 'Conversación sin título', updatedAt: '2026-10-10T00:00:00Z', turnCount: 1 }],
  });

  await act(async () => {
    await expect(result.current.abrirConversacion('c-2')).resolves.toBe(true);
  });
  expect(result.current.actualId).toBe('c-2');
  expect(result.current.burbujas).toHaveLength(2);

  await act(async () => {
    await expect(result.current.borrarConversacion('c-2')).resolves.toBe(true);
  });
  expect(result.current.burbujas).toEqual([]);
  expect(result.current.actualId).toBeNull();
  expect(result.current.historial).toEqual({ fase: 'lista', items: [] });
  expect(llamadas[3]!.init.method).toBe('DELETE');
});

test('un fallo del historial no toca el chat', async () => {
  simular(ok({ conversationId: 'c-1', turns: [TURNO] }), respuesta(500, { success: false, error: { message: 'x' } }));
  const { result } = await renderHook(() => useAsistente());
  await waitFor(() => expect(result.current.disponible).toBe(true));

  await act(async () => result.current.cargarHistorial());
  expect(result.current.historial).toEqual({ fase: 'error', mensaje: 'No pudimos cargar tus conversaciones. Intenta de nuevo.' });
  expect(result.current.burbujas).toHaveLength(2);
  expect(result.current.estado).toEqual({ fase: 'lista' });
});
