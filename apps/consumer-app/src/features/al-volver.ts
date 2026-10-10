/**
 * Volver a pedir los datos de una pantalla cuando la persona VUELVE a ella, cuando hay una operacion de dinero y,
 * mientras la mira, cada minuto.
 *
 * Las pestañas de la app quedan montadas: Inicio y Pagos cargaban sus datos una sola vez, al abrir la app. Después
 * de una compra, de un pago confirmado por el comercio o de subir de nivel, la pantalla seguía mostrando lo de antes
 * hasta cerrar la app (Pablo, 2026-10-08 y 2026-10-09). La regla completa, y por qué no bastaba con el foco, está
 * en `features/refresco.ts`.
 *
 * Devuelve cuántas veces se volvió: usado como `key`, vuelve a montar las tarjetas para que sus cifras cuenten otra
 * vez desde cero en vez de quedarse quietas.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { crearLimitador, LATIDO_EN_PANTALLA_MS, suscribirCambioDeDinero } from './refresco';

/**
 * La regla, sin React.
 *
 * - La primera vez que la pantalla gana el foco NO recarga (ya cargó al montarse; pedirlo aquí también lo pediría dos
 *   veces); cada vuelta siguiente sí, y se cuenta.
 * - Volver la app al frente recarga.
 * - El latido recarga solo con la pantalla a la vista.
 * - Una operación de dinero recarga siempre, con o sin foco: así la pestaña de atrás ya está al día cuando se vuelve.
 * - Lo automático (foco, frente, latido) pasa por el limitador: nunca dos recargas en menos de 5 s.
 */
export function reglaAlVolver(recargar: () => unknown, alContar: () => void, limitador = crearLimitador()) {
  let primera = true;
  let enfocada = false;
  // Lo que dijo el ultimo cambio de `AppState`; al montarse, la app esta al frente.
  let alFrente = true;
  limitador.anotar(); // la carga al montar
  const intentar = (forzada: boolean) => {
    if (limitador.puede(forzada)) void recargar();
  };
  return {
    alEnfocar() {
      enfocada = true;
      if (primera) {
        primera = false;
        return;
      }
      alContar();
      intentar(false);
    },
    alDesenfocar() {
      enfocada = false;
    },
    alCambiarEstado(estado: string) {
      alFrente = estado === 'active';
      if (alFrente) intentar(false);
    },
    alLatir() {
      if (enfocada && alFrente) intentar(false);
    },
    alCambiarDinero() {
      intentar(true);
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

  useFocusEffect(
    useCallback(() => {
      regla.alEnfocar();
      const latido = setInterval(() => regla.alLatir(), LATIDO_EN_PANTALLA_MS);
      return () => {
        clearInterval(latido);
        regla.alDesenfocar();
      };
    }, [regla]),
  );

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => regla.alCambiarEstado(estado));
    const quitar = suscribirCambioDeDinero(() => regla.alCambiarDinero());
    return () => {
      suscripcion.remove();
      quitar();
    };
  }, [regla]);

  return vueltas;
}

/**
 * Tirar hacia abajo para recargar: siempre recarga (no pasa por el limitador) y mantiene la rueda girando mientras
 * dura. Se pasa tal cual a `<Screen {...tirar}>`.
 */
export function useTirarParaRecargar(recargar: () => unknown): { onRefresh: () => void; refreshing: boolean } {
  const [refreshing, setRefreshing] = useState(false);
  const ultimo = useRef(recargar);
  ultimo.current = recargar;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.resolve()
      .then(() => ultimo.current())
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, []);
  return { onRefresh, refreshing };
}
