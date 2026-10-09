/**
 * Lo que un cliente deja en el teléfono y NO puede heredar el siguiente (APP-08/09/10).
 *
 * `signOut` ya borraba tokens, perfil, rastreo y bitácora, pero se quedaban:
 *  - las compras de demostración (`atlas.sandbox.purchase.v1`): órdenes, cuotas y comprobantes, sin
 *    `customerId` en la clave, así que quien entraba después en el mismo teléfono las veía como suyas;
 *  - la lectura del carnet (nombres, apellidos, nacimiento leídos por OCR), en AsyncStorage sin cifrar;
 *  - las copias en caché: fotos del carnet, selfies, fotogramas, comprobantes, extractos y descargas;
 *  - el historial de posiciones, si la sesión no se cerró con `signOut` sino que caducó.
 *
 * Se llama desde DOS sitios: `signOut`, y `signIn` cuando entra un cliente DISTINTO del último que
 * hubo en el teléfono. El segundo cubre la sesión caducada: `onSessionExpired` no limpia nada (puede
 * ser la misma persona que vuelve a entrar en un minuto y no tiene por qué perder sus compras de
 * prueba), pero si la que entra es otra, lo del anterior se borra antes de enseñarle nada.
 *
 * Lo que NO se borra, a propósito: la preferencia de tema, el identificador de instalación, «ya vi
 * la presentación» y los recorridos vistos. No son de nadie en particular ni dicen nada de la persona.
 *
 * Nunca lanza: limpiar es lo último que hace un cierre de sesión y no puede impedirlo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vaciarCopiasLocales } from '../device/archivos';
import { borrarHistorial } from '../device/historial-ubicaciones';
import { borrarLecturaDelCarnet } from '../features/lectura-del-carnet';

/** La clave del estado de compras de demostración. Aquí y no en `sandbox/store.tsx` para no importar React. */
export const CLAVE_COMPRAS_DE_PRUEBA = 'atlas.sandbox.purchase.v1';

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/**
 * Quien guarda en MEMORIA algo del cliente (el estado de compras) se suscribe aquí: borrar sólo el
 * disco no basta, porque el efecto que persiste el estado volvería a escribir lo que tiene en memoria.
 */
export function alLimpiarDatosLocales(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export async function limpiarDatosLocales(): Promise<void> {
  for (const oyente of oyentes) {
    try {
      oyente();
    } catch {
      /* un oyente que falla no impide limpiar el resto */
    }
  }
  try {
    vaciarCopiasLocales();
  } catch {
    /* ver `vaciarCopiasLocales`: no lanza, pero el cierre no depende de ello */
  }
  await Promise.all([
    AsyncStorage.removeItem(CLAVE_COMPRAS_DE_PRUEBA).catch(() => undefined),
    borrarLecturaDelCarnet(),
    borrarHistorial(),
  ]);
}
