/**
 * Aplicar la actualización al ABRIR la app, no al segundo arranque.
 *
 * Con la configuración de fábrica, `expo-updates` baja el update en segundo plano y lo aplica la VEZ SIGUIENTE que se abre
 * la app. En la práctica hay que abrirla dos veces, y quien la abre una sola ve «lo mismo de antes» y concluye que el
 * arreglo no llegó (Pablo, 2026-10-07: «se ve igual que antes»). Aquí se pregunta al arrancar y, si hay uno nuevo, se baja
 * y se recarga una sola vez.
 *
 * Sólo en el teléfono y sólo con actualizaciones activas: en desarrollo y en web no hace nada. Sin red o con cualquier
 * fallo la app sigue con el código que ya tiene: una actualización nunca puede impedir abrirla.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

/** Lo que se necesita de `expo-updates`, para probar el flujo sin dispositivo. */
export type Actualizador = Pick<typeof Updates, 'checkForUpdateAsync' | 'fetchUpdateAsync' | 'reloadAsync'>;

/** `true` si había un update nuevo y se pidió la recarga. */
export async function aplicarActualizacionPendiente(u: Actualizador): Promise<boolean> {
  try {
    const hay = await u.checkForUpdateAsync();
    if (!hay.isAvailable) return false;
    const bajado = await u.fetchUpdateAsync();
    if (!bajado.isNew) return false;
    await u.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

/** Una vez por arranque, desde la raíz. */
export function useAplicarActualizacionAlAbrir(): void {
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    void aplicarActualizacionPendiente(Updates);
  }, []);
}
