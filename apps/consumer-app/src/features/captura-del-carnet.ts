/**
 * Lo que la app comprueba de una captura del carnet ANTES de subirla, y a que lamina se va despues.
 *
 * ## Por que en el telefono
 *
 * Porque es barato aqui y caro despues: una imagen demasiado pequeña o un recorte que no es el carnet
 * entero gasta una subida firmada, una llamada al Motor y, sobre todo, la paciencia de la persona,
 * que se entera del rechazo cuando ya no tiene el carnet en la mano. El Motor sigue siendo quien
 * juzga; esto solo evita mandarle lo que se sabe que no va a poder leer.
 *
 * ## Solo para lo que devuelve el escaner del sistema
 *
 * El escaner entrega el RECORTE del documento, asi que su proporcion es la del carnet. La camara de
 * la app entrega la foto entera del visor (4:3, 16:9...), y comprobarle la proporcion la rechazaria
 * siempre. Con la bandera del escaner apagada nada de esto se ejecuta.
 *
 * ## Los umbrales
 *
 * Son el punto de partida del plan (fase 3), no una medicion: se ajustan con los escaneos del corpus
 * de la fase 5.
 */
import type { IdentityEvidenceKind } from './evidence-upload';

/** ID-1 (ISO/IEC 7810): 85,6 × 54 mm. Es el formato del carnet boliviano. */
export const PROPORCION_CARNET = 85.6 / 54;

/** Cuanto se puede apartar la proporcion del recorte de la del carnet, en fraccion. */
export const TOLERANCIA_PROPORCION = 0.12;

/** Pixeles minimos del lado largo: por debajo, el numero y la MRZ no se leen. */
export const LADO_LARGO_MINIMO = 1400;

export type ComprobacionDeCaptura =
  | { ok: true }
  | { ok: false; motivo: 'pequena' | 'proporcion'; mensaje: string };

export const MENSAJE_PEQUENA = 'La imagen salió muy pequeña. Acerca un poco el teléfono.';
export const MENSAJE_PROPORCION = 'No parece el carnet entero. Repite con los cuatro bordes a la vista.';

/**
 * Tamaño y proporcion del recorte. Acepta el carnet en horizontal o en vertical: el escaner no
 * siempre gira la imagen, y un carnet de pie sigue siendo un carnet entero.
 */
export function comprobarCaptura(dimensiones: { ancho: number; alto: number }): ComprobacionDeCaptura {
  const largo = Math.max(dimensiones.ancho, dimensiones.alto);
  const corto = Math.min(dimensiones.ancho, dimensiones.alto);
  if (!Number.isFinite(largo) || !Number.isFinite(corto) || corto <= 0 || largo < LADO_LARGO_MINIMO) {
    return { ok: false, motivo: 'pequena', mensaje: MENSAJE_PEQUENA };
  }
  const desvio = Math.abs(largo / corto - PROPORCION_CARNET) / PROPORCION_CARNET;
  if (desvio > TOLERANCIA_PROPORCION) return { ok: false, motivo: 'proporcion', mensaje: MENSAJE_PROPORCION };
  return { ok: true };
}

/**
 * La lamina a la que ir tras guardar una captura: la SIGUIENTE pendiente.
 *
 * Se busca hacia delante desde la que se acaba de guardar y, si no queda ninguna detras, desde el
 * principio (quien repite el reverso con el anverso aun pendiente vuelve al anverso). Si ya estan
 * todas, se queda en la que se guardo: es la que la persona quiere mirar.
 */
export function siguientePendiente(
  orden: readonly IdentityEvidenceKind[],
  hechas: Partial<Record<IdentityEvidenceKind, unknown>>,
  guardada: IdentityEvidenceKind,
): IdentityEvidenceKind {
  const desde = Math.max(0, orden.indexOf(guardada));
  for (let paso = 1; paso <= orden.length; paso++) {
    const candidata = orden[(desde + paso) % orden.length] as IdentityEvidenceKind;
    if (candidata !== guardada && !hechas[candidata]) return candidata;
  }
  return guardada;
}
