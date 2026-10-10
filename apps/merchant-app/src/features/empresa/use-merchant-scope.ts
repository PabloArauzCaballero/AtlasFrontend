/**
 * Sobre qué comercio trabaja la pestaña «Sucursales». Copia de `AtlasERPFrontend/hooks/useMerchantScope.ts`.
 *
 * El comercio no elige comercio: el negocio sobre el que se opera es el que inició sesión, y su
 * alcance lo deriva el backend (`GET /portal/scope`). Lo único que se pregunta —y sólo a quien
 * administra VARIOS negocios propios— es con cuál de los suyos sigue. Si el alcance dice «operador
 * interno», es una avería y se dice, en vez de pintarle todos los comercios de la plataforma.
 */
import { useCallback, useEffect, useState } from 'react';
import { mensajeDeError } from '@/api/client';
import { portalService } from '@/api/servicios/portalService';

export interface MerchantScope {
  isMerchant: boolean;
  accountId: string | undefined;
  setAccountId: (value: string) => void;
  accountOptions: { valor: string; etiqueta: string }[];
  requiresSelection: boolean;
  ready: boolean;
  error: string | null;
}

interface Alcance {
  isInternalOperator: boolean;
  requiresAccountSelection: boolean;
  accounts: { id: string; name: string }[];
}

/** La decisión, sin React: de lo que contestó el backend a lo que puede hacer la pantalla. */
export function resolverAlcance(scope: Alcance | null, accountId: string, error: string | null): Omit<MerchantScope, 'setAccountId'> {
  const isMerchant = scope ? !scope.isInternalOperator : false;
  // Elegir es cosa de tener VARIAS cuentas propias, no de `requiresAccountSelection` (que también es true para el staff).
  const requiresSelection = isMerchant && (scope?.accounts.length ?? 0) > 1;
  return {
    isMerchant,
    accountId: requiresSelection ? accountId || undefined : undefined,
    accountOptions: (scope?.accounts ?? []).map((account) => ({ valor: account.id, etiqueta: account.name })),
    requiresSelection,
    ready: scope !== null && isMerchant && (!requiresSelection || Boolean(accountId)),
    error:
      error ??
      (scope?.isInternalOperator
        ? 'Esta sección es del portal del comercio y opera sobre el negocio que inició sesión. Tu usuario es personal interno de Atlas: entra desde Operaciones para atender a un comercio.'
        : null),
  };
}

export function useMerchantScope(): MerchantScope {
  const [scope, setScope] = useState<Alcance | null>(null);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    portalService
      .getScope()
      .then((result) => {
        if (!cancelled) setScope(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(mensajeDeError(cause, 'No se pudo determinar sobre qué comercio puedes operar.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const elegir = useCallback((value: string) => setAccountId(value), []);
  return { ...resolverAlcance(scope, accountId, error), setAccountId: elegir };
}
