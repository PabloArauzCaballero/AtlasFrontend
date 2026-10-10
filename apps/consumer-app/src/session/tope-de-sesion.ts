/**
 * El tope ABSOLUTO de la sesion: 8 h desde el ultimo inicio de sesion con PIN.
 *
 * El bloqueo local (`features/bloqueo-local.ts`) tapa la app y la abre con Face ID; NO renueva la
 * sesion. Pasadas 8 h desde que la persona escribio su PIN para entrar, la app cierra la sesion y pide
 * el inicio completo, aunque se haya usado Face ID cien veces en medio. Es el estandar de la banca
 * movil: la biometria demuestra que el telefono lo tiene su dueño, no que la sesion siga siendo
 * legitima indefinidamente.
 *
 * El backend lo garantiza por su lado (el refresco pasado el tope responde 401 `SESSION_EXPIRED`);
 * esto es la mitad del telefono, para que la persona lo vea a la hora exacta y con un mensaje claro
 * aunque no haya hecho ninguna llamada.
 *
 * ## Lo que se guarda y por que no se fia de nada mas
 *
 * La hora del inicio con PIN, en el telefono. Sin ese dato —una sesion abierta con una version
 * anterior de la app, almacenamiento borrado— la sesion se da por vencida: no saber cuando empezo
 * no es saber que fue hace poco. Un reloj que va hacia atras (la persona atraso la hora para
 * estirar la sesion) tambien la vence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOPE_DE_SESION_MS = 8 * 60 * 60 * 1000;

/** Lo que se le dice a la persona en la pantalla de entrada cuando la sesion vencio por el tope. */
export const MENSAJE_SESION_CADUCADA = 'Por seguridad, tu sesión dura 8 horas. Vuelve a entrar con tu PIN.';
/** Cuando el servidor rechazo la sesion por otro motivo (revocada desde otro equipo, PIN cambiado…). */
export const MENSAJE_SESION_CERRADA = 'Tu sesión se cerró. Vuelve a entrar con tu PIN.';

const CLAVE = 'atlas.sesion.inicio-con-pin';

/**
 * Por que se cerro la sesion SIN que la persona lo pidiera. La pantalla de entrada lo dice; un cierre
 * pedido («Cerrar sesión») no deja motivo.
 *  - `sesion_caducada`: el tope de 8 h (el del telefono o el 401 `SESSION_EXPIRED` del servidor).
 *  - `sesion_cerrada`: el servidor rechazo la sesion por otra razon (revocada, PIN cambiado en otro equipo).
 */
export type MotivoDeSalida = 'sesion_caducada' | 'sesion_cerrada';

export function mensajeDeSalida(motivo: MotivoDeSalida | null | undefined): string | null {
  if (motivo === 'sesion_caducada') return MENSAJE_SESION_CADUCADA;
  if (motivo === 'sesion_cerrada') return MENSAJE_SESION_CERRADA;
  return null;
}

export function sesionVencida(inicioConPin: number | null, ahora: number, topeMs = TOPE_DE_SESION_MS): boolean {
  if (inicioConPin === null || !Number.isFinite(inicioConPin)) return true;
  const transcurrido = ahora - inicioConPin;
  return transcurrido < 0 || transcurrido >= topeMs;
}

export async function guardarInicioConPin(ahora = Date.now()): Promise<void> {
  await AsyncStorage.setItem(CLAVE, String(ahora)).catch(() => undefined);
}

export async function leerInicioConPin(): Promise<number | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE);
    if (crudo === null) return null;
    const valor = Number(crudo);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

export async function olvidarInicioConPin(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE).catch(() => undefined);
}
