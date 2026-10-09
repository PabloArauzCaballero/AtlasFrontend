/**
 * La UBICACION del telefono: pedir el permiso, medir, y mantener el rastreo.
 *
 * ## Los DOS permisos, que no son el mismo
 *
 * El sistema distingue «mientras se usa» de «siempre», y son dos dialogos distintos que hay que
 * pedir en ese orden: iOS ni siquiera ofrece el segundo si no se concedio el primero. Aqui se piden
 * asi y se informa de los dos por separado, porque conceder uno y negar el otro es una decision
 * legitima y frecuente — y la app tiene que seguir funcionando en ese caso.
 *
 * El de «siempre» habilita el rastreo con la app CERRADA. Si se niega, el rastreo sigue existiendo
 * pero solo con la app abierta: es menos senal, no un fallo, y en ningun sitio se le insiste a nadie.
 *
 * ## Por que la tarea de segundo plano se declara ARRIBA DEL TODO
 *
 * `TaskManager.defineTask` tiene que ejecutarse en el ambito del modulo y ANTES de que el sistema
 * entregue el primer evento. Cuando Android o iOS despiertan la app por una posicion nueva, cargan
 * el bundle y buscan la tarea por su nombre: si la definicion viviera dentro de una funcion que
 * nadie llamo todavia, el evento llegaria a una tarea que no existe y el sistema registraria el
 * fallo sin que en la app se vea nada.
 *
 * ## Lo que la tarea de segundo plano NO puede dar por hecho
 *
 * Que haya arbol de React. El sistema puede despertarla sin montar ninguna pantalla, asi que no hay
 * contexto de sesion del que leer nada: quien es el cliente y con que dispositivo se leen del
 * almacenamiento, y el cliente HTTP se configura a mano. Es la unica parte de la app que no puede
 * apoyarse en `SessionProvider`.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { configureClient } from '../api/client';
import * as deviceSignalsApi from '../api/endpoints/device-signals';
import {
  aPosicionParaEnviar,
  CADENCIA_SEGUNDO_PLANO_MS,
  DISTANCIA_MINIMA_M,
  sinRepetidas,
  TAMANO_LOTE_UBICACION,
  type PosicionDelTelefono,
  type PosicionParaEnviar,
} from '../features/rastreo';
import { secureTokenStore } from '../session/token-storage';
import { anotarEnHistorial } from './historial-ubicaciones';
import { leerContextoDeRastreo, type ContextoDeRastreo } from './tracking-context';
import { color } from '../theme/tokens';

/** El nombre con el que el sistema recuerda la tarea. Cambiarlo deja huerfano el rastreo instalado. */
export const TAREA_UBICACION = 'atlas-location-tracking';

export type PermisosDeUbicacion = { primerPlano: boolean; segundoPlano: boolean };

/**
 * Manda el lote y no deja que un fallo de red tumbe nada.
 *
 * Se usa desde la tarea de segundo plano y desde el rastreo en primer plano. Devuelve si llego, para
 * que quien acumula sepa si puede vaciar su cola.
 */
async function enviarLote(contexto: ContextoDeRastreo, posiciones: readonly PosicionParaEnviar[]): Promise<boolean> {
  // Se anota en el telefono ANTES de subir y aunque la subida falle: es lo que alimenta «los sitios
  // que frecuentas» del domicilio, y no depende de que haya red.
  await anotarEnHistorial(posiciones.map((posicion) => ({ lat: posicion.lat, lng: posicion.lng, at: posicion.capturedAt })));
  const utiles = sinRepetidas(posiciones).slice(0, TAMANO_LOTE_UBICACION);
  if (utiles.length === 0) return true;
  try {
    await deviceSignalsApi.enviarPosiciones(contexto.customerId, {
      deviceId: contexto.deviceId,
      sessionId: contexto.sessionId,
      pings: utiles,
    });
    return true;
  } catch {
    /*
      En silencio, y a proposito. Registrar una posicion es una anotacion: si el servidor no responde
      —o si el consentimiento ya no esta vigente y contesta 422— no puede impedir que alguien entre a
      ver cuanto debe. Lo que se pierde es una medida, y la siguiente llega en quince minutos.
    */
    return false;
  }
}

/*
  La tarea, definida en el ambito del modulo.

  Se envuelve en una comprobacion de `TaskManager.isTaskDefined` porque este modulo se puede importar
  dos veces bajo Fast Refresh, y definir la misma tarea dos veces avisa por consola en cada guardado.
*/
if (!TaskManager.isTaskDefined(TAREA_UBICACION)) {
  TaskManager.defineTask<{ locations?: PosicionDelTelefono[] }>(TAREA_UBICACION, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;

    /*
      El cliente HTTP se configura AQUI.

      `SessionProvider` lo configura en un efecto, y en un arranque en segundo plano ese efecto puede
      no haber corrido nunca: el sistema carga el bundle para entregar la posicion y no monta
      pantalla ninguna. Sin esta linea, la peticion saldria sin cabecera de autorizacion y el
      servidor la rechazaria con un 401 que nadie ve.
    */
    configureClient({ tokenStore: secureTokenStore });

    const contexto = await leerContextoDeRastreo();
    // Sin contexto no hay a quien atribuir la posicion: la sesion se cerro, o el rastreo quedo
    // instalado en el sistema despues de un cierre de sesion. Se apaga en vez de acumular basura.
    if (!contexto) {
      await detenerRastreoEnSegundoPlano();
      return;
    }

    const posiciones = data.locations
      .map((posicion) => aPosicionParaEnviar(posicion, 'background'))
      .filter((posicion): posicion is PosicionParaEnviar => posicion !== null);
    await enviarLote(contexto, posiciones);
  });
}

