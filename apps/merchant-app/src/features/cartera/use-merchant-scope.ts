/**
 * Sobre qué comercio trabaja «Consumo y facturación». Copia de `AtlasERPFrontend/hooks/useMerchantScope.ts`.
 *
 * ## El comercio no elige comercio
 *
 * El negocio sobre el que se opera es el que inició sesión, así que lo normal es no mandar ningún
 * `accountId`: el backend lo deriva de sus membresías. La única excepción es quien administra MÁS
 * DE UN comercio, y lo que elige son sus propias cuentas, nunca el catálogo de la plataforma.
 *
 * ## Por qué lo contesta el servidor
 *
 * `GET /portal/scope` es la única fuente de verdad. Si falla, se dice (`error`) y `ready` se queda
 * en `false`: no se asume un alcance para disparar peticiones que fallarían más abajo con un mensaje
 * que no señala la causa. Personal interno aquí es una avería, no un modo, y también se dice.
 *
 * Única diferencia con la web: `recargar`, para el gesto de tirar hacia abajo.
 */
import { useCallback, useEffect, useState } from 'react';
import { portalService } from '@/api/servicios/portalService';
import { textoDeFallo } from './formato';

export interface MerchantScope {
  isMerchant: boolean;
  /** Cuenta sobre la que operar, o `undefined` cuando la deriva el backend (lo normal). */
  accountId: string | undefined;
  setAccountId: (value: string) => void;
  /** Los comercios DEL PROPIO usuario. Nunca el catálogo de la plataforma. */
  accountOptions: { value: string; label: string }[];
  /** `true` únicamente cuando el usuario pertenece a más de un comercio. */
  requiresSelection: boolean;
  /** `false` mientras falte por resolver el alcance o por elegir cuenta: no hay nada que pedir. */
  ready: boolean;
  error: string | null;
  recargar: () => void;
}

interface Alcance {
  isInternalOperator: boolean;
  requiresAccountSelection: boolean;
  accounts: { id: string; name: string }[];
}

export const MENSAJE_PERSONAL_INTERNO =
  'Esta sección es del portal del comercio y opera sobre el negocio que inició sesión. Tu usuario es personal interno de Atlas: entra desde Operaciones para atender a un comercio.';

/** La regla de `ready`/`requiresSelection`, sin React, para probarla. */
export function resolverAlcance(scope: Alcance | null, accountId: string) {
  const isMerchant = scope ? !scope.isInternalOperator : false;
  // Elegir es cosa de tener VARIAS cuentas propias, no de `requiresAccountSelection`, que el
  // backend también levanta para el staff interno.
  const requiresSelection = isMerchant && (scope?.accounts.length ?? 0) > 1;
  return {
    isMerchant,
    requiresSelection,
    accountId: requiresSelection ? accountId || undefined : undefined,
    ready: scope !== null && isMerchant && (!requiresSelection || Boolean(accountId)),
  };
}

export function useMerchantScope(): MerchantScope {
  const [scope, setScope] = useState<Alcance | null>(null);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let cancelled = false;
    portalService
      .getScope()
      .then((result) => {
        if (cancelled) return;
        setScope(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(textoDeFallo(cause, 'No se pudo determinar sobre qué comercio puedes operar.'));
      });
    return () => {
      cancelled = true;
    };
  }, [vuelta]);

  const elegir = useCallback((value: string) => setAccountId(value), []);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  const resuelto = resolverAlcance(scope, accountId);

  return {
    ...resuelto,
    setAccountId: elegir,
    accountOptions: (scope?.accounts ?? []).map((account) => ({ value: account.id, label: account.name })),
    error: error ?? (scope?.isInternalOperator ? MENSAJE_PERSONAL_INTERNO : null),
    recargar,
  };
}
