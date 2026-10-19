/**
 * Un carnet que ya es de otra cuenta frena la pantalla de identidad ANTES de pedir nada más.
 *
 * Qué pasa: al teclear el número, la app lo consulta al servidor (sin guardarlo). Si ya figura en
 * otra cuenta, el servidor bloquea esa conexión para el alta y responde `ONBOARDING_IP_BLOCKED`:
 * casi siempre es alguien probando la identidad de otra persona. La pantalla se queda con el
 * mensaje y sin botón de envío.
 *
 * Por qué no depende de esta consulta: el servidor repite la comprobación al recibir el paquete,
 * así que saltarse la app no sirve. Aquí solo se adelanta el aviso para no pedir tres selfies a
 * quien ya no puede seguir. Un fallo de red en la consulta se ignora; lo decide el envío.
 */
import { useEffect, useRef, useState } from 'react';
import * as onboardingApi from '../api/endpoints/onboarding';
import { AtlasApiError } from '../api/errors';

/** Código con el que el servidor corta el alta desde una conexión bloqueada. */
export const CODIGO_ALTA_BLOQUEADA = 'ONBOARDING_IP_BLOCKED';

/** Espera tras la última tecla: una consulta por número terminado, no una por dígito. */
export const ESPERA_DE_LA_CONSULTA_MS = 700;

export const esAltaBloqueada = (error: unknown): boolean => error instanceof AtlasApiError && error.code === CODIGO_ALTA_BLOQUEADA;

export function useCarnetDeOtraCuenta(customerId: string | null, numero: string, minimoDeDigitos: number) {
  const [bloqueo, setBloqueo] = useState<AtlasApiError | null>(null);
  const yaConsultado = useRef<string | null>(null);

  useEffect(() => {
    const limpio = numero.trim();
    if (!customerId || bloqueo || limpio.length < minimoDeDigitos || limpio === yaConsultado.current) return undefined;
    const espera = setTimeout(() => {
      yaConsultado.current = limpio;
      onboardingApi.checkIdentityDocument(customerId, limpio).catch((caught: unknown) => {
        if (esAltaBloqueada(caught)) setBloqueo(caught as AtlasApiError);
      });
    }, ESPERA_DE_LA_CONSULTA_MS);
    return () => clearTimeout(espera);
  }, [customerId, numero, minimoDeDigitos, bloqueo]);

  /** El envío también puede descubrir el bloqueo (la consulta falló por red o el servidor lo decidió ahí). */
  const alFallarElEnvio = (error: unknown) => {
    if (esAltaBloqueada(error)) setBloqueo(error as AtlasApiError);
  };

  return { bloqueo, alFallarElEnvio };
}
