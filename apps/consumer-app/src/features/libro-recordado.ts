/**
 * La última copia del libro de crédito, para pintar Inicio, Pagos y Perfil sin esperar al servidor.
 *
 * ## Por qué existe (2026-10-17)
 *
 * Cada pantalla que usa `useCreditBook` pedía sus cinco consultas al montarse y enseñaba vacío hasta que volvían:
 * al abrir la app y cada vez que se pasaba de Inicio a Pagos. Con el servidor a 210 ms de ida y vuelta desde Santa
 * Cruz, eso se notaba en cada toque. Ahora se pinta lo último que se supo y la consulta lo reemplaza al llegar.
 *
 * Dos niveles: en MEMORIA (cambiar de pestaña no lee el disco) y en disco (abrir en frío). Va atado al
 * `customerId`, así que el de otro cliente en el mismo teléfono no se enseña, y se borra con
 * `limpiarDatosLocales` (salir, o que entre otra persona). Abrir en frío pone el candado (Face ID o PIN) antes del
 * primer fotograma, así que esta copia no se ve sin desbloquear.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLAVE_LIBRO_RECORDADO = 'atlas.credit-book.v1';

type Guardado<T> = { customerId: string; libro: T };

let enMemoria: Guardado<unknown> | null = null;

export async function leerLibroRecordado<T>(customerId: string): Promise<T | null> {
  if (enMemoria?.customerId === customerId) return enMemoria.libro as T;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_LIBRO_RECORDADO);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as Partial<Guardado<T>>;
    if (guardado.customerId !== customerId || !guardado.libro) return null;
    enMemoria = { customerId, libro: guardado.libro };
    return guardado.libro;
  } catch {
    return null;
  }
}

export async function recordarLibro<T>(customerId: string, libro: T): Promise<void> {
  enMemoria = { customerId, libro };
  await AsyncStorage.setItem(CLAVE_LIBRO_RECORDADO, JSON.stringify({ customerId, libro })).catch(() => undefined);
}

export async function olvidarLibroRecordado(): Promise<void> {
  enMemoria = null;
  await AsyncStorage.removeItem(CLAVE_LIBRO_RECORDADO).catch(() => undefined);
}
