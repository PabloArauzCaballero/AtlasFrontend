/**
 * ¿Esta foto parece un carnet? La pregunta que la app se hace ANTES de subir el anverso o el reverso.
 *
 * ## Para que sirve
 *
 * Para atrapar el error tonto en el momento en que se puede arreglar: la foto del piso, la del dedo
 * tapando la lente, la de una pantalla oscura o un recorte que no es el documento entero. Si se sube,
 * la persona se entera horas despues, cuando el Motor la rechaza y el carnet ya no esta en su mano.
 *
 * ## Lo que NO es
 *
 * No es el juez. Es una sospecha barata con tres señales que se miden en el telefono sin modelos ni
 * red, y por eso nunca bloquea: si dice «no parece», la pantalla PREGUNTA (`identidad.tsx`) y la
 * persona puede contestar «si, es mi carnet». El Motor sigue decidiendo.
 *
 * ## Las tres señales
 *
 * - `pequena`: el lado largo no llega al minimo para leer el numero.
 * - `proporcion`: solo en lo que devuelve el escaner del sistema, que entrega el RECORTE. Una foto de la
 *   camara de la app trae el visor entero (4:3, 16:9) y siempre fallaria.
 * - `sin_detalle`: muy pocos bytes por pixel. Un JPEG de una tarjeta impresa —texto, foto, guilloches—
 *   pesa; uno oscuro, desenfocado o de una superficie lisa se comprime casi a nada. Es la señal que
 *   atrapa «no apunte al carnet» con la camara de la app.
 */
import { LADO_LARGO_MINIMO, PROPORCION_CARNET, TOLERANCIA_PROPORCION } from './captura-del-carnet';

export type SenalDeFoto = 'pequena' | 'proporcion' | 'sin_detalle';

export type EvaluacionDeFoto = {
  pareceCarnet: boolean;
  /** En el orden en que se dicen. Vacio cuando parece un carnet. */
  motivos: { senal: SenalDeFoto; texto: string }[];
};

/** La camara de la app entrega la foto entera del visor: se le pide menos que al recorte del escaner. */
export const LADO_LARGO_MINIMO_CAMARA = 1000;

/**
 * Bytes por pixel por debajo de los cuales la foto «no tiene detalle». Un carnet bien fotografiado en
 * JPEG a calidad 0,7-0,9 ronda 0,15-0,35; una foto negra o de una mesa lisa, 0,01-0,04.
 */
export const BYTES_POR_PIXEL_MINIMOS = 0.05;

export const TEXTOS_DE_SENAL: Record<SenalDeFoto, string> = {
  pequena: 'La imagen salió muy pequeña para leer el número.',
  proporcion: 'El recorte no tiene la forma de un carnet: puede faltar un borde o ser otro documento.',
  sin_detalle: 'La foto casi no tiene detalle: puede estar oscura, borrosa o no mostrar el carnet.',
};

export function evaluarFotoDeCarnet(foto: {
  ancho?: number | null;
  alto?: number | null;
  /** Peso del archivo. Sin el, no se mide el detalle. */
  bytes?: number | null;
  origen: 'camera' | 'system_scanner';
}): EvaluacionDeFoto {
  const motivos: EvaluacionDeFoto['motivos'] = [];
  const ancho = Number(foto.ancho ?? 0);
  const alto = Number(foto.alto ?? 0);
  const conMedidas = Number.isFinite(ancho) && Number.isFinite(alto) && ancho > 0 && alto > 0;

  if (conMedidas) {
    const largo = Math.max(ancho, alto);
    const corto = Math.min(ancho, alto);
    const minimo = foto.origen === 'system_scanner' ? LADO_LARGO_MINIMO : LADO_LARGO_MINIMO_CAMARA;
    if (largo < minimo) motivos.push({ senal: 'pequena', texto: TEXTOS_DE_SENAL.pequena });

    if (foto.origen === 'system_scanner') {
      const desvio = Math.abs(largo / corto - PROPORCION_CARNET) / PROPORCION_CARNET;
      if (desvio > TOLERANCIA_PROPORCION) motivos.push({ senal: 'proporcion', texto: TEXTOS_DE_SENAL.proporcion });
    }

    const bytes = Number(foto.bytes ?? 0);
    if (Number.isFinite(bytes) && bytes > 0 && bytes / (ancho * alto) < BYTES_POR_PIXEL_MINIMOS) {
      motivos.push({ senal: 'sin_detalle', texto: TEXTOS_DE_SENAL.sin_detalle });
    }
  }

  return { pareceCarnet: motivos.length === 0, motivos };
}
