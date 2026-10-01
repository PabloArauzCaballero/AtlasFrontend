/**
 * Lo que la tarea de segundo plano necesita saber y no puede preguntarle a React.
 *
 * ## Por que existe este archivo
 *
 * Cuando el sistema despierta la app para entregar una posicion, carga el bundle y **no monta
 * ninguna pantalla**: no hay `SessionProvider`, no hay contexto y no hay estado. La tarea necesita
 * tres datos —de quien es la sesion, con que dispositivo y en que sesion de telemetria— y el unico
 * sitio donde puede leerlos es el almacenamiento.
 *
 * ## Por que AsyncStorage y no SecureStore
 *
 * Porque ninguno de los tres es un secreto: son identificadores internos que ya viajan en cada
 * peticion, y que solos no autentican nada. Lo que SI es secreto —los tokens— sigue en el almacen
 * seguro, y esta tarea lo lee a traves del mismo puerto que el resto de la app. Meter esto en
 * SecureStore obligaria a desbloquear el llavero en cada despertar en segundo plano, que en iOS con
 * el telefono bloqueado a veces sencillamente falla.
 *
 * ## Se borra al cerrar sesion, y eso apaga el rastreo
 *
 * Si la tarea no encuentra contexto, se apaga sola. Es la red de seguridad para el caso que de otro
 * modo seria invisible: un rastreo que quedo instalado en el sistema despues de un cierre de sesion
 * y sigue mandando posiciones de alguien que ya no esta.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { borrarHistorial } from './historial-ubicaciones';

const KEY = 'atlas.tracking.context';

export type ContextoDeRastreo = {
  customerId: string;
  deviceId: string;
  /** La sesion de telemetria abierta, si la hay. En segundo plano casi nunca la hay. */
  sessionId: string | null;
};

export async function guardarContextoDeRastreo(contexto: ContextoDeRastreo): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(contexto)).catch(() => undefined);
}

export async function leerContextoDeRastreo(): Promise<ContextoDeRastreo | null> {
  try {
    const crudo = await AsyncStorage.getItem(KEY);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Partial<ContextoDeRastreo>;
    // Se valida al leer y no se confia en lo escrito: una version anterior de la app pudo guardar
    // otra forma, y un `undefined` en la URL produce una peticion a `/customers/undefined/...`.
    if (typeof valor.customerId !== 'string' || typeof valor.deviceId !== 'string') return null;
    return { customerId: valor.customerId, deviceId: valor.deviceId, sessionId: valor.sessionId ?? null };
  } catch {
    return null;
  }
}

export async function borrarContextoDeRastreo(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
  // Quien cierra sesion no deja su rastro en un telefono que puede ser de otro.
  await borrarHistorial();
}
