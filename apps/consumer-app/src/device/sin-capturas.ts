/**
 * Pantallas que no se dejan capturar ni grabar (APP-18, MASVS-PLATFORM / ISO 27701).
 *
 * El PIN, el carnet, la selfie y los extractos bancarios son lo que mas vale de un expediente
 * robado. Una captura se sube sola a la nube de fotos; una grabacion de pantalla la puede estar
 * haciendo una app de «compartir pantalla» que la persona acepto sin leer.
 *
 * - **Android:** `FLAG_SECURE` mientras la pantalla esta montada. Bloquea capturas y grabaciones, y
 *   ademas deja en blanco la vista previa de la app en «Recientes».
 * - **iOS:** el sistema no deja impedir una captura; `expo-screen-capture` oculta el contenido en
 *   las grabaciones y en las capturas (iOS 13+). Lo que se ve en el selector de apps lo tapa
 *   `ui/bloqueo-local.tsx` con `enableAppSwitcherProtectionAsync` para toda la sesion.
 *
 * Cada pantalla usa su propia clave: el modulo cuenta las claves activas y solo vuelve a permitir
 * capturas cuando se desmonta la ultima. Con una sola clave compartida, salir del PIN a una pantalla
 * de carnet que tambien la usa reactivaria las capturas sobre el carnet.
 */
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect } from 'react';

/**
 * Lo mismo que `usePreventScreenCapture` del modulo, con un `activo` para las hojas que estan
 * montadas siempre y solo se ven a ratos (`ConfirmarPinSheet`): bloquear mientras la hoja esta
 * cerrada impediria capturar la pantalla de debajo sin motivo. Un fallo del modulo nativo no rompe
 * la pantalla: se queda sin la proteccion, que es lo que habia antes.
 */
export function useSinCapturas(clave: string, activo = true): void {
  useEffect(() => {
    if (!activo) return;
    const llave = `atlas:${clave}`;
    void preventScreenCaptureAsync(llave).catch(() => undefined);
    return () => {
      void allowScreenCaptureAsync(llave).catch(() => undefined);
    };
  }, [clave, activo]);
}
