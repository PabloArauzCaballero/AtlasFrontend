/**
 * La memoria de «el PIN se acaba de confirmar».
 *
 * Sólo en memoria y sólo unos minutos: al cerrar la app, al pasar el plazo o al cerrar sesión hay que
 * volver a escribirlo. Guardarlo en disco convertiría un permiso temporal en una llave permanente.
 */
const VENTANA_MS = 5 * 60 * 1000;

let confirmadoEn: number | null = null;

export function marcarPinConfirmado(ahora = Date.now()): void {
  confirmadoEn = ahora;
}

export function pinConfirmadoReciente(ahora = Date.now(), ventanaMs = VENTANA_MS): boolean {
  return confirmadoEn !== null && ahora - confirmadoEn < ventanaMs;
}

export function olvidarPinConfirmado(): void {
  confirmadoEn = null;
}
