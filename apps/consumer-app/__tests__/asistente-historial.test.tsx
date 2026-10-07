/**
 * «Nueva conversación» e «Historial» de Atlas Assist: el hook y la hoja.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Nueva conversación no llama al servidor** y el siguiente envío viaja SIN `conversationId`
 *    (así el servidor abre otra). Con una petición en viaje no se permite.
 * 2. **Abrir una conversación del historial la deja como hilo vigente:** el siguiente envío continúa
 *    con su id.
 * 3. **Un fallo del historial no bloquea el chat.** Lista caída = «Reintentar»; el hilo sigue.
 * 4. **Borrar se confirma en la fila** (sin `window.confirm`) y, si era la abierta, reinicia el hilo.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AtlasApiError } from '../src/api/errors';
import * as assistApi from '../src/api/endpoints/assist';
import { fechaRelativa, useAssist } from '../src/features/assist';
import { AssistSheet } from '../src/ui/assist-sheet';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/api/endpoints/assist', () => ({
  preguntar: jest.fn(),
  conversacion: jest.fn(),
  listarConversaciones: jest.fn(),
  leerConversacion: jest.fn(),
  borrarConversacion: jest.fn(),
}));


jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }));

const preguntar = assistApi.preguntar as jest.Mock;
const conversacion = assistApi.conversacion as jest.Mock;
const listar = assistApi.listarConversaciones as jest.Mock;
const leer = assistApi.leerConversacion as jest.Mock;
const borrar = assistApi.borrarConversacion as jest.Mock;

const turno = (n: number) => ({ turnId: `t${n}`, prompt: `pregunta ${n}`, reply: `respuesta ${n}`, suggestHandoff: false, createdAt: '2026-09-29T10:00:00Z' });
const HILO_ACTUAL = { conversationId: 'conv-actual', turns: [turno(1)] };
const RESUMENES = [
  { conversationId: 'conv-actual', title: 'Cómo pago una cuota', updatedAt: new Date().toISOString(), turnCount: 1 },
  { conversationId: 'conv-vieja', title: 'Qué es el QR', updatedAt: '2026-09-01T10:00:00Z', turnCount: 3 },
];
const ERROR_RED = () => new AtlasApiError({ kind: 'network', code: 'NETWORK', message: 'x', status: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  conversacion.mockResolvedValue(HILO_ACTUAL);
  listar.mockResolvedValue({ conversations: RESUMENES });
  leer.mockResolvedValue({ conversationId: 'conv-vieja', title: 'Qué es el QR', turns: [turno(7), turno(8)] });
  borrar.mockResolvedValue({ deleted: 1 });
  preguntar.mockResolvedValue({ reply: 'ok', suggestHandoff: false, conversationId: 'conv-nueva', turnId: 'tn' });
});

async function hook() {
  const r = await renderHook(() => useAssist());
  await waitFor(() => expect(r.result.current.disponible).toBe(true));
  return r;
}

describe('useAssist · nueva conversación', () => {
  it('vacía el hilo sin llamar al servidor y el siguiente envío no lleva conversationId', async () => {
    const { result } = await hook();
    expect(result.current.burbujas).toHaveLength(2);

    let hecho = false;
    await act(async () => {
      hecho = result.current.nuevaConversacion();
    });

    expect(hecho).toBe(true);
    expect(result.current.burbujas).toEqual([]);
    expect(result.current.estado).toEqual({ fase: 'lista' });
    expect(result.current.actualId).toBeNull();
    expect(preguntar).not.toHaveBeenCalled();

    await act(async () => result.current.enviar('hola', 'inicio'));
    await waitFor(() => expect(result.current.estado.fase).toBe('lista'));
    expect(preguntar.mock.calls[0][0]).not.toHaveProperty('conversationId');
    expect(result.current.actualId).toBe('conv-nueva');
  });

  it('no se permite con una petición en viaje', async () => {
    let soltar: (v: unknown) => void = () => undefined;
    preguntar.mockReturnValue(new Promise((resolver) => (soltar = resolver)));
    const { result } = await hook();

    await act(async () => result.current.enviar('hola', 'inicio'));
    let hecho = true;
    await act(async () => {
      hecho = result.current.nuevaConversacion();
    });
    expect(hecho).toBe(false);
    expect(result.current.burbujas).toHaveLength(3);

    await act(async () => soltar({ reply: 'ok', suggestHandoff: false, conversationId: 'conv-actual', turnId: 'tx' }));
  });
});

describe('useAssist · historial', () => {
  it('carga la lista y la expone', async () => {
    const { result } = await hook();
    await act(async () => result.current.cargarHistorial());
    expect(result.current.historial).toEqual({ fase: 'lista', items: RESUMENES });
  });

  it('un fallo de la lista da error con mensaje y NO toca el chat', async () => {
    listar.mockRejectedValue(ERROR_RED());
    const { result } = await hook();
    await act(async () => result.current.cargarHistorial());
    expect(result.current.historial).toEqual({ fase: 'error', mensaje: 'Sin conexión. Revisa tu internet y vuelve a intentar.' });
    expect(result.current.estado).toEqual({ fase: 'lista' });
    expect(result.current.burbujas).toHaveLength(2);
    expect(result.current.disponible).toBe(true);
  });

  it('abrir una conversación la deja vigente: el envío siguiente continúa con su id', async () => {
    const { result } = await hook();
    let ok = false;
    await act(async () => {
      ok = await result.current.abrirConversacion('conv-vieja');
    });
    expect(ok).toBe(true);
    expect(leer).toHaveBeenCalledWith('conv-vieja');
    expect(result.current.burbujas.map((b) => b.texto)).toEqual(['pregunta 7', 'respuesta 7', 'pregunta 8', 'respuesta 8']);
    expect(result.current.actualId).toBe('conv-vieja');

    await act(async () => result.current.enviar('otra', 'inicio'));
    await waitFor(() => expect(preguntar).toHaveBeenCalled());
    expect(preguntar.mock.calls[0][0]).toMatchObject({ conversationId: 'conv-vieja' });
  });

  it('si abrir falla, el hilo actual se queda y hay un aviso; un 404 la quita de la lista', async () => {
    const { result } = await hook();
    await act(async () => result.current.cargarHistorial());
    leer.mockRejectedValue(new AtlasApiError({ kind: 'not_found', code: 'X', message: 'x', status: 404 }));
    let ok = true;
    await act(async () => {
      ok = await result.current.abrirConversacion('conv-vieja');
    });
    expect(ok).toBe(false);
    expect(result.current.burbujas).toHaveLength(2);
    expect(result.current.avisoHistorial).toBe('Esa conversación ya no existe.');
    expect(result.current.historial).toEqual({ fase: 'lista', items: [RESUMENES[0]] });
  });

  it('borrar la conversación abierta reinicia el hilo; borrar otra sólo la quita de la lista', async () => {
    const { result } = await hook();
    await act(async () => result.current.cargarHistorial());

    await act(async () => {
      await result.current.borrarConversacion('conv-vieja');
    });
    expect(borrar).toHaveBeenCalledWith('conv-vieja');
    expect(result.current.burbujas).toHaveLength(2);

    await act(async () => {
      await result.current.borrarConversacion('conv-actual');
    });
    expect(result.current.burbujas).toEqual([]);
    expect(result.current.actualId).toBeNull();
    expect(result.current.historial).toEqual({ fase: 'lista', items: [] });
  });

  it('si borrar falla, nada cambia y se avisa', async () => {
    borrar.mockRejectedValue(ERROR_RED());
    const { result } = await hook();
    await act(async () => result.current.cargarHistorial());
    let ok = true;
    await act(async () => {
      ok = await result.current.borrarConversacion('conv-actual');
    });
    expect(ok).toBe(false);
    expect(result.current.burbujas).toHaveLength(2);
    expect(result.current.avisoHistorial).toBe('No pudimos borrar la conversación. Intenta de nuevo.');
  });
});

describe('fechaRelativa', () => {
  const ahora = new Date(2026, 8, 29, 15, 0, 0);
  const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString();
  it('habla como una persona', () => {
    expect(fechaRelativa(hace(20_000), ahora)).toBe('Hace un momento');
    expect(fechaRelativa(hace(5 * 60_000), ahora)).toBe('Hace 5 min');
    expect(fechaRelativa(hace(3 * 3_600_000), ahora)).toBe('Hace 3 h');
    expect(fechaRelativa(new Date(2026, 8, 28, 9, 0).toISOString(), ahora)).toBe('Ayer');
    expect(fechaRelativa(new Date(2026, 8, 25, 9, 0).toISOString(), ahora)).toBe('Hace 4 días');
    expect(fechaRelativa(new Date(2026, 7, 12, 9, 0).toISOString(), ahora)).toBe('12 ago');
    expect(fechaRelativa(new Date(2025, 7, 12, 9, 0).toISOString(), ahora)).toBe('12 ago 2025');
    expect(fechaRelativa('no-es-fecha', ahora)).toBe('');
  });
});

const metricas = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
function Hoja() {
  const assist = useAssist();
  return (
    <SafeAreaProvider initialMetrics={metricas}>
      <AssistSheet visible onClose={jest.fn()} pantalla="inicio" assist={assist} />
    </SafeAreaProvider>
  );
}

describe('AssistSheet · acciones', () => {
  it('«Nueva conversación» está apagada con razón si el hilo está vacío y activa si hay mensajes', async () => {
    conversacion.mockResolvedValue({ conversationId: null, turns: [] });
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByTestId('asistente-nueva-razon')).toBeTruthy());
    expect(screen.getByTestId('asistente-nueva').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Ya estás en una conversación nueva.')).toBeTruthy();
    expect(screen.getByTestId('asistente-historial')).toBeTruthy();
  });

  it('con hilo, «Nueva conversación» lo vacía y muestra las sugerencias', async () => {
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByText('respuesta 1')).toBeTruthy());
    expect(screen.queryByTestId('asistente-nueva-razon')).toBeNull();
    await fireEvent.press(screen.getByTestId('asistente-nueva'));
    await waitFor(() => expect(screen.queryByText('respuesta 1')).toBeNull());
    expect(screen.getByTestId('asistente-chip-0')).toBeTruthy();
    expect(preguntar).not.toHaveBeenCalled();
  });

  it('el historial lista, abre y vuelve al chat con esa conversación', async () => {
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByText('respuesta 1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('asistente-historial'));
    await waitFor(() => expect(screen.getByTestId('asistente-historial-fila-1')).toBeTruthy());
    expect(screen.getByText('Cómo pago una cuota')).toBeTruthy();
    expect(screen.getByText('Hace un momento · 1 pregunta')).toBeTruthy();
    expect(screen.getByText('Abierta')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asistente-historial-fila-1'));
    await waitFor(() => expect(screen.getByText('respuesta 8')).toBeTruthy());
    expect(screen.queryByTestId('asistente-historial-volver')).toBeNull();
  });

  it('«Volver al chat» regresa sin cambiar el hilo', async () => {
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByText('respuesta 1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('asistente-historial'));
    await fireEvent.press(await screen.findByTestId('asistente-historial-volver'));
    expect(screen.getByText('respuesta 1')).toBeTruthy();
  });

  it('vacío, error con reintento, y el chat sigue vivo', async () => {
    listar.mockResolvedValueOnce({ conversations: [] });
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByText('respuesta 1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('asistente-historial'));
    expect(await screen.findByText('Aún no tienes conversaciones')).toBeTruthy();

    listar.mockRejectedValueOnce(ERROR_RED());
    await fireEvent.press(screen.getByTestId('asistente-historial-volver'));
    await fireEvent.press(screen.getByTestId('asistente-historial'));
    expect(await screen.findByTestId('asistente-historial-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('asistente-historial-reintentar'));
    expect(await screen.findByTestId('asistente-historial-fila-0')).toBeTruthy();
  });

  it('borrar pide confirmación en la fila; cancelar no borra, confirmar sí', async () => {
    await render(<Hoja />);
    await waitFor(() => expect(screen.getByText('respuesta 1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('asistente-historial'));
    await fireEvent.press(await screen.findByTestId('asistente-historial-borrar-1'));
    expect(screen.getByText('¿Borrar esta conversación?')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asistente-historial-cancelar-1'));
    expect(borrar).not.toHaveBeenCalled();
    expect(screen.getByTestId('asistente-historial-fila-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asistente-historial-borrar-1'));
    await fireEvent.press(screen.getByTestId('asistente-historial-confirmar-1'));
    await waitFor(() => expect(borrar).toHaveBeenCalledWith('conv-vieja'));
    await waitFor(() => expect(screen.queryByText('Qué es el QR')).toBeNull());
  });
});
