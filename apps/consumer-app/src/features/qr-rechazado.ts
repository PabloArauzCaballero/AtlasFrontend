/**
 * El ultimo QR que el servidor rechazo, para no volver a mandarlo en bucle.
 *
 * ## Por que existe
 *
 * Un QR se queda en el cuadro muchos fotogramas. El cerrojo de `escanear.tsx` se suelta 1,5 s despues
 * de un rechazo, y con el codigo malo todavia delante la app lo volvia a mandar al servidor cada
 * 1,5 s, con su vibracion de aviso cada vez (medido en el emulador el 2026-09-26: dos `404
 * QR_NOT_RECOGNIZED` en dos segundos). El servidor no va a cambiar de opinion en ese tiempo.
 *
 * Se recuerda solo el ULTIMO token rechazado: en cuanto la camara ve otro codigo, ese se manda sin
 * esperar. Y a los diez segundos el mismo codigo vuelve a probarse, por si lo que fallo fue pasajero
 * o el comercio acaba de activar la caja.
 *
 * Solo frena a la CAMARA. Escribir el codigo a mano o pulsar un boton es una decision de la persona y
 * siempre se envia.
 */
export const ESPERA_TRAS_RECHAZO_MS = 10_000;

export type RechazoDeQr = { token: string; en: number };

/** Si este token es el ultimo rechazado y aun no han pasado los diez segundos. */
export function rechazoVigente(ultimo: RechazoDeQr | null, token: string, ahora: number): boolean {
  return ultimo !== null && ultimo.token === token.trim() && ahora - ultimo.en < ESPERA_TRAS_RECHAZO_MS;
}
