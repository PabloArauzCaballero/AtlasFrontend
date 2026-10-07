/**
 * Carga de `expo-notifications`, que NO se puede importar en Expo Go.
 *
 * ## El fallo que esto evita
 *
 * Desde el SDK 53, Expo Go no trae las notificaciones remotas, y el módulo **lanza al evaluarse**:
 *
 *     expo-notifications: Android Push notifications (remote notifications) functionality provided
 *     by expo-notifications was removed from Expo Go with the release of SDK 53.
 *
 * Como el `import` estaba arriba de `permissions.ts` y de `push.ts`, y `session.tsx` los usa, la
 * excepción salía al CARGAR el módulo. expo-router carga todas las rutas, así que cada una fallaba
 * con «missing the required default export» y la app moría con
 * `Cannot read property 'ErrorBoundary' of undefined`: pantalla en blanco antes de pintar nada, sin
 * una sola pista de que el culpable eran los avisos. Medido en el emulador el 2026-09-13.
 *
 * Es el mismo patrón —y el mismo motivo— que `expo-maps` en `src/ui/mapa-punto.tsx`: un módulo que
 * no viaja dentro de Expo Go se carga de forma perezosa y sólo donde existe. **El binario propio de
 * Atlas no cambia**: allí `esExpoGo` es `false` y los avisos funcionan igual que antes.
 */
import { esExpoGo } from './entorno';

export type ModuloDeAvisos = typeof import('expo-notifications');

/**
 * `undefined` es «todavía no se ha intentado» y `null` es «aquí no hay avisos». Hacen falta los dos:
 * sin ellos, cada llamada reintentaría un `require` que ya se sabe que falla.
 */
let modulo: ModuloDeAvisos | null | undefined;

/** Sólo para pruebas: olvida lo ya resuelto. */
export function olvidarModuloDeAvisos(): void {
  modulo = undefined;
}

export function cargarAvisos(): ModuloDeAvisos | null {
  if (modulo !== undefined) return modulo;

  if (esExpoGo) {
    modulo = null;
    return modulo;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require('expo-notifications') as ModuloDeAvisos;
  } catch {
    /*
      No debería ocurrir en el binario propio, pero unos avisos que no cargan no pueden tumbar la
      app: quien la usa sigue pudiendo pedir su crédito, sólo que sin notificaciones.
    */
    modulo = null;
  }
  return modulo;
}
