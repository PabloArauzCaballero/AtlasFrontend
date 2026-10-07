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
import { nuevoUuid, sha256HexDeTexto } from '../lib/criptografia';
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
  /**
   * Dispositivo con root o jailbreak.
   *
   * El backend lo acepta desde siempre (`snapshot.isRooted`) y la app no lo mandaba: la columna
   * `telemetry.device_snapshots.is_rooted` estaba en blanco para todos los clientes. Es la señal
   * antifraude mas directa que hay en un telefono —en un dispositivo comprometido cualquier otra
   * señal se puede falsear— y se estaba tirando.
   */
  isRooted?: boolean;
  timezone?: string;
  locale?: string;
};

export type DeviceIdentity = {
  deviceFingerprintHash: string;
  fingerprintVersion: 'v1';
  channel: 'mobile_app';
  /**
   * Quien dice ser la app, en una linea.
   *
   * `telemetry.customer_sessions.user_agent` estaba vacio en todas las sesiones porque nadie lo
   * enviaba. En un canal movil no hay navegador que lo ponga solo, y sin el, dos sesiones de
   * versiones distintas de la app son indistinguibles en la auditoria: cuando un fallo solo ocurre
   * en una version, no hay forma de acotarlo.
   */
  userAgent: string;
  snapshot: DeviceSnapshot;
};

async function installationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const created = nuevoUuid();
  await AsyncStorage.setItem(INSTALLATION_KEY, created);
  return created;
}

/** `Atlas/0.1.0 (ios 26.5; iPhone 17 Pro)` — version de app, sistema y modelo, que es lo que se busca. */
export function userAgent(snapshot: DeviceSnapshot): string {
  const partes = [snapshot.osFamily, snapshot.osVersion].filter(Boolean).join(' ');
  return `Atlas/${snapshot.appVersion ?? '0'} (${partes}${snapshot.model ? `; ${snapshot.model}` : ''})`.slice(0, 500);
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
  /*
    El root se consulta aparte porque es asincrono y puede fallar: `isRootedExperimentalAsync` lee
    el sistema de archivos y en algunos dispositivos lanza. Un fallo aqui no puede impedir un alta
    —el campo es opcional en el contrato— asi que se deja sin declarar antes que declararlo `false`,
    que seria afirmar que el dispositivo esta limpio sin haberlo comprobado.
  */
  const isRooted = await Device.isRootedExperimentalAsync().catch(() => undefined);
  const completo: DeviceSnapshot = { ...snapshot, ...(isRooted === undefined ? {} : { isRooted }) };
  const seed = [await installationId(), snapshot.brand, snapshot.model, snapshot.osFamily, snapshot.osVersion].join('|');
  const deviceFingerprintHash = await sha256HexDeTexto(seed);
  return {
    deviceFingerprintHash,
    fingerprintVersion: 'v1',
    channel: 'mobile_app',
    userAgent: userAgent(completo),
    snapshot: completo,
  };
}

/**
 * Hash de un dato sensible con la MISMA convencion del backend
 * (`hashSensitiveText` = sha256 sobre el valor recortado y en minusculas).
 *
 * Se usa para el numero de documento: permite enviar el hash sin que el numero en claro tenga que
 * salir del dispositivo si la politica del despliegue asi lo decide.
 */
export async function hashSensitiveText(value: string): Promise<string> {
  return sha256HexDeTexto(value.trim().toLowerCase());
}

/**
 * El snapshot que viaja al ABRIR SESIÓN, recortado a lo que ese contrato acepta.
 *
 * El del alta lleva además zona horaria e idioma; el esquema de sesiones es `.strict()` y no los declara, así que
 * mandarlos tal cual convertiría cada inicio de sesión en un 400. Sólo salen las claves con valor.
 */
export function snapshotDeSesion(snapshot: DeviceSnapshot): {
  brand?: string;
  model?: string;
  osFamily?: string;
  osVersion?: string;
  appVersion?: string;
  isRooted?: boolean;
  isEmulator?: boolean;
} {
  const { brand, model, osFamily, osVersion, appVersion, isRooted, isEmulator } = snapshot;
  const completo = { brand, model, osFamily, osVersion, appVersion, isRooted, isEmulator };
  return Object.fromEntries(Object.entries(completo).filter(([, valor]) => valor !== undefined && valor !== null));
}
