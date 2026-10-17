/**
 * Inicio, Pagos y Perfil pintan la última copia del libro de crédito mientras llega la de ahora (2026-10-17).
 *
 * Antes cada pantalla esperaba sus cinco consultas con la pantalla vacía, al abrir la app y al cambiar de pestaña.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as loansApi from '../src/api/endpoints/loans';
import { useCreditBook } from '../src/features/use-credit-book';
import { CLAVE_LIBRO_RECORDADO, olvidarLibroRecordado, recordarLibro } from '../src/features/libro-recordado';
import { limpiarDatosLocales } from '../src/session/datos-locales';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock('../src/api/endpoints/loans', () => ({
  listLoans: jest.fn(),
  getSpendingByCategory: jest.fn(async () => ({ totals: { overdue: 0 } })),
  getCreditRating: jest.fn(async () => null),
  getPaymentCalendar: jest.fn(async () => null),
}));
jest.mock('../src/api/endpoints/credit-line', () => ({ getCreditLine: jest.fn(async () => null) }));

const prestamo = (id: string) => ({ loanId: id }) as unknown as loansApi.LoanSummary;

beforeEach(async () => {
  jest.clearAllMocks();
  await olvidarLibroRecordado();
  await AsyncStorage.clear();
});

it('pinta la copia recordada mientras el servidor no contesta, y la reemplaza al llegar', async () => {
  await recordarLibro('23', { ready: true, error: null, loans: [prestamo('viejo')], spending: null, rating: null, calendar: null, creditLine: null, creditLineError: null });
  let soltar: (valor: { items: loansApi.LoanSummary[] }) => void = () => undefined;
  jest.mocked(loansApi.listLoans).mockImplementation(() => new Promise((resolve) => (soltar = resolve as typeof soltar)) as ReturnType<typeof loansApi.listLoans>);

  const { result } = await renderHook(() => useCreditBook('23'));
  await act(async () => undefined);
  expect(result.current.ready).toBe(true);
  expect(result.current.loans.map((l) => (l as unknown as { loanId: string }).loanId)).toEqual(['viejo']);

  await act(async () => {
    soltar({ items: [prestamo('nuevo')] });
  });
  expect(result.current.loans.map((l) => (l as unknown as { loanId: string }).loanId)).toEqual(['nuevo']);
  expect(JSON.parse((await AsyncStorage.getItem(CLAVE_LIBRO_RECORDADO)) ?? '{}').libro.loans).toEqual([{ loanId: 'nuevo' }]);
});

it('la copia de OTRO cliente no se enseña', async () => {
  await recordarLibro('99', { ready: true, error: null, loans: [prestamo('ajeno')], spending: null, rating: null, calendar: null, creditLine: null, creditLineError: null });
  jest.mocked(loansApi.listLoans).mockImplementation(() => new Promise(() => undefined) as ReturnType<typeof loansApi.listLoans>);

  const { result } = await renderHook(() => useCreditBook('23'));
  await act(async () => undefined);
  expect(result.current.ready).toBe(false);
  expect(result.current.loans).toEqual([]);
});

it('un fallo de red no reemplaza la última copia buena', async () => {
  const bueno = { ready: true, error: null, loans: [prestamo('bueno')], spending: null, rating: null, calendar: null, creditLine: null, creditLineError: null };
  await recordarLibro('23', bueno);
  jest.mocked(loansApi.listLoans).mockRejectedValue(new Error('red'));
  jest.mocked(loansApi.getSpendingByCategory).mockRejectedValue(new Error('red'));

  const { result } = await renderHook(() => useCreditBook('23'));
  await act(async () => undefined);
  expect(result.current.error).toBe('No pudimos cargar tus créditos.');
  expect(JSON.parse((await AsyncStorage.getItem(CLAVE_LIBRO_RECORDADO)) ?? '{}').libro.loans).toEqual([{ loanId: 'bueno' }]);
});

it('se borra al limpiar los datos locales (salir o que entre otra persona)', async () => {
  await recordarLibro('23', { ready: true, error: null, loans: [], spending: null, rating: null, calendar: null, creditLine: null, creditLineError: null });
  await limpiarDatosLocales();
  expect(await AsyncStorage.getItem(CLAVE_LIBRO_RECORDADO)).toBeNull();
});
