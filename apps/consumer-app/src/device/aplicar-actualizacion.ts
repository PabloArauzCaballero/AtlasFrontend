/**
 * Aplicar la actualización al ABRIR la app, ANTES de la animación de arranque. Nunca después.
 *
 * Con la configuración de fábrica, `expo-updates` baja el update en segundo plano y lo aplica la VEZ SIGUIENTE que se abre
 * la app; quien la abre una sola vez ve «lo mismo de antes» (Pablo, 2026-10-07). Por eso se pregunta al arrancar.
 *
 * ## Por qué ahora se decide ANTES de animar (2026-10-08)
 *
 * La primera versión preguntaba EN PARALELO a la animación: la animación arrancaba, llegaba el update, `reloadAsync`
 * reiniciaba el JavaScript a mitad del logo y la animación volvía a empezar desde cero. Pablo: «la transición inicial se
 * duplica y se pone lenta, en celulares nuevos y antiguos». Además las dos cargas competían por el mismo hilo.
 *
 * Regla, que la prueba `arranque-sin-doble-animacion` hace cumplir:
 *
 * 1. Mientras se pregunta, se queda el splash NATIVO (una imagen quieta, el mismo logo): no hay animación que cortar.
 * 2. Si hay update y llega a tiempo, se recarga AHÍ, todavía bajo el splash nativo. La animación sólo se ve una vez, ya
 *    con el código nuevo.
 * 3. Si la red tarda más que `ESPERA_MS`, se arranca con lo que hay y el update se sigue bajando en segundo plano para la
 *    próxima apertura. **Una vez que la animación empezó, la app no se recarga nunca**: lo descargado espera.
 *
 * Sin red o con cualquier fallo la app sigue con el código que ya tiene: una actualización nunca puede impedir abrirla.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

/** Lo que se necesita de `expo-updates`, para probar el flujo sin dispositivo. */
export type Actualizador = Pick<typeof Updates, 'checkForUpdateAsync' | 'fetchUpdateAsync' | 'reloadAsync'>;

/** Cuánto se espera, como mucho, a saber si hay update y bajarlo, con el splash nativo puesto. */
export const ESPERA_MS = 2500;

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

const TIEMPO_AGOTADO = Symbol('tiempo agotado');

/**
 * Decide el arranque: `'recarga'` si se recargó con el update (bajo el splash nativo) o `'seguir'` para animar y entrar.
 *
 * Si se agota la espera, lo que esté en curso sigue en segundo plano pero ya NO puede recargar: `puedeRecargar` se apaga
 * en el mismo instante en que se decide seguir.
 */
export async function decidirArranque(u: Actualizador, esperaMs = ESPERA_MS): Promise<'recarga' | 'seguir'> {
  let puedeRecargar = true;
  const proceso = (async () => {
    try {
      const hay = await u.checkForUpdateAsync();
      if (!hay.isAvailable) return 'seguir' as const;
      const bajado = await u.fetchUpdateAsync();
      // Bajado tarde: queda guardado y entra en la próxima apertura, sin cortar nada.
      if (!bajado.isNew || !puedeRecargar) return 'seguir' as const;
      await u.reloadAsync();
      return 'recarga' as const;
    } catch {
      return 'seguir' as const;
    }
  })();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<typeof TIEMPO_AGOTADO>((resolve) => {
    temporizador = setTimeout(() => resolve(TIEMPO_AGOTADO), esperaMs);
  });
  const r = await Promise.race([proceso, plazo]);
  clearTimeout(temporizador);
  if (r === TIEMPO_AGOTADO) {
    puedeRecargar = false;
    return 'seguir';
  }
  return r;
}

/**
 * Una vez por arranque, desde la raíz. Devuelve `true` cuando ya se puede quitar el splash nativo y animar.
 * En desarrollo, en web o sin actualizaciones activas, es `true` desde el primer render.
 */
export function useArranqueDecidido(): boolean {
  const sinUpdates = __DEV__ || Platform.OS === 'web' || !Updates.isEnabled;
  const [decidido, setDecidido] = useState(sinUpdates);
  useEffect(() => {
    if (sinUpdates) return;
    let vivo = true;
    void decidirArranque(Updates).then((r) => {
      // Con `'recarga'` el JS se reinicia: no hay nada que mostrar en este.
      if (vivo && r === 'seguir') setDecidido(true);
    });
    return () => {
      vivo = false;
    };
  }, [sinUpdates]);
  return decidido;
}
