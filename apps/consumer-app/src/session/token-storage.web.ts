/**
 * Implementacion WEB del puerto `TokenStore` (APP-02).
 *
 * Metro resuelve `token-storage.web.ts` antes que `token-storage.ts` cuando empaqueta para el
 * navegador, asi que `session.tsx` importa `./token-storage` sin saber en que plataforma corre.
 *
 * ## Ningun token en el almacenamiento del navegador
 *
 * Antes el par de tokens y el perfil iban a `localStorage`, donde cualquier XSS los lee. Ahora:
 *  - el token de REFRESCO lo guarda el servidor en una cookie `HttpOnly; SameSite=Strict` limitada a
 *    `/api/v1/auth/refresh` y `/api/v1/auth/logout` (modo cookie, cabecera `x-atlas-session-mode`).
 *    JavaScript nunca lo ve: en el par queda una MARCA (`esMarcaDeCookie`);
 *  - el token de ACCESO vive solo en la memoria de la pagina. Al recargar se pierde y el cliente lo
 *    recupera con un refresco: la cookie va sola (ver `request` en `api/client.ts`);
 *  - el perfil (nombre, correo o telefono) vive solo en memoria.
 *
 * ## Lo unico que sobrevive a la recarga, y por que no es secreto
 *
 *  - `atlas.session.web.v1` = `'1'`: «puede haber una sesion en cookie». No autentica nada; solo
 *    evita mandar un refresco condenado al 401 en cada visita de alguien que no ha entrado.
 *  - `atlas.session.cliente.v1` = el `customerId` (identificador interno, sin nombre ni contacto).
 *    Hace falta para saber, al entrar, si es OTRO cliente el que usa este navegador y borrar lo del
 *    anterior (APP-09, `datos-locales.ts`); y para restaurar sin esperar a `/auth/me`.
 *
 * ## Migracion
 *
 * Si encuentra el par viejo en `localStorage`, `read` devuelve SOLO su token de refresco y sin token de
 * acceso: el cliente refresca en el acto mandandolo en el cuerpo y en modo cookie, el servidor responde
 * poniendo la cookie, y al escribir el par nuevo se borran las claves viejas. Si ese refresco no llega
 * (sin red), las claves siguen ahi y se reintenta en la siguiente carga; si el servidor lo rechaza, se
 * borran con `clear`. El perfil viejo (con correo o telefono) se borra al primer acceso.
 *
 * Todo pasa por try/catch: en una ventana privada, o con el almacenamiento bloqueado, `localStorage`
 * puede lanzar al tocarlo. Ahi solo se pierden la pista y la migracion.
 */
import type { TokenPair, TokenStore } from '../api/client';
import { esMarcaDeCookie, marcaDeCookie } from '../api/marca-de-cookie';

/** Las claves de antes de APP-02. Solo se leen para migrar y se borran. */
export const CLAVES_VIEJAS = { access: 'atlas.session.access', refresh: 'atlas.session.refresh', profile: 'atlas.session.profile' } as const;
export const CLAVE_PISTA = 'atlas.session.web.v1';
export const CLAVE_CLIENTE = 'atlas.session.cliente.v1';

function leer(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function escribir(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* sin almacenamiento persistente: la sesion sigue en memoria */
  }
}

function borrar(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* nada que borrar */
  }
}

function borrarClavesViejas(): void {
  borrar(CLAVES_VIEJAS.access);
  borrar(CLAVES_VIEJAS.refresh);
}

let tokensEnMemoria: TokenPair | null = null;

export const secureTokenStore: TokenStore = {
  modo: 'cookie',

  async read(): Promise<TokenPair | null> {
    if (tokensEnMemoria) return tokensEnMemoria;
    // Migracion: el token de acceso viejo NO se reutiliza; se canjea el de refresco por la cookie.
    const viejo = leer(CLAVES_VIEJAS.refresh);
    if (viejo && !esMarcaDeCookie(viejo)) return { accessToken: '', refreshToken: viejo };
    return leer(CLAVE_PISTA) === '1' ? { accessToken: '', refreshToken: marcaDeCookie(0) } : null;
  },

  async write(tokens: TokenPair): Promise<void> {
    // Si el servidor aun no conoce el modo cookie y devuelve un token real, se queda en memoria igual.
    tokensEnMemoria = tokens;
    borrarClavesViejas();
    escribir(CLAVE_PISTA, '1');
  },

  async clear(): Promise<void> {
    tokensEnMemoria = null;
    borrarClavesViejas();
    borrar(CLAVE_PISTA);
  },
};

export type StoredProfile = { customerId: string; displayName: string | null; identifier: string };

let perfilEnMemoria: StoredProfile | null = null;

export const profileStorage = {
  async read(): Promise<StoredProfile | null> {
    // El perfil viejo llevaba el correo o el telefono: se rescata solo el `customerId` y se borra.
    const viejo = leer(CLAVES_VIEJAS.profile);
    if (viejo !== null) {
      borrar(CLAVES_VIEJAS.profile);
      try {
        const customerId = (JSON.parse(viejo) as Partial<StoredProfile>).customerId;
        if (customerId && leer(CLAVE_CLIENTE) === null) escribir(CLAVE_CLIENTE, String(customerId));
      } catch {
        /* perfil ilegible: se descarta */
      }
    }
    if (perfilEnMemoria) return perfilEnMemoria;
    const customerId = leer(CLAVE_CLIENTE);
    return customerId ? { customerId, displayName: null, identifier: '' } : null;
  },
  async write(profile: StoredProfile): Promise<void> {
    perfilEnMemoria = profile;
    escribir(CLAVE_CLIENTE, profile.customerId);
  },
  async clear(): Promise<void> {
    perfilEnMemoria = null;
    borrar(CLAVE_CLIENTE);
    borrar(CLAVES_VIEJAS.profile);
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
