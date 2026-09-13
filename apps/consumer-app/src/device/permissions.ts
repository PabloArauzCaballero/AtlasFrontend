/**
 * Que permisos del sistema tiene la app, y como se le cuentan al backend.
 *
 * ## Por que existe
 *
 * `POST /customer-onboarding/start` acepta un bloque `permissions` y el backend lo guarda en
 * `telemetry.permission_events`. La app **no lo enviaba nunca**: se comprobo sobre el alta real del
 * cliente 6 y esa tabla no tenia ni una fila suya. El expediente nacia sin una senal que el modelo
 * antifraude si espera —quien concede camara y ubicacion en el alta se comporta distinto de quien
 * las niega todas— y, mas simple todavia, sin forma de saber por que a alguien no le llegan los
 * avisos.
 *
 * ## Lo que este archivo NO hace: pedir permisos
 *
 * Usa las funciones `get*PermissionsAsync`, que **consultan** el estado sin abrir ningun dialogo.
 * Pedir un permiso al arrancar, sin que la persona haya intentado hacer nada que lo necesite, es la
 * forma mas fiable de que lo niegue para siempre: iOS solo pregunta UNA vez, y una negativa
 * temprana convierte «tomar la foto del carnet» en un viaje a los ajustes del sistema. Cada permiso
 * se pide donde se usa; aqui solo se lee lo que ya haya decidido.
 *
 * ## Los cinco del contrato
 *
 * Se informan los cinco codigos que acepta el backend: `camera`, `location`, `storage`, `contacts`
 * y `notifications`. Los dos ultimos entraron despues, al añadir `expo-contacts` y
 * `expo-notifications`; hasta entonces no se consultaban y el expediente nacia sin saber si esta
 * persona acepta que le avisemos de sus cuotas, que es justo la señal que explica por que a alguien
 * no le llegan los avisos.
 */
import { Camera } from 'expo-camera';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { cargarAvisos } from './avisos-modulo';

/** Los codigos que acepta el backend (`ALLOWED_PERMISSION_CODES`). */
export type PermissionCode = 'location' | 'camera' | 'contacts' | 'notifications' | 'storage';

export type PermissionReport = { permissionCode: PermissionCode; granted: boolean; decidedAt?: string };

/**
 * El estado actual de los permisos que la app sabe consultar.
 *
 * Solo informa de los que la persona **ya decidio**: un permiso en estado `undetermined` —nunca
 * preguntado— no es un «no», y contarlo como tal ensuciaria la señal justo al principio del
 * expediente, que es cuando todavia no se ha pedido ninguno.
 */
export async function permisosDecididos(): Promise<PermissionReport[]> {
  const ahora = new Date().toISOString();
  const reportes: PermissionReport[] = [];

  const añadir = (permissionCode: PermissionCode, estado: { granted: boolean; status: string }) => {
    if (estado.status === 'undetermined') return;
    reportes.push({ permissionCode, granted: estado.granted, decidedAt: ahora });
  };

  // Cada consulta se aisla: que un modulo falle —o no este disponible en este binario— no puede
  // impedir que se informe de los demas, y mucho menos tumbar el alta.
  await Promise.all([
    Camera.getCameraPermissionsAsync()
      .then((estado) => añadir('camera', estado))
      .catch(() => undefined),
    Location.getForegroundPermissionsAsync()
      .then((estado) => añadir('location', estado))
      .catch(() => undefined),
    ImagePicker.getMediaLibraryPermissionsAsync()
      .then((estado) => añadir('storage', estado))
      .catch(() => undefined),
    Contacts.getPermissionsAsync()
      .then((estado) => añadir('contacts', estado))
      .catch(() => undefined),
    /*
      Las notificaciones traen su propia forma: no hay `granted` booleano sino un `status` y, en
      iOS, un detalle de que se autorizo exactamente —alerta, sonido, insignia—. Se normaliza a lo
      que el backend entiende: concedido si el sistema dice `granted`.
    */
    /*
      `cargarAvisos()` puede devolver `null`: en Expo Go el módulo no existe (ver `avisos-modulo.ts`).
      Entonces NO se informa nada de este permiso, que es lo correcto — decir «denegado» sobre algo
      que el anfitrión ni siquiera sabe preguntar ensuciaría el expediente con una decisión que la
      persona no tomó.
    */
    (cargarAvisos()?.getPermissionsAsync() ?? Promise.resolve(null))
      .then((estado) => (estado ? añadir('notifications', { granted: estado.granted, status: estado.status }) : undefined))
      .catch(() => undefined),
  ]);

  return reportes;
}

/* ----------------------------------------------------------- pedir, no leer */

/**
 * Pide el permiso de CONTACTOS, con dialogo del sistema.
 *
 * Es la unica funcion de este archivo que abre un dialogo, y esta aqui —y no en `device/contacts.ts`—
 * porque la pantalla de arranque pide los dos permisos juntos y no tiene por que saber en que modulo
 * vive cada uno. La lectura de la agenda sigue viviendo alli.
 *
 * Devuelve `false` ante cualquier fallo del modulo: no poder preguntar es, a efectos de lo que la
 * app hara despues, lo mismo que un no.
 */
export async function pedirPermisoDeContactos(): Promise<boolean> {
  try {
    const estado = await Contacts.requestPermissionsAsync();
    return estado.granted === true;
  } catch {
    return false;
  }
}
