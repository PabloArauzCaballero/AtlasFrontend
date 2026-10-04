/**
 * El reenvío del código de cambio de PIN.
 *
 * El servidor no deja pedir otro código antes de un minuto por cuenta (responde 429). La pantalla respeta la MISMA
 * espera y la enseña, en vez de dejar que la persona pulse y se encuentre con un error que no sabe leer.
 */

/** Lo mismo que `PASSWORD_CHANGE_RESEND_COOLDOWN_MS` del backend (60 000 ms). Si uno cambia, el otro también. */
export const SEGUNDOS_ENTRE_ENVIOS = 60;

/** La etiqueta del botón de reenvío: con la cuenta atrás mientras espera, y la acción cuando ya se puede. */
export function textoDeReenvio(segundosRestantes: number): string {
  return segundosRestantes > 0 ? `Reenviar código en ${segundosRestantes} s` : 'Reenviar el código';
}
