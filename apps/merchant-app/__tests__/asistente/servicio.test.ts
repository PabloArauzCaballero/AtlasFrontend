/**
 * El servicio del asistente contra un `fetch` simulado: que habla con la pasarela del ERP con el
 * contrato que ésta acepta (sin `surface`: la fija el token), que la llave de idempotencia viaja en el
 * cuerpo y en la cabecera, y que el 409 «sigue en curso» se repite con la MISMA llave esperando lo que
 * pide `Retry-After`.
 */
import { ApiError, clearAccessToken, setAccessToken } from '@/api/client';
import { assistService, conReintentoEnCurso } from '@/api/servicios/assistService';
import { describirErrorDelAsistente, esApagado, limpiarPantalla, pantallaDelAsistente } from '@/features/asistente/asistente';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-de-prueba' }));

type Llamada = { url: string; init: RequestInit };

function respuesta(status: number, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Response {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  return new Response(texto, { status, headers: { 'content-type': 'application/json', ...cabeceras } });
}

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

const LLAVE = '8f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const RESPUESTA = { reply: 'Ve a Gestión POS.', suggestHandoff: false, conversationId: 'c-1', turnId: 't-1' };

beforeEach(() => {
  clearAccessToken();
  setAccessToken('token-1');
});

test('pregunta por la pasarela del ERP con sólo los campos del contrato y la llave en la cabecera', async () => {
  simular(respuesta(200, { success: true, data: RESPUESTA }));

  await expect(
    assistService.preguntar({ prompt: '¿Dónde veo mis ventas?', clientMessageId: LLAVE, screen: 'Gestión POS' }),
  ).resolves.toEqual(RESPUESTA);

  const { url, init } = llamadas[0]!;
  expect(url).toBe('https://api.atlas.invalid/api/v1/internal/assist/chat');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('include');
  expect(JSON.parse(String(init.body))).toEqual({ prompt: '¿Dónde veo mis ventas?', clientMessageId: LLAVE, screen: 'Gestión POS' });
  expect((init.headers as Record<string, string>)['x-idempotency-key']).toBe(LLAVE);
});

test('un 409 se repite con la MISMA llave, esperando lo que pide Retry-After', async () => {
  simular(
    respuesta(409, { success: false, error: { code: 'ASSIST_IN_FLIGHT', message: 'En curso' } }, { 'retry-after': '4' }),
    respuesta(200, RESPUESTA),
  );
  const dormir = jest.fn(() => Promise.resolve());

  await expect(assistService.preguntar({ prompt: 'Hola', clientMessageId: LLAVE }, { dormir })).resolves.toEqual(RESPUESTA);

  expect(dormir).toHaveBeenCalledWith(4000);
  expect(llamadas).toHaveLength(2);
  expect(llamadas.map((l) => JSON.parse(String(l.init.body)).clientMessageId)).toEqual([LLAVE, LLAVE]);
});

test('conReintentoEnCurso acota la espera y se rinde tras tres repeticiones', async () => {
  const enCurso = new ApiError('En curso', 409, false, false, 'ASSIST_IN_FLIGHT', 60);
  const enviar = jest.fn(() => Promise.reject(enCurso));
  const dormir = jest.fn(() => Promise.resolve());

  await expect(conReintentoEnCurso(enviar, { dormir })).rejects.toBe(enCurso);
  expect(enviar).toHaveBeenCalledTimes(4);
  expect(dormir).toHaveBeenCalledWith(10_000);

  const otro = new ApiError('Mal', 400);
  const falla = jest.fn(() => Promise.reject(otro));
  await expect(conReintentoEnCurso(falla, { dormir })).rejects.toBe(otro);
  expect(falla).toHaveBeenCalledTimes(1);
});

test('lee el hilo, la lista y una conversación, y borra', async () => {
  simular(
    respuesta(200, { success: true, data: { conversationId: 'c-1', turns: [] } }),
    respuesta(200, {
      success: true,
      data: { conversations: [{ conversationId: 'c-1', title: null, updatedAt: '2026-10-10T00:00:00Z', turnCount: 2 }] },
    }),
    respuesta(200, { success: true, data: { conversationId: 'c-1', turns: [] } }),
    respuesta(200, { success: true, data: { deleted: 1 } }),
  );

  await assistService.conversacion();
  await expect(assistService.conversaciones()).resolves.toHaveLength(1);
  await assistService.abrir('c 1');
  await assistService.borrar('c-1');

  expect(llamadas.map((l) => `${l.init.method} ${l.url.replace('https://api.atlas.invalid/api/v1/', '')}`)).toEqual([
    'GET internal/assist/conversation',
    'GET internal/assist/conversations',
    'GET internal/assist/conversations/c%201',
    'DELETE internal/assist/conversations/c-1',
  ]);
});

test('una lista sin conversaciones es una lista vacía', async () => {
  simular(respuesta(200, { success: true, data: null }));
  await expect(assistService.conversaciones()).resolves.toEqual([]);
});

test('el 404 es «apagado» y cada fallo tiene su frase', () => {
  expect(esApagado(new ApiError('No', 404))).toBe(true);
  expect(esApagado(new ApiError('No', 503, false, false, 'ASSIST_DISABLED'))).toBe(true);
  expect(esApagado(new ApiError('Ocupado', 429))).toBe(false);
  expect(describirErrorDelAsistente(new ApiError('Eso no lo contesto.', 400, false, false, 'ASSIST_REJECTED'))).toBe('Eso no lo contesto.');
  expect(describirErrorDelAsistente(new ApiError('x', 429))).toMatch(/muchas consultas/);
  expect(describirErrorDelAsistente(new ApiError('x', 0, true, true))).toMatch(/no se duplica/);
  expect(describirErrorDelAsistente(new Error('boom'))).toMatch(/Inténtalo otra vez/);
});

test('la pantalla es el nombre de la sección del menú del portal, en la forma que acepta el backend', () => {
  expect(pantallaDelAsistente('/gestion-pos')).toBe('Gestión POS');
  expect(pantallaDelAsistente('/cartera')).toBe('Mi cartera');
  expect(pantallaDelAsistente('/conversacion/abc')).toBe('Soporte y tutoriales');
  expect(pantallaDelAsistente('/otra-cosa')).toBe('Portal del comercio');
  expect(pantallaDelAsistente(null)).toBe('Portal del comercio');
  expect(limpiarPantalla('Hola <b>mundo</b>?!')).toBe('Hola b mundo /b');
  expect(limpiarPantalla('x'.repeat(100))).toHaveLength(80);
});
