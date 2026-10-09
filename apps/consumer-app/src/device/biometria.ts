/**
 * Face ID / Touch ID / huella: comprobar que quien tiene el telefono es la persona de la sesion.
 *
 * ## Para que se usa (APP-13)
 *
 * SOLO para el bloqueo local al volver a la app (`features/bloqueo-local.ts`). No sustituye al PIN
 * de la cuenta ni abre sesion: el telefono dice «esta cara / esta huella es la del dueño del
 * telefono» y la app, con la sesion ya abierta, se deja ver. Nada de esto sale del telefono.
 *
 * ## Sin el codigo del telefono como plan B
 *
 * `disableDeviceFallback: true`: si la biometria falla, el plan B es el PIN de Atlas
 * (`/auth/pin/verify`), no el codigo de desbloqueo del telefono. Quien conoce el codigo de un
 * telefono prestado no tiene por que conocer el PIN de la cuenta.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type TipoDeBiometria = 'rostro' | 'huella' | 'iris';

export type Biometria = { disponible: boolean; tipo: TipoDeBiometria | null };

const SIN_BIOMETRIA: Biometria = { disponible: false, tipo: null };

/** Si el telefono tiene biometria Y la persona registro al menos una cara o huella. Nunca lanza. */
export async function leerBiometria(): Promise<Biometria> {
  try {
    const [hardware, registrada, tipos] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hardware || !registrada) return SIN_BIOMETRIA;
    const T = LocalAuthentication.AuthenticationType;
    const tipo: TipoDeBiometria | null = tipos.includes(T.FACIAL_RECOGNITION)
      ? 'rostro'
      : tipos.includes(T.FINGERPRINT)
        ? 'huella'
        : tipos.includes(T.IRIS)
          ? 'iris'
          : null;
    return { disponible: true, tipo };
  } catch {
    return SIN_BIOMETRIA;
  }
}

/** Como se llama en este telefono: «Face ID» en iPhone con rostro, «tu huella» en Android… */
export function nombreDeLaBiometria(tipo: TipoDeBiometria | null): string {
  if (tipo === 'rostro') return Platform.OS === 'ios' ? 'Face ID' : 'tu rostro';
  if (tipo === 'huella') return Platform.OS === 'ios' ? 'Touch ID' : 'tu huella';
  if (tipo === 'iris') return 'tu iris';
  return 'tu biometría';
}

export type ResultadoBiometria = 'ok' | 'cancelado' | 'fallo' | 'no-disponible';

/** Pide la cara o la huella. `cancelado` incluye pulsar «Usar mi PIN». Nunca lanza. */
export async function autenticarConBiometria(motivo: string): Promise<ResultadoBiometria> {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Usar mi PIN',
      fallbackLabel: 'Usar mi PIN',
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    if (resultado.success) return 'ok';
    if (resultado.error === 'not_enrolled' || resultado.error === 'not_available' || resultado.error === 'passcode_not_set') {
      return 'no-disponible';
    }
    if (resultado.error === 'user_cancel' || resultado.error === 'system_cancel' || resultado.error === 'app_cancel' || resultado.error === 'user_fallback') {
      return 'cancelado';
    }
    return 'fallo';
  } catch {
    return 'no-disponible';
  }
}
