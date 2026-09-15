/**
 * Que canales de verificacion ofrecer, dado lo que contesto el servidor.
 *
 * Vive fuera de la pantalla porque es la unica parte con decisiones, y son cuatro: filtrar lo que el
 * servidor no puede entregar, conservar SU orden de preferencia, decidir el respaldo cuando la
 * consulta falla, y saber cuando queda un solo canal —que es cuando el desplegable deja de tener
 * sentido—. Todo eso se puede probar sin montar React.
 */
import type { CanalDeVerificacion, VerificationChannel } from '../../api/endpoints/onboarding';

export type Canal = VerificationChannel;

/** Como se llama cada canal en pantalla. El servidor manda codigos, no rotulos. */
export const ETIQUETAS: Record<Canal, { etiqueta: string; detalle: string }> = {
  email: { etiqueta: 'Correo', detalle: 'A tu correo registrado.' },
  sms: { etiqueta: 'SMS', detalle: 'A tu número registrado.' },
  whatsapp: { etiqueta: 'WhatsApp', detalle: 'Por WhatsApp, al mismo número.' },
};

/**
 * El respaldo es exactamente lo que habia antes de que el servidor publicara nada.
 *
 * Quien llega a esta pantalla ya completo todo el alta. Dejarle sin poder pedir el codigo porque una
 * consulta auxiliar no contesto cambiaria un problema pequeño —ofrecer un canal que quiza este
 * apagado, que ya se explica con su propio mensaje— por uno grande: no poder terminar.
 */
export const TODOS: Canal[] = ['email', 'sms', 'whatsapp'];

export type OpcionDeCanal = { valor: Canal; etiqueta: string; detalle: string };

export type CanalesOfrecidos = {
  opciones: OpcionDeCanal[];
  /** El rotulo del unico canal posible, en minuscula, o `null` si hay donde elegir. */
  unico: string | null;
};

/**
 * `catalogo` es `null` mientras no se sabe, y tambien cuando la consulta fallo.
 *
 * NO se reordena lo que vino: la preferencia la fija el servidor (`CHANNEL_PREFERENCE`), y
 * reordenarla aqui devolveria el problema al punto de partida —cambiarla exigiria publicar una
 * version nueva de la app—.
 */
export function canalesOfrecidos(catalogo: CanalDeVerificacion[] | null): CanalesOfrecidos {
  const abiertos = (catalogo ?? []).filter((c) => c.available).map((c) => c.channel);
  /*
    Un catalogo sin NINGUN canal abierto cae al respaldo igual que un fallo de red: vale mas enseñar
    los tres y que el intento falle explicando, que un desplegable vacio sin nada que pulsar.
  */
  const lista = abiertos.length > 0 ? abiertos : TODOS;
  const opciones = lista.map((valor) => ({ valor, ...ETIQUETAS[valor] }));
  const [primera] = opciones;
  return { opciones, unico: opciones.length === 1 && primera ? primera.etiqueta.toLowerCase() : null };
}

/**
 * El canal que debe quedar elegido cuando llega el catalogo.
 *
 * Respeta lo que la persona haya escogido si sigue siendo posible; si no, toma el primero que el
 * servidor si puede entregar. El catalogo llega una vez y no vuelve a cambiar, asi que esto en la
 * practica solo corrige el valor inicial y nunca pelea con una eleccion.
 */
export function canalElegido(actual: Canal, opciones: OpcionDeCanal[]): Canal {
  const [primera] = opciones;
  if (!primera) return actual;
  return opciones.some((o) => o.valor === actual) ? actual : primera.valor;
}
