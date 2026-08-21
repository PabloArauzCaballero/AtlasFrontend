/**
 * El libro de credito del cliente, traido del backend.
 *
 * Un solo hook para prestamos, gasto por rubro y calificacion porque las tres pantallas que los
 * usan —inicio, pagos y perfil— los piden juntos y de la misma sesion. Separarlos en tres hooks
 * haria tres viajes por pantalla y, peor, permitiria que el tablero y la lista de pagos quedaran
 * desfasados entre si: el mismo dinero contado en dos momentos distintos.
 */
import { useCallback, useEffect, useState } from 'react';
import * as loansApi from '../api/endpoints/loans';

type State = {
  ready: boolean;
  error: string | null;
  loans: loansApi.LoanSummary[];
  spending: loansApi.SpendingByCategory | null;
  rating: loansApi.CreditRating | null;
  /**
   * El calendario: todas las cuotas de todos los creditos en una sola linea de tiempo.
   *
   * Viaja con el resto y no en su propio hook porque la pantalla de pagos lo necesita para DOS
   * cosas a la vez —pintar el mes y decidir que credito esta «por vencer»— y pedirlo aparte
   * permitiria que la lista y el calendario contaran la misma cuota de dos maneras.
   */
  calendar: loansApi.PaymentCalendar | null;
};

const EMPTY: State = { ready: false, error: null, loans: [], spending: null, rating: null, calendar: null };

export function useCreditBook(customerId: string | null) {
  const [state, setState] = useState<State>(EMPTY);

  const load = useCallback(async () => {
    if (!customerId) {
      setState({ ...EMPTY, ready: true });
      return;
    }

    /*
     * `allSettled` y no `all`. La calificacion NO existe hasta que hay un credito calificado, asi
     * que un 404 suyo es un estado normal del producto —cliente nuevo— y no puede tumbar el tablero
     * de gastos. Con `all`, la pantalla entera se caeria por la pieza mas opcional de las tres.
     */
    const [loans, spending, rating, calendar] = await Promise.allSettled([
      loansApi.listLoans(customerId),
      loansApi.getSpendingByCategory(customerId),
      loansApi.getCreditRating(customerId),
      loansApi.getPaymentCalendar(customerId),
    ]);

    setState({
      ready: true,
      // Solo se reporta error si falla lo que sostiene la pantalla; la calificacion ausente no lo es.
      error: loans.status === 'rejected' && spending.status === 'rejected' ? 'No pudimos cargar tus créditos.' : null,
      loans: loans.status === 'fulfilled' ? loans.value.items : [],
      spending: spending.status === 'fulfilled' ? spending.value : null,
      rating: rating.status === 'fulfilled' ? rating.value : null,
      calendar: calendar.status === 'fulfilled' ? calendar.value : null,
    });
  }, [customerId]);

  useEffect(() => {
    let cancelled = false;
    void load().catch(() => {
      if (!cancelled) setState({ ...EMPTY, ready: true, error: 'No pudimos cargar tus créditos.' });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { ...state, reload: load };
}

/**
 * La politica de mora vigente.
 *
 * Va aparte porque no depende del cliente: es la misma para todos y solo se pide cuando alguien
 * abre los terminos. Cargarla junto al resto anadiria un viaje a cada apertura de la app para un
 * texto que la mayoria no va a leer.
 */
export function useDelinquencyPolicy(enabled: boolean) {
  const [policy, setPolicy] = useState<loansApi.DelinquencyPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loansApi
      .getDelinquencyPolicy()
      .then((value) => {
        if (!cancelled) setPolicy(value);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar la política.');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { policy, error };
}
