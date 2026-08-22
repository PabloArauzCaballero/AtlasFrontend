/**
 * El permiso de avisos y el registro del dispositivo para recibirlos.
 *
 * ## El hueco que cierra
 *
 * `POST /customers/:id/device-tokens` existia en el backend y en la capa de API de la app, y **no
 * lo llamaba nadie**. Es decir: la pantalla «Cómo te avisamos» dejaba elegir por que canal recibir
 * cada aviso y el push no podia llegar a ningun sitio, porque el servidor no tenia a donde
 * enviarlo. La preferencia se guardaba y no se cumplia, que es peor que no ofrecerla.
 *
 * ## Cuando se pide el permiso
 *
 * En la pantalla de avisos, al encender el primero, no al arrancar la app. Es el momento en que la
 * persona esta diciendo «avisame de esto»: preguntarle ahi tiene respuesta, y preguntarle en el
 * arranque —cuando todavia no sabe de que va— es como se consigue un «no» permanente. iOS solo
 * pregunta una vez.
 *
 * ## Que se manda
 *
 * El token de push y la plataforma. Ningun identificador de hardware: el token lo emite el sistema
 * operativo, cambia cuando quiere y se puede revocar desde los ajustes, que es exactamente lo que
 * debe poder hacerse con la direccion a la que alguien nos deja escribirle.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as customerApi from '../api/endpoints/customer';

export type EstadoAvisos = 'concedido' | 'denegado' | 'no-disponible';

/**
 * Pide el permiso —si no estaba ya decidido— y registra el dispositivo.
 *
 * Devuelve el estado para que la pantalla pueda decir la verdad: un interruptor encendido con el
 * permiso denegado es una promesa que el sistema operativo no va a cumplir.
 */
export async function activarAvisos(customerId: string): Promise<EstadoAvisos> {
  /*
    En un simulador no hay push: Apple no emite tokens para un dispositivo que no existe. Se sale
    antes de pedir permiso para no dejar registrado un «denegado» que no lo es.
  */
  if (!Device.isDevice) return 'no-disponible';

  try {
    const actual = await Notifications.getPermissionsAsync();
    const decidido = actual.granted ? actual : await Notifications.requestPermissionsAsync();
    if (!decidido.granted) return 'denegado';

    const token = await Notifications.getDevicePushTokenAsync();
    await customerApi.registerDeviceToken(customerId, {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      token: String(token.data),
    });
    return 'concedido';
  } catch {
    /*
      Fallar aqui no puede impedir guardar la preferencia. El token se puede reintentar la proxima
      vez que se abra esta pantalla; lo que no se puede es que un problema de red deje a la persona
      sin poder elegir como quiere que le avisemos.
    */
    return 'no-disponible';
  }
}

/** Lo que ya decidio el sistema, sin preguntar nada. */
export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (!Device.isDevice) return 'no-disponible';
  try {
    const permiso = await Notifications.getPermissionsAsync();
    if (permiso.granted) return 'concedido';
    return permiso.status === 'undetermined' ? 'no-disponible' : 'denegado';
  } catch {
    return 'no-disponible';
  }
}
