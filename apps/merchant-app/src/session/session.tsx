/**
 * La sesión del comercio: el equivalente de `AuthProvider` del portal web, sólo con el canal del comercio.
 *
 * Al abrir, `bootstrapSession` intenta renovar con la cookie de refresco que guarda el teléfono; si
 * vale, se pide el perfil y se entra sin pedir la contraseña. `sessionAttempt` descarta respuestas
 * viejas: un login que termina mientras el arranque seguía pendiente no puede pisarse con su fallo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { alCerrarseLaSesion, bootstrapSession, clearAccessToken, finishPendingRefresh, setAccessToken } from '../api/client';
import { authApi, type MerchantUserProfile } from '../api/endpoints/auth';

export type SessionStatus = 'restoring' | 'anonymous' | 'authenticated';

type SessionValue = {
  status: SessionStatus;
  merchant: MerchantUserProfile | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [merchant, setMerchant] = useState<MerchantUserProfile | null>(null);
  const sessionAttempt = useRef(0);

  useEffect(() => {
    const attempt = ++sessionAttempt.current;
    void (async () => {
      try {
        if (!(await bootstrapSession())) throw new Error('sin sesión');
        const profile = await authApi.me();
        if (attempt !== sessionAttempt.current) return;
        setMerchant(profile.user);
        setStatus('authenticated');
      } catch {
        if (attempt !== sessionAttempt.current) return;
        clearAccessToken();
        setMerchant(null);
        setStatus('anonymous');
      }
    })();
  }, []);

  useEffect(
    () =>
      alCerrarseLaSesion(() => {
        sessionAttempt.current += 1;
        setMerchant(null);
        setStatus('anonymous');
      }),
    [],
  );

  const login = useCallback(async (input: { email: string; password: string }) => {
    const result = await authApi.login(input);
    sessionAttempt.current += 1;
    setAccessToken(result.accessToken);
    setMerchant(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    sessionAttempt.current += 1;
    await finishPendingRefresh();
    try {
      await authApi.logout();
    } catch {
      // Idempotente en el backend; si la llamada falla igual se limpia la sesión local.
    }
    clearAccessToken();
    setMerchant(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => ({ status, merchant, login, logout }), [status, merchant, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return value;
}
