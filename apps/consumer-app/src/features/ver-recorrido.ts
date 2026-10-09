/**
 * «Ver el recorrido» otra vez, desde Ayuda o Perfil: UN solo camino para los dos botones.
 *
 * Antes cada botón hacía `router.push('/(app)/(tabs)')` y `tour.start(...)` en el mismo instante (Pablo, 2026-10-08:
 * «al darle ver tutorial incluso en celulares nuevos se buguea»). Tres fallos juntos:
 *
 * - `push` APILABA un Inicio nuevo encima de Ayuda en lugar de volver al que ya existía: dos pantallas registraban los
 *   mismos objetivos y el recorrido medía la equivocada.
 * - El recorrido empezaba con la transición de pantalla todavía en marcha: medía los objetivos a mitad del movimiento y el
 *   foco quedaba desplazado, con la tarjeta fuera de la pantalla.
 * - Al volver a Inicio, su arranque automático —la marca de «visto» se acababa de borrar— lanzaba OTRO recorrido encima.
 *
 * Ahora se VUELVE al Inicio existente (`dismissTo` desde una pantalla apilada, `navigate` entre pestañas) y el recorrido
 * arranca cuando la navegación terminó (`startWhenSettled`), que además bloquea cualquier segundo arranque.
 */
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { resetTour, useTour, type TourStep } from '../ui/tour';
import { TOUR_INICIO_KEY } from './tour-inicio';

const INICIO = '/(app)/(tabs)' as const;

export function useVerRecorrido(pasos: TourStep[]): () => void {
  const router = useRouter();
  const tour = useTour();
  const pasosRef = useRef(pasos);
  pasosRef.current = pasos;
  return useCallback(() => {
    void resetTour(TOUR_INICIO_KEY).then(() => {
      if (router.canDismiss()) router.dismissTo(INICIO);
      else router.navigate(INICIO);
      tour.startWhenSettled(pasosRef.current, TOUR_INICIO_KEY);
    });
  }, [router, tour]);
}
