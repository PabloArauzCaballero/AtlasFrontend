/**
 * En el navegador no hay Face ID ni huella que pedir: el bloqueo local es solo del telefono.
 * Misma forma que `biometria.ts` para que nada que lo importe tenga que preguntar la plataforma.
 */
export type TipoDeBiometria = 'rostro' | 'huella' | 'iris';
export type Biometria = { disponible: boolean; tipo: TipoDeBiometria | null };
export type ResultadoBiometria = 'ok' | 'cancelado' | 'fallo' | 'no-disponible';

export async function leerBiometria(): Promise<Biometria> {
  return { disponible: false, tipo: null };
}

export function nombreDeLaBiometria(_tipo: TipoDeBiometria | null): string {
  return 'tu biometría';
}

export async function autenticarConBiometria(_motivo: string): Promise<ResultadoBiometria> {
  return 'no-disponible';
}
