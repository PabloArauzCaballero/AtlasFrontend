/**
 * La APARIENCIA que eligio la persona: claro u oscuro. Se recuerda entre aperturas.
 *
 * ## Por que se lee de forma SINCRONA
 *
 * Las pantallas construyen sus estilos con `StyleSheet.create` al cargar el modulo, asi que el tema
 * tiene que estar decidido ANTES de que se importe la primera pantalla. Por eso se lee con
 * `SecureStore.getItem` (sincrono) en el telefono y `localStorage` en la web, y no con AsyncStorage.
 * Asi, si alguien eligio oscuro, la app arranca en oscuro desde el primer fotograma —incluido el
 * arranque de marca—, sin un destello claro (pedido de Pablo, 2026-10-09).
 *
 * ## Por que cambiar recarga la app
 *
 * Por lo mismo: los estilos ya estan construidos. Se guarda la eleccion y se recarga el bundle (en
 * el telefono con `expo-updates`, en la web recargando la pagina); tarda menos de un segundo y es lo
 * que hacen las apps que no redibujan su tema en caliente.
 */
import * as SecureStore from 'expo-secure-store';
import { DevSettings, Platform } from 'react-native';
import type { Esquema } from './temas';

const CLAVE = 'atlas.apariencia';

const esEsquema = (v: unknown): v is Esquema => v === 'claro' || v === 'oscuro';

/** Lo guardado, o `null` si nunca se eligio (entonces manda el claro: la entrada es en blanco). */
export function leerEsquemaGuardado(): Esquema | null {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(CLAVE) : SecureStore.getItem(CLAVE);
    return esEsquema(v) ? v : null;
  } catch {
    return null;
  }
}

export function guardarEsquema(esquema: Esquema): void {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(CLAVE, esquema);
    else SecureStore.setItem(CLAVE, esquema);
  } catch {
    // Sin almacen (navegacion privada, llavero bloqueado): la eleccion vale hasta cerrar la app.
  }
}

/** Guarda la eleccion y recarga para que todos los estilos se construyan con el tema nuevo. */
export async function aplicarEsquema(esquema: Esquema): Promise<void> {
  guardarEsquema(esquema);
  if (Platform.OS === 'web') {
    globalThis.location?.reload();
    return;
  }
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
