/**
 * Las fotos del carnet, las selfies y los escaneos que una visita a «Tu identidad» dejó en el teléfono
 * (APP-10).
 *
 * `takePictureAsync` y el escáner escriben un JPEG en la caché (o, el escáner en iOS, en `tmp/`) y
 * ahí se quedaban: biometría e identificación en claro hasta que el sistema purgara la caché. Pero NO
 * se pueden borrar al subirlas: `identidad.tsx` las vuelve a leer al mandar el paquete al Motor
 * (`arrancarVerificacion`, la selfie y las dos caras en base64). Así que se borran:
 *  - al REEMPLAZAR una foto («Repetir»): la anterior ya no la lee nadie;
 *  - tras el envío del paquete y de la verificación al Motor;
 *  - al salir de la pantalla (si había un envío en curso, cuando termine);
 *  - y al cerrar sesión, con el resto de la caché (`session/datos-locales.ts`).
 */
import { borrarCopiaLocal } from '../device/archivos';

export class CapturasLocales {
  private readonly uris = new Set<string>();

  /** Una foto nueva de esta visita: se borrará con las demás. */
  anotar(uri: string | null | undefined): void {
    if (uri) this.uris.add(uri);
  }

  /** La foto `nueva` sustituye a `anterior` en una lámina: la anterior se borra ya. */
  reemplazar(anterior: string | null | undefined, nueva: string): void {
    this.anotar(nueva);
    if (anterior && anterior !== nueva) this.borrar(anterior);
  }

  borrar(uri: string): void {
    borrarCopiaLocal(uri);
    this.uris.delete(uri);
  }

  borrarTodas(): void {
    for (const uri of [...this.uris]) this.borrar(uri);
  }

  get pendientes(): number {
    return this.uris.size;
  }
}
