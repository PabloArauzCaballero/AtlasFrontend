/**
 * Implementacion WEB del puerto `TokenStore`.
 *
 * Metro resuelve `token-storage.web.ts` antes que `token-storage.ts` cuando empaqueta para el
 * navegador, asi que `session.tsx` importa `./token-storage` sin saber en que plataforma corre.
 *
 * En el navegador no existe `expo-secure-store` —la llamada lanza `getValueWithKeyAsync is not a
 * function` y la app se queda en la pantalla de marca sin decidir el area—. El almacen que hay es
 * `localStorage`: no esta cifrado, pero es del ORIGEN de la web (ningun otro sitio lo lee) y es
 * el mismo sitio donde guardan la sesion los portales de Atlas. El refresh token caduca en el
 * servidor igual que en el telefono; cerrar sesion lo borra.
 *
 * Todo pasa por try/catch: en una ventana privada, o con el almacenamiento bloqueado, `localStorage`
 * puede lanzar al tocarlo. Ahi la sesion vive solo en memoria y se pierde al recargar, que es mejor
 * que no entrar nunca.
 */
import type { TokenPair, TokenStore } from '../api/client';

const ACCESS_KEY = 'atlas.session.access';
const REFRESH_KEY = 'atlas.session.refresh';
const PROFILE_KEY = 'atlas.session.profile';

const memoria = new Map<string, string>();

function leer(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? memoria.get(key) ?? null;
  } catch {
    return memoria.get(key) ?? null;
  }
}

function escribir(key: string, value: string): void {
  memoria.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* sin almacenamiento persistente: queda en memoria */
  }
}

function borrar(key: string): void {
  memoria.delete(key);
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* nada que borrar */
  }
}

export const secureTokenStore: TokenStore = {
  async read(): Promise<TokenPair | null> {
    const accessToken = leer(ACCESS_KEY);
    const refreshToken = leer(REFRESH_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },
  async write(tokens: TokenPair): Promise<void> {
    escribir(ACCESS_KEY, tokens.accessToken);
    escribir(REFRESH_KEY, tokens.refreshToken);
  },
  async clear(): Promise<void> {
    borrar(ACCESS_KEY);
    borrar(REFRESH_KEY);
  },
};

export type StoredProfile = { customerId: string; displayName: string | null; identifier: string };

export const profileStorage = {
  async read(): Promise<StoredProfile | null> {
    const raw = leer(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredProfile;
    } catch {
      return null;
    }
  },
  async write(profile: StoredProfile): Promise<void> {
    escribir(PROFILE_KEY, JSON.stringify(profile));
  },
  async clear(): Promise<void> {
    borrar(PROFILE_KEY);
  },
};

/** Almacen en memoria para tests: mismo contrato, sin dependencias del navegador. */
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
