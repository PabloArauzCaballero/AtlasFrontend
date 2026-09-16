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
import { cargarAvisos } from './avisos-modulo';
import { Platform } from 'react-native';
import * as customerApi from '../api/endpoints/customer';

export type EstadoAvisos = 'concedido' | 'denegado' | 'no-disponible';

/**
 * El canal de Android.
 *
 * Desde Android 8 **toda** notificacion pertenece a un canal, y una que llega para un canal que no
 * existe se descarta: no se ve, no suena y no queda rastro en ningun log de la app. Es el fallo mas
 * caro de este dominio porque se parece exactamente a «el servidor no envio nada», y lleva a buscar
 * el problema en el backend.
 *
 * El identificador viaja tambien en el mensaje que manda el servidor; si algun dia cambia aqui, hay
 * que cambiarlo alli.
 */
const CANAL_AVISOS = 'default';

/**
 * Que hacer cuando llega un aviso **con la app abierta**.
 *
 * Sin esto, Android e iOS entregan la notificacion al proceso y no la enseñan: el sistema asume que
 * una app en primer plano ya esta mostrando lo que sea que la notificacion anuncia. Para una app de
 * credito eso es falso —el aviso puede ser de una cuota que vence mientras miras otra pantalla—, y
 * el sintoma es «los avisos solo llegan con la app cerrada», que suena a bug del servidor.
 *
 * `shouldShowBanner` y `shouldShowList` son la API nueva; `shouldShowAlert`, que hacia las dos
 * cosas, esta marcada como obsoleta en esta version.
 */
const avisosAlArrancar = cargarAvisos();
avisosAlArrancar?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Crea el canal de Android si no existia. En iOS no hay canales y no hace nada.
 *
 * Se llama al arrancar la app, no al conceder el permiso: el canal tiene que existir **antes** de
 * que llegue el primer mensaje, y puede llegar en un dispositivo donde el permiso ya se concedio en
 * una sesion anterior, sin que nadie vuelva a pasar por la pantalla de avisos.
 */
export async function prepararAvisos(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = cargarAvisos();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL_AVISOS, {
      name: 'Avisos de Atlas',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2BE0A8',
    });
  } catch {
    /*
      Un canal que no se puede crear no puede impedir que la app arranque. Lo unico que se pierde
      son los avisos, y el resto de la app no depende de ellos.
    */
  }
}

/**
 * Pide el permiso —si no estaba ya decidido— y registra el dispositivo.
 *
 * Devuelve el estado para que la pantalla pueda decir la verdad: un interruptor encendido con el
 * permiso denegado es una promesa que el sistema operativo no va a cumplir.
 */
export async function activarAvisos(customerId: string): Promise<EstadoAvisos> {
  // En el navegador no hay avisos push de Atlas (haría falta Web Push con su propio registro): se dice, no se finge.
  if (Platform.OS === 'web') return 'no-disponible';
  /*
    En un simulador no hay push: Apple no emite tokens para un dispositivo que no existe. Se sale
    antes de pedir permiso para no dejar registrado un «denegado» que no lo es.
  */
  if (!Device.isDevice) return 'no-disponible';
  /*
    En Expo Go no hay avisos remotos desde el SDK 53 (ver `avisos-modulo.ts`). Se informa igual que
    un simulador: no se puede, y la pantalla ya sabe decirlo sin prometer nada.
  */
  const Notifications = cargarAvisos();
  if (!Notifications) return 'no-disponible';

  try {
    const actual = await Notifications.getPermissionsAsync();
    const decidido = actual.granted ? actual : await Notifications.requestPermissionsAsync();
    if (!decidido.granted) return 'denegado';

    await prepararAvisos();
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
  if (Platform.OS === 'web') return 'no-disponible';
  if (!Device.isDevice) return 'no-disponible';
  const Notifications = cargarAvisos();
  if (!Notifications) return 'no-disponible';
  try {
    const permiso = await Notifications.getPermissionsAsync();
    if (permiso.granted) return 'concedido';
    return permiso.status === 'undetermined' ? 'no-disponible' : 'denegado';
  } catch {
    return 'no-disponible';
  }
}
