/**
 * En el navegador no hay forma de impedir una captura de pantalla: el hook no hace nada. Existe para
 * que las pantallas lo llamen igual en todas las plataformas. Ver `sin-capturas.ts`.
 */
export function useSinCapturas(_clave: string, _activo = true): void {
  // Sin efecto en web.
}
