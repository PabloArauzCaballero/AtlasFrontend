/**
 * Una cola de Gestión POS: lo que espera la palabra del comercio (solicitudes, comprobantes, pagos
 * iniciales). Es el `recargar` + `useEffect` que las tres pantallas de la web repiten casi igual.
 *
 * Lo que se conserva de la web, a propósito:
 *  - `partnerId === ''` significa «no hay expediente», no «todavía cargando»: la cola deja de cargar
 *    y enseña su vacío. Sin esto se quedaba en «Cargando…» para siempre, que se lee como «el sistema
 *    está pensando» cuando lo que pasa es que no hay nada que pedir. El motivo lo dice el aviso de
 *    arriba de la pantalla.
 *  - `onCount` con el total de filas, para el contador de la pestaña.
 *  - un fallo deja las filas que había y pone el error encima.
 */
import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError } from '@/api/client';
import { useRegistrarRecarga, type Recargas } from './recargas';

export interface Cola<T> {
  filas: T[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

export function useCola<T>({
  id,
  partnerId,
  leer,
  respaldo,
  onCount,
  recargas,
}: {
  /** Nombre del panel en el registro de recargas. */
  id: string;
  partnerId: string;
  /** Debe ser estable (a nivel de módulo): si cambia en cada render, la cola se pide sin parar. */
  leer: (partnerId: string) => Promise<T[]>;
  /** La frase de la web cuando el error no trae la suya. */
  respaldo: string;
  onCount?: ((total: number) => void) | undefined;
  recargas: Recargas;
}): Cola<T> {
  const [filas, setFilas] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!partnerId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const resultado = await leer(partnerId);
      setFilas(resultado);
      onCount?.(resultado.length);
      setError(null);
    } catch (fallo) {
      setError(mensajeDeError(fallo, respaldo));
    } finally {
      setCargando(false);
    }
    // `onCount` entra en las dependencias como en la web: el padre lo memoriza (`useCallback`).
  }, [partnerId, leer, respaldo, onCount]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useRegistrarRecarga(recargas, id, recargar);

  return { filas, cargando, error, recargar };
}
