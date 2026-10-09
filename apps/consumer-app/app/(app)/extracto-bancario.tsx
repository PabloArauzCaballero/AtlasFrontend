/**
 * Recalcular la línea con el extracto bancario, ya con la cuenta activa. La pantalla es la misma que
 * el último paso del alta: ver `src/features/onboarding/pantalla-extracto.tsx`.
 */
import { PantallaExtracto } from '../../src/features/onboarding/pantalla-extracto';
import { useSinCapturas } from '../../src/device/sin-capturas';

export default function ExtractoBancario() {
  // PIN, carnet o datos bancarios: sin capturas ni grabaciones de pantalla (APP-18).
  useSinCapturas('extracto-bancario');
  return <PantallaExtracto />;
}
