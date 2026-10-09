/**
 * El bloqueo LOCAL de la app al volver a ella (APP-13).
 *
 * ## Que es y que no es
 *
 * Con la sesion abierta, una app que estuvo mas de cinco minutos en segundo plano se tapa al volver y
 * pide Face ID / Touch ID / huella o, si no hay o falla, el PIN de la cuenta. NO cierra la sesion:
 * los tokens siguen donde estaban y, al desbloquear, la persona sigue exactamente donde lo dejo. Es
 * lo que protege a quien presta el telefono desbloqueado o lo pierde con la app abierta.
 *
 * Tambien se pide al ABRIR la app con una sesion guardada si hace mas de cinco minutos que salio
 * —o si no se sabe cuando salio—: que el sistema matara la app en segundo plano no puede ser la
 * forma de saltarse el bloqueo. Quien acaba de escribir su PIN para entrar no lo vuelve a ver.
 *
 * ## Opcional, y encendido por omision solo si hay biometria
 *
 * La persona lo apaga y lo enciende en Perfil. Mientras no haya decidido nada, esta encendido si el
 * telefono tiene biometria registrada: pedir el PIN de cuatro digitos cada vez que se vuelve a la app,
 * sin que nadie lo haya pedido, convertiria una proteccion en una molestia que se apaga a ciegas.
 *
 * ## Por que aqui y no en la pantalla
 *
 * La regla —cuando se bloquea, cuando se pide— es pura y se prueba en `__tests__/bloqueo-local.test.ts`.
 * El estado (bloqueado o no) vive en el modulo, fuera de React, porque lo tocan la sesion (al entrar
 * con PIN, al salir) y la capa que se dibuja, que estan en sitios distintos del arbol.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Cuanto puede estar la app en segundo plano sin pedir nada al volver. */
export const UMBRAL_BLOQUEO_MS = 5 * 60 * 1000;

const KEY_PREFERENCIA = 'atlas.bloqueo.preferencia';
const KEY_SALIDA = 'atlas.bloqueo.salida-en';

export type PreferenciaDeBloqueo = 'activado' | 'desactivado';

/** Si el bloqueo esta encendido. Sin decision de la persona, lo decide la biometria. */
export function bloqueoActivado(preferencia: PreferenciaDeBloqueo | null, hayBiometria: boolean): boolean {
  if (preferencia === 'activado') return true;
  if (preferencia === 'desactivado') return false;
  return hayBiometria;
}

/**
 * Si hay que pedir el desbloqueo al volver de segundo plano (o al abrir con sesion guardada).
 *
 * `salidaEn` es cuando se fue la app a segundo plano. Sin ese dato —primera apertura con esta
 * version, almacenamiento borrado— se pide: no saber cuanto tiempo paso no es saber que fue poco.
 * Un reloj que va hacia atras (la persona cambio la hora) tambien pide: no se puede fiar.
 */
export function debePedirDesbloqueo(salidaEn: number | null, ahora: number, umbralMs = UMBRAL_BLOQUEO_MS): boolean {
  if (salidaEn === null || !Number.isFinite(salidaEn)) return true;
  const transcurrido = ahora - salidaEn;
  return transcurrido < 0 || transcurrido > umbralMs;
}

/* ------------------------------------------------------------------------------------------------
 * El estado, fuera de React.
 * ---------------------------------------------------------------------------------------------- */

let bloqueada = false;
/** Si la sesion de esta ejecucion se abrio escribiendo el PIN (y no restaurandola del disco). */
let sesionRecienAbierta = false;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((oyente) => oyente());

export function estaBloqueada(): boolean {
  return bloqueada;
}

export function suscribirBloqueo(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function bloquear(): void {
  if (bloqueada) return;
  bloqueada = true;
  avisar();
}

export function desbloquear(): void {
  if (!bloqueada) return;
  bloqueada = false;
  avisar();
}

/** La sesion se abrio con el PIN en esta ejecucion: no se vuelve a pedir al montar el area privada. */
export function marcarSesionRecienAbierta(): void {
  sesionRecienAbierta = true;
  desbloquear();
}

export function sesionAbiertaConPinAhora(): boolean {
  return sesionRecienAbierta;
}

/** Al cerrar sesion: nada que desbloquear y nada que recordar para el siguiente que entre. */
export function olvidarBloqueo(): void {
  sesionRecienAbierta = false;
  desbloquear();
  void AsyncStorage.removeItem(KEY_SALIDA).catch(() => undefined);
}

/* ------------------------------------------------------------------------------------------------
 * Lo que se guarda en el telefono. Nada de esto es secreto: una preferencia y una hora.
 * ---------------------------------------------------------------------------------------------- */

export async function leerPreferenciaDeBloqueo(): Promise<PreferenciaDeBloqueo | null> {
  try {
    const valor = await AsyncStorage.getItem(KEY_PREFERENCIA);
    return valor === 'activado' || valor === 'desactivado' ? valor : null;
  } catch {
    return null;
  }
}

export async function guardarPreferenciaDeBloqueo(preferencia: PreferenciaDeBloqueo): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFERENCIA, preferencia).catch(() => undefined);
  avisarPreferencia();
}

export async function anotarSalida(ahora = Date.now()): Promise<void> {
  await AsyncStorage.setItem(KEY_SALIDA, String(ahora)).catch(() => undefined);
}

export async function leerSalida(): Promise<number | null> {
  try {
    const crudo = await AsyncStorage.getItem(KEY_SALIDA);
    if (crudo === null) return null;
    const valor = Number(crudo);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

/* La capa vuelve a leer la preferencia cuando Perfil la cambia. */
const oyentesPreferencia = new Set<() => void>();
const avisarPreferencia = () => oyentesPreferencia.forEach((oyente) => oyente());

export function suscribirPreferenciaDeBloqueo(oyente: () => void): () => void {
  oyentesPreferencia.add(oyente);
  return () => {
    oyentesPreferencia.delete(oyente);
  };
}
