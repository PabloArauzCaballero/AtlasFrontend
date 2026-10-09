/**
 * Implementacion movil del puerto `TokenStore`.
 *
 * Los tokens van a `expo-secure-store` (Keychain en iOS, EncryptedSharedPreferences en Android), no
 * a AsyncStorage: un refresh token en almacenamiento plano es una sesion regalada a cualquier
 * proceso con acceso al sandbox de la app. Invariante del documento maestro: nada de AsyncStorage
 * para secretos criticos.
 *
 * El resto del perfil de sesion (customerId) no es secreto y vive aparte, para poder decidir a que
 * pantalla entrar sin desbloquear el almacen seguro.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { TokenPair, TokenStore } from '../api/client';

/*
  Claves NUEVAS para los tokens, escritas con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (APP-19).

  Las de antes se escribieron sin `keychainAccessible`: en iOS eso es `WHEN_UNLOCKED`, sin
  `THIS_DEVICE_ONLY`. Dos problemas: con el iPhone bloqueado la tarea de ubicacion de segundo plano no
  podia leer el token (los lotes salian sin autorizacion, en silencio), y el token viajaba en una copia
  de seguridad cifrada a OTRO telefono. `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` se puede leer con el
  telefono bloqueado tras el primer desbloqueo desde que se encendio, y nunca sale de este aparato.

  Por que claves nuevas y no reescribir las mismas: en iOS `setItemAsync` sobre una clave que ya existe
  hace `SecItemUpdate` y cambia SOLO el valor, no la accesibilidad
  (`expo-secure-store/ios/SecureStoreModule.swift`, `update`). Reescribir no migraba nada.

  La migracion copia y DESPUES borra: nadie se queda sin sesion por el cambio. Si copiar falla (llavero
  sin desbloquear, por ejemplo), se sigue usando el par viejo y se intenta en la siguiente lectura.
  En Android `keychainAccessible` no aplica; la migracion es la misma y no cambia nada mas.
*/
const ACCESS_KEY = 'atlas.session.access.v2';
const REFRESH_KEY = 'atlas.session.refresh.v2';
/** Las de antes de APP-19. Solo se leen para migrarlas y se borran. */
export const CLAVES_VIEJAS = { access: 'atlas.session.access', refresh: 'atlas.session.refresh' } as const;
const PROFILE_KEY = 'atlas.session.profile';

const OPCIONES: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function leerPar(access: string, refresh: string, opciones?: SecureStore.SecureStoreOptions): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(access, opciones),
    SecureStore.getItemAsync(refresh, opciones),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

async function escribirNuevas(tokens: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken, OPCIONES),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken, OPCIONES),
  ]);
}

async function borrarViejas(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CLAVES_VIEJAS.access).catch(() => undefined),
    SecureStore.deleteItemAsync(CLAVES_VIEJAS.refresh).catch(() => undefined),
  ]);
}

/** Una sola migracion en vuelo: al arrancar leen el token varias peticiones a la vez. */
let migrando: Promise<TokenPair | null> | null = null;

async function migrarDesdeLasViejas(): Promise<TokenPair | null> {
  const viejas = await leerPar(CLAVES_VIEJAS.access, CLAVES_VIEJAS.refresh);
  if (!viejas) return null;
  try {
    await escribirNuevas(viejas);
    // Se borran las viejas SOLO si las nuevas se pueden leer: copiar y comprobar, despues borrar.
    const copiadas = await leerPar(ACCESS_KEY, REFRESH_KEY, OPCIONES);
    if (copiadas?.refreshToken === viejas.refreshToken && copiadas.accessToken === viejas.accessToken) await borrarViejas();
  } catch {
    // La sesion sigue con el par viejo; se reintenta en la siguiente lectura.
  }
  return viejas;
}

export const secureTokenStore: TokenStore = {
  async read(): Promise<TokenPair | null> {
    const nuevas = await leerPar(ACCESS_KEY, REFRESH_KEY, OPCIONES);
    if (nuevas) return nuevas;
    migrando ??= migrarDesdeLasViejas().finally(() => {
      migrando = null;
    });
    return migrando;
  },

  async write(tokens: TokenPair): Promise<void> {
    await escribirNuevas(tokens);
    // Un par viejo que siguiera ahi volveria a «migrarse» encima de este si las nuevas faltaran.
    await borrarViejas();
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, OPCIONES),
      SecureStore.deleteItemAsync(REFRESH_KEY, OPCIONES),
      borrarViejas(),
    ]);
  },
};

export type StoredProfile = { customerId: string; displayName: string | null; identifier: string };

export const profileStorage = {
  async read(): Promise<StoredProfile | null> {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  },
  async write(profile: StoredProfile): Promise<void> {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(PROFILE_KEY);
  },
};

/** Almacen en memoria para tests: mismo contrato, sin dependencias nativas. */
export function createMemoryTokenStore(): TokenStore {
  let tokens: TokenPair | null = null;
  return {
    read: async () => tokens,
    write: async (next) => {
      tokens = next;
    },
    clear: async () => {
      tokens = null;
    },
  };
}
