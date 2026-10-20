/**
 * Un carnet que ya es de otra cuenta se avisa en la pantalla de identidad ANTES de pedir las fotos.
 *
 * Qué pasa: al teclear el número, la app lo consulta al servidor (sin guardarlo). Hay dos respuestas:
 *  - `IDENTITY_DOCUMENT_ALREADY_REGISTERED` (409): ese carnet ya tiene cuenta. NO bloquea: la persona
 *    se equivocó o ya tenía cuenta. Se muestra el aviso y no se puede enviar MIENTRAS el número sea ese;
 *    al corregirlo, el aviso se va.
 *  - `ONBOARDING_IP_BLOCKED` (403): reincidió con varios carnets o correos ya registrados y el servidor
 *    bloqueó la conexión, el dispositivo y la cuenta. La pantalla se queda sin envío ni cámara.
 *
 * Por qué no depende de esta consulta: el servidor repite la comprobación al recibir el paquete, así
 * que saltarse la app no sirve. Aquí solo se adelanta el aviso para no pedir tres selfies a quien no
 * puede seguir. Un fallo de red en la consulta se ignora; lo decide el envío.
 */
import { useEffect, useRef, useState } from 'react';
import * as onboardingApi from '../api/endpoints/onboarding';
import { AtlasApiError } from '../api/errors';

/** Código con el que el servidor corta el alta desde una conexión bloqueada. */
export const CODIGO_ALTA_BLOQUEADA = 'ONBOARDING_IP_BLOCKED';

/** Espera tras la última tecla: una consulta por número terminado, no una por dígito. */
export const ESPERA_DE_LA_CONSULTA_MS = 700;

/** Código con el que el servidor avisa de que ese carnet ya tiene cuenta (sin bloquear). */
export const CODIGO_CARNET_REGISTRADO = 'IDENTITY_DOCUMENT_ALREADY_REGISTERED';

export const esAltaBloqueada = (error: unknown): boolean => error instanceof AtlasApiError && error.code === CODIGO_ALTA_BLOQUEADA;
export const esCarnetRegistrado = (error: unknown): boolean => error instanceof AtlasApiError && error.code === CODIGO_CARNET_REGISTRADO;

export function useCarnetDeOtraCuenta(customerId: string | null, numero: string, minimoDeDigitos: number) {
  const [bloqueo, setBloqueo] = useState<AtlasApiError | null>(null);
  // El aviso es de UN número: al cambiarlo deja de valer, sin esperar a otra consulta.
  const [registrado, setRegistrado] = useState<{ numero: string; error: AtlasApiError } | null>(null);
  const yaConsultado = useRef<string | null>(null);

  useEffect(() => {
    const limpio = numero.trim();
    if (!customerId || bloqueo || limpio.length < minimoDeDigitos || limpio === yaConsultado.current) return undefined;
    const espera = setTimeout(() => {
      yaConsultado.current = limpio;
      onboardingApi.checkIdentityDocument(customerId, limpio).catch((caught: unknown) => {
        if (esAltaBloqueada(caught)) setBloqueo(caught as AtlasApiError);
        else if (esCarnetRegistrado(caught)) setRegistrado({ numero: limpio, error: caught as AtlasApiError });
      });
    }, ESPERA_DE_LA_CONSULTA_MS);
    return () => clearTimeout(espera);
  }, [customerId, numero, minimoDeDigitos, bloqueo]);

  /** El envío también puede descubrirlo (la consulta falló por red o el servidor lo decidió ahí). */
  const alFallarElEnvio = (error: unknown) => {
    if (esAltaBloqueada(error)) setBloqueo(error as AtlasApiError);
    else if (esCarnetRegistrado(error)) setRegistrado({ numero: numero.trim(), error: error as AtlasApiError });
  };

  const avisoDelCarnet = registrado && registrado.numero === numero.trim() ? registrado.error : null;
  return { bloqueo, avisoDelCarnet, alFallarElEnvio };
}
