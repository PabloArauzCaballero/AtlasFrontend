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
 * ## Los que faltan
 *
 * `contacts` y `notifications` estan en el contrato del backend y no se consultan aqui porque sus
 * modulos —`expo-contacts`, `expo-notifications`— no son dependencias del proyecto. Añadirlos exige
 * recompilar el binario, no basta con recargar el JS. Mientras tanto se informa de lo que se sabe:
 * decir «denegado» sobre un permiso que ni siquiera se ha consultado seria peor que callar, porque
 * el riesgo lee esa negativa como una decision de la persona.
 */
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

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
  ]);

  return reportes;
}
