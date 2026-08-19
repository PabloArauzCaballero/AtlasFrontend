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

const ACCESS_KEY = 'atlas.session.access';
const REFRESH_KEY = 'atlas.session.refresh';
const PROFILE_KEY = 'atlas.session.profile';

export const secureTokenStore: TokenStore = {
  async read(): Promise<TokenPair | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  async write(tokens: TokenPair): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    ]);
  },

  async clear(): Promise<void> {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
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
