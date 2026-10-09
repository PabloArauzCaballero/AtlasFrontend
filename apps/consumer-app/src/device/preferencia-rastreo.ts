/**
 * Lo que la persona decidio en su perfil sobre la ubicacion con la app cerrada, y cuando salio la
 * ultima posicion de fondo. AsyncStorage y no SecureStore por lo mismo que `tracking-context.ts`:
 * la tarea de segundo plano lo lee con el telefono bloqueado y nada de esto es secreto.
 *
 * El criterio (plazo, espaciado) esta en `features/rastreo-plazo.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { leerDecisionDeArranque } from '../session/permisos-de-arranque';
import { segundoPlanoVigente, venceEl, type PreferenciaDeRastreo } from '../features/rastreo-plazo';

const KEY_PREFERENCIA = 'atlas.rastreo.segundo-plano';
const KEY_ULTIMO_ENVIO = 'atlas.rastreo.ultimo-envio-fondo';

export async function leerPreferenciaDeRastreo(): Promise<PreferenciaDeRastreo> {
  try {
    const crudo = await AsyncStorage.getItem(KEY_PREFERENCIA);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as { segundoPlano?: unknown; desde?: unknown };
    if (typeof valor.segundoPlano !== 'boolean' || typeof valor.desde !== 'string') return null;
    return { segundoPlano: valor.segundoPlano, desde: valor.desde };
  } catch {
    return null;
  }
}

export async function guardarPreferenciaDeRastreo(segundoPlano: boolean, ahora = new Date()): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFERENCIA, JSON.stringify({ segundoPlano, desde: ahora.toISOString() })).catch(
    () => undefined,
  );
}

export type EstadoDelRastreoDeFondo = {
  /** La persona acepto la ubicacion en el alta (o en el domicilio). Sin eso no hay nada que mostrar. */
  consentido: boolean;
  vigente: boolean;
  /** Hasta cuando corre (si corre) o cuando vencio (si vencio solo). `null` si lo apago la persona. */
  venceEn: number | null;
};

export async function estadoDelRastreoDeFondo(ahora = Date.now()): Promise<EstadoDelRastreoDeFondo> {
  const [decision, preferencia] = await Promise.all([leerDecisionDeArranque(), leerPreferenciaDeRastreo()]);
  const consentidoEn = decision?.ubicacion ? decision.decidedAt : null;
  return {
    consentido: decision?.ubicacion === true,
    vigente: consentidoEn !== null && segundoPlanoVigente(preferencia, consentidoEn, ahora),
    venceEn: consentidoEn !== null ? venceEl(preferencia, consentidoEn) : null,
  };
}

export async function leerUltimoEnvioDeFondo(): Promise<number | null> {
  try {
    const crudo = await AsyncStorage.getItem(KEY_ULTIMO_ENVIO);
    const valor = crudo === null ? NaN : Number(crudo);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

export async function anotarUltimoEnvioDeFondo(en: number): Promise<void> {
  await AsyncStorage.setItem(KEY_ULTIMO_ENVIO, String(en)).catch(() => undefined);
}

/** Al cerrar sesion: el siguiente que entre empieza con su propia decision. */
export async function borrarPreferenciaDeRastreo(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_PREFERENCIA, KEY_ULTIMO_ENVIO]).catch(() => undefined);
}
