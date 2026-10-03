import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import SoporteIndex from '../app/(app)/soporte/index';
import * as supportApi from '../src/api/endpoints/support';
import { Cargando, SkeletonLista } from '../src/ui/primitives';

/**
 * «Cuando algo carga, que se vea que carga»: una espera NO puede pintarse como vacío ni como error.
 * El cliente veía «Nada por aquí» y textos de fallo mientras la respuesta todavía venía en camino.
 */
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true, navigate: jest.fn() }),
  usePathname: () => '/soporte',
}));
jest.mock('../src/api/endpoints/support', () => ({
  getFaq: jest.fn(),
  listCases: jest.fn(),
  listCategories: jest.fn(),
  searchKnowledge: jest.fn(),
  openChannel: jest.fn(),
}));

const api = supportApi as unknown as Record<'getFaq' | 'listCases' | 'listCategories' | 'searchKnowledge' | 'openChannel', jest.Mock>;
// En jest `initialWindowMetrics` es null y sin métricas el provider no pinta a sus hijos.
const METRICAS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <SoporteIndex />
    </SafeAreaProvider>,
  );
const pendiente = () => new Promise<never>(() => undefined);

describe('primitivas de carga', () => {
  it('Cargando es una barra de progreso con nombre', async () => {
    await render(<Cargando texto="Abriendo tu conversación…" />);
    expect(screen.getByRole('progressbar', { name: 'Abriendo tu conversación…' })).toBeTruthy();
  });

  it('SkeletonLista pinta una fila por cada una que se pide', async () => {
    const cuenta = async (filas: number) => {
      const { toJSON, unmount } = await render(<SkeletonLista filas={filas} alto={77} />);
      const n = JSON.stringify(toJSON()).match(/"height":77/g)?.length ?? 0;
      await unmount();
      return n;
    };
    const dos = await cuenta(2);
    expect(dos).toBeGreaterThan(0);
    expect(await cuenta(4)).toBe(dos * 2);
  });
});

describe('Soporte mientras carga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.listCategories.mockResolvedValue({ categories: [] });
    api.listCases.mockResolvedValue({ cases: [] });
  });

  it('con la ayuda en camino no dice «Nada por aquí» ni error', async () => {
    api.getFaq.mockReturnValue(pendiente());
    await montar();
    expect(screen.queryByText(/Nada por aquí/)).toBeNull();
    expect(screen.queryByText(/No pudimos/)).toBeNull();
    expect(screen.getByText('Preguntas frecuentes')).toBeTruthy();
  });

  it('una búsqueda en el aire enseña la espera, no «Nada por aquí»', async () => {
    api.getFaq.mockResolvedValue({ faq: [] });
    api.searchKnowledge.mockReturnValue(pendiente());
    jest.useFakeTimers();
    try {
      await montar();
      await act(async () => {
        await Promise.resolve();
      });
      await fireEvent.changeText(screen.getByLabelText('Buscar en la ayuda'), 'no me llega el código');
      await act(async () => {
        jest.advanceTimersByTime(450);
        await Promise.resolve();
      });
      expect(screen.getByText('Resultados')).toBeTruthy();
      expect(screen.queryByText(/Nada por aquí/)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('una búsqueda que FALLA dice que falló, no «Nada por aquí»', async () => {
    api.getFaq.mockResolvedValue({ faq: [] });
    api.searchKnowledge.mockRejectedValue(new Error('red'));
    jest.useFakeTimers();
    try {
      await montar();
      await act(async () => {
        await Promise.resolve();
      });
      await fireEvent.changeText(screen.getByLabelText('Buscar en la ayuda'), 'no me llega el código');
      await act(async () => {
        jest.advanceTimersByTime(450);
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.getByText('No pudimos buscar')).toBeTruthy());
      expect(screen.queryByText(/Nada por aquí/)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('si fallan los casos, la FAQ que sí llegó se sigue viendo', async () => {
    api.getFaq.mockResolvedValue({
      faq: [{ articleId: 'a1', title: 'Cómo pago', question: '¿Cómo pago una cuota?', shortAnswer: 'En Pagos.', body: 'x', escalateWhen: null }],
    });
    api.listCases.mockRejectedValue(new Error('casos caídos'));
    await montar();
    await waitFor(() => expect(screen.getByText('¿Cómo pago una cuota?')).toBeTruthy());
    expect(screen.queryByText(/No pudimos cargar la ayuda/)).toBeNull();
  });
});
