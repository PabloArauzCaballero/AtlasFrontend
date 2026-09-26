/**
 * De donde salio cada captura del carnet, tal como viaja al backend.
 *
 * ## Por que existe
 *
 * El Motor juzga PIXELES, y su forense se calibro con fotos hechas por la camara de la app. El
 * escaner del sistema (VisionKit en iPhone, ML Kit en Android) no entrega una foto: entrega un
 * recorte con la perspectiva corregida y recodificado —y en iPhone, a veces, con el filtro que eligio
 * la persona—. El Motor tiene que saber cual de las dos cosas esta mirando, y la unica pieza que lo
 * sabe es esta app. Por eso la etiqueta.
 *
 * ## El contrato, identico en los tres repos
 *
 * - Valores: `camera` | `system_scanner`. Ausente significa camara (lo que hacian todas las altas
 *   hasta hoy), asi que una fila vieja y una nueva sin etiqueta se leen igual.
 * - `POST /customer-onboarding/:id/documents/upload-url` → `captureSource`.
 * - `POST /customer-onboarding/:id/identity-package` → `captureSource` en cada evidencia.
 * - `POST /mobile/identity-verifications` → `documentCaptureSource`, el origen del ANVERSO (ver `origenDelDocumento`).
 *
 * ## Por que SOLO con la bandera encendida
 *
 * Los esquemas de esas tres rutas son `.strict()`: un backend que aun no conozca el campo contesta
 * 400 y el alta se corta en el carnet. Con la bandera apagada los cuerpos tienen que ser, byte a
 * byte, los de siempre; las funciones de aqui devuelven `{}` y el `...` no añade nada.
 */
import { escanerDocumentoActivado } from '../api/config';

export type OrigenCaptura = 'camera' | 'system_scanner';

/** El campo `captureSource`, o nada si la bandera esta apagada o no se sabe el origen. */
export function campoCaptureSource(
  origen: OrigenCaptura | undefined,
  activado: boolean = escanerDocumentoActivado,
): { captureSource?: OrigenCaptura } {
  return activado && origen ? { captureSource: origen } : {};
}

/**
 * El origen del ANVERSO para el Motor.
 *
 * El Motor recorta, lee el retrato y hace la forense sobre el ANVERSO; el reverso solo aporta la MRZ.
 * Por eso lo que decide como juzgar la imagen es de donde salio el anverso, y no «si alguna de las
 * dos caras lo fue»: con el anverso hecho con la camara y el reverso escaneado (porque el escaner
 * fallo a la primera cara y anduvo en la segunda), decir «escaner» haria que el Motor se saltara el
 * recorte de una foto con fondo. El origen de cada cara sigue viajando aparte, en su evidencia.
 *
 * Si no se sabe el del anverso se cae al del reverso: es lo unico que hay.
 */
export function origenDelDocumento(
  anverso: OrigenCaptura | undefined,
  reverso: OrigenCaptura | undefined,
): OrigenCaptura | undefined {
  return anverso ?? reverso;
}

/** El campo `documentCaptureSource`, o nada si la bandera esta apagada o no se sabe el origen. */
export function campoDocumentCaptureSource(
  anverso: OrigenCaptura | undefined,
  reverso: OrigenCaptura | undefined,
  activado: boolean = escanerDocumentoActivado,
): { documentCaptureSource?: OrigenCaptura } {
  const origen = origenDelDocumento(anverso, reverso);
  return activado && origen ? { documentCaptureSource: origen } : {};
}
