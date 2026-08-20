/**
 * Senales del dispositivo que el backend exige en el registro y en cada sesion.
 *
 * `startOnboarding` pide `deviceFingerprintHash` (32-128 caracteres) y un snapshot con marca,
 * modelo, sistema, si es emulador y si hay VPN. No es telemetria decorativa: alimenta el ancla
 * antifraude contra multi-cuenta descrita en el modelo.
 *
 * Se deriva de datos del dispositivo mas un identificador de instalacion aleatorio y persistente.
 * NO se envia ningun identificador de hardware en claro: solo el hash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import { apiConfig } from '../api/config';

const INSTALLATION_KEY = 'atlas.device.installation-id';

export type DeviceSnapshot = {
  brand?: string;
  model?: string;
  osFamily?: string;
  osVersion?: string;
  appVersion?: string;
  isEmulator?: boolean;
  timezone?: string;
  locale?: string;
};

export type DeviceIdentity = {
  deviceFingerprintHash: string;
  fingerprintVersion: 'v1';
  channel: 'mobile_app';
  snapshot: DeviceSnapshot;
};

async function installationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

export function deviceSnapshot(): DeviceSnapshot {
  const calendar = Localization.getCalendars()[0];
  const locale = Localization.getLocales()[0];
  return {
    brand: Device.brand ?? undefined,
    model: Device.modelName ?? undefined,
    osFamily: Platform.OS,
    osVersion: String(Device.osVersion ?? Platform.Version),
    appVersion: apiConfig.appVersion,
    // Se declara con honestidad: el backend usa esta senal para riesgo, y falsearla en la app
    // solo produce decisiones peores.
    isEmulator: Device.isDevice === false,
    timezone: calendar?.timeZone ?? undefined,
    locale: locale?.languageTag ?? undefined,
  };
}

export async function deviceIdentity(): Promise<DeviceIdentity> {
  const snapshot = deviceSnapshot();
  const seed = [await installationId(), snapshot.brand, snapshot.model, snapshot.osFamily, snapshot.osVersion].join('|');
  const deviceFingerprintHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  return { deviceFingerprintHash, fingerprintVersion: 'v1', channel: 'mobile_app', snapshot };
}

/**
 * Hash de un dato sensible con la MISMA convencion del backend
 * (`hashSensitiveText` = sha256 sobre el valor recortado y en minusculas).
 *
 * Se usa para el numero de documento: permite enviar el hash sin que el numero en claro tenga que
 * salir del dispositivo si la politica del despliegue asi lo decide.
 */
export async function hashSensitiveText(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value.trim().toLowerCase());
}
