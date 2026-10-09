/**
 * Cuanto dura el rastreo con la app CERRADA, y con que frecuencia sale (APP-11).
 *
 * ## Por que caduca
 *
 * La ubicacion en segundo plano sirve para dos cosas (`consentimiento-ubicacion.ts`): comprobar que
 * el domicilio declarado es donde la persona vive de verdad, y detectar usos de la cuenta desde otro
 * lugar. La primera es una comprobacion con principio y fin —unas semanas de rastro bastan para ver
 * donde duerme alguien— y la segunda la cubren las medidas con la app ABIERTA (cada cinco minutos y
 * al iniciar sesion), que no caducan. Un rastreo de fondo continuo y sin fin no tiene finalidad que
 * lo justifique (minimizacion, ISO 27701 / Ley 164 y las reglas de las tiendas).
 *
 * Por eso el de fondo se apaga SOLO a los 30 dias de la decision de la persona, y ella puede
 * apagarlo antes —o renovarlo otros 30 dias— desde su perfil. Apagarlo NO retira el consentimiento
 * `location_tracking`: ese se retira en «Privacidad» y apaga tambien las medidas con la app abierta.
 *
 * ## Por que se espacia aqui
 *
 * Android respeta los 15 minutos pedidos; iOS no tiene intervalo de tiempo, solo de distancia, y en
 * coche entrega una posicion cada cien metros. El texto del permiso promete «como mucho cada 15
 * minutos»: para que sea verdad en los dos sistemas, lo que llega antes de tiempo se descarta.
 */
import { CADENCIA_SEGUNDO_PLANO_MS } from './rastreo';

/** Cuanto dura el rastreo de fondo desde que la persona lo decidio (o lo renovo en su perfil). */
export const PLAZO_SEGUNDO_PLANO_MS = 30 * 24 * 60 * 60 * 1000;

/** Lo que la persona decidio en su perfil. `null` = no toco nada: manda la decision del alta. */
export type PreferenciaDeRastreo = { segundoPlano: boolean; desde: string } | null;

/** Desde cuando cuenta el plazo: la ultima decision, la del perfil si la hay, si no la del alta. */
export function inicioDelPlazo(preferencia: PreferenciaDeRastreo, consentidoEn: string | null): number | null {
  const desde = preferencia?.desde ?? consentidoEn;
  if (!desde) return null;
  const ms = Date.parse(desde);
  return Number.isFinite(ms) ? ms : null;
}

/** Hasta cuando corre el rastreo de fondo, o `null` si no corre. */
export function venceEl(preferencia: PreferenciaDeRastreo, consentidoEn: string | null): number | null {
  if (preferencia?.segundoPlano === false) return null;
  const inicio = inicioDelPlazo(preferencia, consentidoEn);
  return inicio === null ? null : inicio + PLAZO_SEGUNDO_PLANO_MS;
}

/** Si el rastreo de fondo tiene hoy un motivo vigente. Sin fecha de decision, no lo tiene. */
export function segundoPlanoVigente(preferencia: PreferenciaDeRastreo, consentidoEn: string | null, ahora: number): boolean {
  const vence = venceEl(preferencia, consentidoEn);
  return vence !== null && ahora < vence;
}

/**
 * Deja una posicion cada `CADENCIA_SEGUNDO_PLANO_MS` como mucho, contando desde la ultima enviada.
 * Las posiciones llegan ordenadas por el sistema, pero se ordenan igual: no cuesta nada.
 */
export function espaciarPosiciones<T extends { capturedAt: string }>(
  posiciones: readonly T[],
  ultimaEnviada: number | null,
  minimoMs = CADENCIA_SEGUNDO_PLANO_MS,
): T[] {
  const salida: T[] = [];
  let ultima = ultimaEnviada;
  const ordenadas = [...posiciones].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
  for (const posicion of ordenadas) {
    const en = Date.parse(posicion.capturedAt);
    if (!Number.isFinite(en)) continue;
    if (ultima !== null && en - ultima < minimoMs) continue;
    salida.push(posicion);
    ultima = en;
  }
  return salida;
}
