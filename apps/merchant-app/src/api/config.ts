/**
 * De dónde sale la URL de la API: el entorno (`expo start` carga el `.env`) y, en un binario, lo que
 * `app.config.js` copió a `extra.atlas`. Sin URL no se arranca: un build que apunta a ningún sitio
 * tiene que fallar al abrir en desarrollo, no dejar al comercio en «Sin conexión».
 */
import Constants from 'expo-constants';

type ExtraAtlas = { apiUrl?: string; timeoutMs?: string };

const extra = (Constants.expoConfig?.extra?.atlas ?? {}) as ExtraAtlas;

function leerUrl(): string {
  const url = process.env.EXPO_PUBLIC_ATLAS_API_URL || extra.apiUrl;
  if (!url) {
    throw new Error('Falta EXPO_PUBLIC_ATLAS_API_URL: la URL del backend del ERP (…/api/v1). Ver .env.example.');
  }
  return url;
}

export const apiBaseUrl = leerUrl();

const timeoutLeido = Number(process.env.EXPO_PUBLIC_ATLAS_TIMEOUT_MS || extra.timeoutMs);
export const timeoutMs = Number.isFinite(timeoutLeido) && timeoutLeido > 0 ? timeoutLeido : 20_000;
