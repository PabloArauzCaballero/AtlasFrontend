/**
 * Volver a pedir los datos de una pantalla cuando la persona VUELVE a ella.
 *
 * Las pestañas de la app quedan montadas: Inicio y Pagos cargaban sus datos una sola vez, al abrir la app. Después
 * de una compra, de un pago confirmado por el comercio o de subir de nivel, la pantalla seguía mostrando lo de antes
 * hasta cerrar la app (Pablo, 2026-10-08: «no se recargan los puntos», «no se recarga la pantalla de mis créditos»).
 *
 * Recarga al volver a la pantalla y al volver la app al frente. Devuelve cuántas veces se volvió: usado como `key`,
 * vuelve a montar las tarjetas para que sus cifras cuenten otra vez desde cero en vez de quedarse quietas.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * La regla, sin React: la primera vez que la pantalla gana el foco NO recarga (ya cargó al montarse; pedirlo aquí
 * también lo pediría dos veces); cada vuelta siguiente sí, y se cuenta. Volver la app al frente recarga siempre.
 */
export function reglaAlVolver(recargar: () => unknown, alContar: () => void) {
  let primera = true;
  return {
    alEnfocar() {
      if (primera) {
        primera = false;
        return;
      }
      alContar();
      void recargar();
    },
    alCambiarEstado(estado: string) {
      if (estado === 'active') void recargar();
    },
  };
}

export function useAlVolver(recargar: () => unknown): number {
  const [vueltas, setVueltas] = useState(0);
  const ultimo = useRef(recargar);
  ultimo.current = recargar;
  const regla = useRef(
    reglaAlVolver(
      () => ultimo.current(),
      () => setVueltas((n) => n + 1),
    ),
  ).current;

  useFocusEffect(useCallback(() => regla.alEnfocar(), [regla]));

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => regla.alCambiarEstado(estado));
    return () => suscripcion.remove();
  }, [regla]);

  return vueltas;
}
