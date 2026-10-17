/**
 * El último estado de cuenta que dio el servidor, para entrar sin esperarlo al abrir la app.
 *
 * ## Por qué existe (2026-10-17)
 *
 * Al abrir con sesión guardada, la app no pintaba NADA hasta que volvían el estado del alta y el perfil: un viaje
 * entero al servidor (210 ms de ida y vuelta desde Santa Cruz, más con el token caducado) con la pantalla en blanco,
 * y sólo después salían las peticiones de la portada. Dos tandas en serie.
 *
 * Ahora, si la última vez la cuenta estaba en un estado conocido, se entra a esa área enseguida y las dos tandas
 * salen a la vez. Cuando llega la respuesta del servidor, manda ella: si la cuenta cambió (p. ej. dejó de estar
 * activa), las rutas redirigen solas, porque `areaFor` prefiere siempre lo que acaba de llegar.
 *
 * Sólo se guarda el `lifecycleStatus` y de QUIÉN es: ningún dato de la persona. Va atado al `customerId`, así que
 * el de otro cliente en el mismo teléfono no vale, y se borra al salir (`signOut`, sesión caducada y
 * `limpiarDatosLocales`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLAVE_ESTADO_RECORDADO = 'atlas.session.lifecycle.v1';

type Recordado = { customerId: string; lifecycleStatus: string };

export async function leerEstadoRecordado(customerId: string): Promise<string | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_ESTADO_RECORDADO);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Partial<Recordado>;
    return valor.customerId === customerId && typeof valor.lifecycleStatus === 'string' && valor.lifecycleStatus
      ? valor.lifecycleStatus
      : null;
  } catch {
    return null;
  }
}

export async function recordarEstado(customerId: string, lifecycleStatus: string): Promise<void> {
  const valor: Recordado = { customerId, lifecycleStatus };
  await AsyncStorage.setItem(CLAVE_ESTADO_RECORDADO, JSON.stringify(valor)).catch(() => undefined);
}

export async function olvidarEstadoRecordado(): Promise<void> {
  await AsyncStorage.removeItem(CLAVE_ESTADO_RECORDADO).catch(() => undefined);
}