/**
 * Pide el permiso de ubicacion «mientras se usa». NUNCA el de «siempre».
 *
 * Los dos van por separado, y no es puntillismo: en Android 11+ pedir el de segundo plano no abre un
 * dialogo, **saca a la persona de la app y la deja en la pantalla de Ajustes del sistema**. Se
 * comprobo en el emulador: concede «Mientras uso la app» y aparece «Location permission» de Android,
 * sin explicacion y en mitad del alta. Encadenarlo aqui tenia dos consecuencias feas: el dialogo de
 * contactos que viene detras se pedia con Ajustes por encima, y la persona se quedaba fuera de la
 * app sin saber por que.
 *
 * Quien quiera «siempre» pasa por `pedirPermisoDeSegundoPlano`, que se llama desde un boton que lo
 * anuncia. Un fallo del modulo devuelve `false`, que es lo mismo que negarlo: menos señal, nunca un
 * bloqueo.
 */
export async function pedirPermisoDeUbicacion(): Promise<boolean> {
  try {
    const primerPlano = await Location.requestForegroundPermissionsAsync();
    return primerPlano.granted === true;
  } catch {
    return false;
  }
}

/**
 * Pide el «siempre», que es lo que habilita el rastreo con la app cerrada.
 *
 * En iOS es un dialogo mas —aunque el sistema lo muestra a SU ritmo, no durante esta llamada: ver
 * `session/device-signals.ts`, que por eso no se fia del valor devuelto—. En Android abre los
 * Ajustes del sistema, asi que quien llame a esto tiene que haberlo dicho antes.
 *
 * Solo tiene sentido con el de primer plano ya concedido: sin el, iOS ni pregunta.
 */
export async function pedirPermisoDeSegundoPlano(): Promise<boolean> {
  try {
    const estado = await Location.requestBackgroundPermissionsAsync();
    return estado.granted === true;
  } catch {
    return false;
  }
}

/** Que permisos hay ahora, sin abrir ningun dialogo. */
export async function permisosDeUbicacion(): Promise<PermisosDeUbicacion> {
  const [primerPlano, segundoPlano] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => ({ granted: false })),
    Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false })),
  ]);
  return { primerPlano: primerPlano.granted === true, segundoPlano: segundoPlano.granted === true };
}

/**
 * UNA posicion, ahora.
 *
 * `Balanced` y no `Highest`: la precision maxima enciende el GPS y tarda segundos en fijar, y para
 * saber en que barrio esta alguien sobran cien metros. `Highest` se reserva para el domicilio, que
 * se mide una vez y con la persona mirando la pantalla.
 */
export async function posicionActual(
  modo: PosicionParaEnviar['captureMode'] = 'foreground',
): Promise<PosicionParaEnviar | null> {
  try {
    const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return aPosicionParaEnviar(posicion as PosicionDelTelefono, modo);
  } catch {
    return null;
  }
}

/** Mide una vez y la manda. Es lo que se llama al abrir sesion y cada vez que toca en primer plano. */
export async function medirYEnviar(
  contexto: ContextoDeRastreo,
  modo: PosicionParaEnviar['captureMode'] = 'foreground',
): Promise<boolean> {
  const posicion = await posicionActual(modo);
  if (!posicion) return false;
  return enviarLote(contexto, [posicion]);
}

/**
 * Enciende el rastreo con la app CERRADA.
 *
 * No hace nada sin el permiso de «siempre», y tampoco en web, donde `startLocationUpdatesAsync` no
 * existe. Es idempotente: si la tarea ya estaba corriendo no se reinstala, porque reinstalarla
 * reinicia el temporizador del sistema y en la practica retrasa la siguiente medida.
 */
export async function iniciarRastreoEnSegundoPlano(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const permisos = await permisosDeUbicacion();
  if (!permisos.segundoPlano) return false;

  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) return true;

    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: CADENCIA_SEGUNDO_PLANO_MS,
      distanceInterval: DISTANCIA_MINIMA_M,
      // El sistema agrupa varias posiciones y las entrega juntas: menos despertares del bundle para
      // la misma informacion, que es lo que decide si el rastreo se nota en la bateria.
      deferredUpdatesInterval: CADENCIA_SEGUNDO_PLANO_MS,
      deferredUpdatesDistance: DISTANCIA_MINIMA_M,
      pausesUpdatesAutomatically: false,
      /*
        La notificacion permanente NO es un adorno: Android la exige para un servicio en primer plano
        con ubicacion, y sin ella el sistema mata el servicio a los pocos minutos. Que la persona vea
        siempre que la app esta midiendo es, ademas, lo unico honesto.
      */
      foregroundService: {
        notificationTitle: 'Atlas está activo',
        notificationBody: 'Registrando tu ubicación según los permisos que aceptaste.',
        notificationColor: color.brand.navy,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Apaga el rastreo de segundo plano. Se llama al cerrar sesion y al retirar el consentimiento. */
export async function detenerRastreoEnSegundoPlano(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) {
      await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
    }
  } catch {
    // Si no se puede parar —la tarea ya no existe, el modulo fallo— no hay nada que hacer aqui y
    // desde luego no hay nada que contarle a la persona.
  }
}
