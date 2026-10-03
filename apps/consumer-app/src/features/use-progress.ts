/**
 * El nivel del cliente, con sus tres estados: cargando, con datos y fallo.
 *
 * Aparte de `useCreditBook` a propósito: el nivel NO depende de la línea de crédito, y atarlos haría que un
 * fallo del motor escondiera el nivel, que justamente existe para quien todavía no tiene línea.
 */
import { useCallback, useEffect, useState } from 'react';
import * as creditLineApi from '../api/endpoints/credit-line';

type Estado =
  | { fase: 'cargando'; progress: null }
  | { fase: 'lista'; progress: creditLineApi.Progress }
  | { fase: 'fallo'; progress: null };

export function useProgress(customerId: string | null) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando', progress: null });

  const cargar = useCallback(async () => {
    if (!customerId) return;
    setEstado((previo) => (previo.fase === 'lista' ? previo : { fase: 'cargando', progress: null }));
    try {
      setEstado({ fase: 'lista', progress: await creditLineApi.getProgress(customerId) });
    } catch {
      setEstado((previo) => (previo.fase === 'lista' ? previo : { fase: 'fallo', progress: null }));
    }
  }, [customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { ...estado, recargar: cargar };
}
