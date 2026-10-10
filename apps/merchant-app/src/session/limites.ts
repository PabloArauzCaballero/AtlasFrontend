/**
 * Límite de inactividad de la sesión: el de `AtlasERPFrontend/lib/sessionLimits.ts`, igual para el
 * comercio que para el personal interno. 15 minutos sin tocar la app cierran la sesión, con aviso un
 * minuto antes.
 */
export const IDLE_LIMIT_MS = 15 * 60_000;
export const WARNING_BEFORE_MS = 60_000;

export function msHastaElCierre(ultimaActividad: number, ahora: number): number {
  return Math.max(0, ultimaActividad + IDLE_LIMIT_MS - ahora);
}

export type FaseDeSesion = { fase: 'activa' } | { fase: 'aviso'; segundos: number } | { fase: 'cerrar' };

export function faseDeSesion(ultimaActividad: number, ahora: number): FaseDeSesion {
  const restante = msHastaElCierre(ultimaActividad, ahora);
  if (restante === 0) return { fase: 'cerrar' };
  if (restante <= WARNING_BEFORE_MS) return { fase: 'aviso', segundos: Math.ceil(restante / 1000) };
  return { fase: 'activa' };
}
