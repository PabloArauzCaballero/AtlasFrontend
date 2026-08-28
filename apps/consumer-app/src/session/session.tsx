/**
 * Sesion del cliente final: restauracion al abrir, login, registro y cierre.
 *
 * Es la unica pieza que decide si la persona entra al area autenticada, sigue en onboarding o ve la
 * bienvenida. Las rutas consultan este estado; no lo reimplementan.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureClient } from '../api/client';
import * as authApi from '../api/endpoints/auth';
import * as customerApi from '../api/endpoints/customer';
import * as onboardingApi from '../api/endpoints/onboarding';
import * as telemetryApi from '../api/endpoints/telemetry';
import { deviceIdentity } from '../device/device';
import { permisosDecididos, type PermissionReport } from '../device/permissions';
import { profileStorage, secureTokenStore, type StoredProfile } from './token-storage';

export type SessionStatus = 'restoring' | 'anonymous' | 'authenticated';

export type SessionValue = {
  status: SessionStatus;
  customerId: string | null;
  profile: StoredProfile | null;
  /** Estado de onboarding cacheado: decide a que area entra la persona al abrir la app. */
  onboarding: onboardingApi.OnboardingStatus | null;
  me: customerApi.CustomerMe | null;
  refresh(): Promise<void>;
  signIn(identifier: string, password: string): Promise<void>;
  register(input: RegisterInput): Promise<onboardingApi.StartOnboardingResponse>;
  signOut(): Promise<void>;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  password: string;
  consents: { consentDocumentId: string; purposeCode: string; granted: boolean }[];
  permissions?: { permissionCode: 'notifications' | 'camera' | 'location'; granted: boolean }[];
};

/**
 * Los permisos decididos, como eventos de telemetria.
 *
 * Sin `deviceId` no se manda nada: el backend ata cada evento al vinculo cliente-dispositivo, y
 * mandarlo sin el produce un 4xx que no arregla nadie. Sin permisos decididos tampoco: un lote
 * vacio es una escritura sin informacion.
 */
async function enviarTelemetriaDePermisos(
  customerId: string,
  sessionId: string,
  deviceId: string | undefined,
  permisos: PermissionReport[],
): Promise<void> {
  if (!deviceId || permisos.length === 0) return;

  const momentos = permisos
    .map((permiso) => permiso.decidedAt)
    .filter((valor): valor is string => Boolean(valor))
    .sort();
  const ahora = new Date().toISOString();

  await telemetryApi.enviarLote(customerId, {
    sessionId,
    deviceId,
    capturedFrom: momentos[0] ?? ahora,
    capturedUntil: momentos[momentos.length - 1] ?? ahora,
    events: permisos.map((permiso) => ({
      eventType: 'permission_event' as const,
      eventCode: permiso.granted ? 'permission_granted' : 'permission_denied',
      occurredAt: permiso.decidedAt ?? ahora,
      // Que permiso se decidio, nunca lo que hay detras de el.
      metadata: { permissionCode: permiso.permissionCode },
    })),
  });
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  // El identificador de la sesion de telemetria abierta, para poder cerrarla al salir. En una
  // referencia y no en estado: cambiarlo no tiene que repintar nada.
  const sesionTelemetria = useRef<string | null>(null);
  /* El dispositivo con el que se abrio la sesion: el lote de telemetria no se puede atar sin el. */
  const dispositivoTelemetria = useRef<string | null>(null);
  const [onboarding, setOnboarding] = useState<onboardingApi.OnboardingStatus | null>(null);
  const [me, setMe] = useState<customerApi.CustomerMe | null>(null);

  useEffect(() => {
    configureClient({
      tokenStore: secureTokenStore,
      onSessionExpired: () => {
        setStatus('anonymous');
        setProfile(null);
        setOnboarding(null);
        setMe(null);
      },
    });
  }, []);

  const loadCustomerState = useCallback(async (customerId: string) => {
    // Se piden juntos y se toleran fallos parciales: que el perfil no cargue no debe impedir
    // entrar si el estado de onboarding si llego.
    const [statusResult, meResult] = await Promise.allSettled([
      onboardingApi.getStatus(customerId),
      customerApi.getMe(customerId),
    ]);
    if (statusResult.status === 'fulfilled') setOnboarding(statusResult.value);
    if (meResult.status === 'fulfilled') setMe(meResult.value);
  }, []);

  const restore = useCallback(async () => {
    const tokens = await secureTokenStore.read();
    const stored = await profileStorage.read();
    if (!tokens || !stored) {
      setStatus('anonymous');
      return;
    }
    setProfile(stored);
    try {
      await loadCustomerState(stored.customerId);
      setStatus('authenticated');
    } catch {
      // Token invalido o servidor caido: se conserva el perfil para poder reintentar, pero no se
      // deja entrar al area autenticada con datos que no se pudieron verificar.
      setStatus('anonymous');
    }
  }, [loadCustomerState]);

  useEffect(() => {
    void restore();
  }, [restore]);

  /*
    La sesion de telemetria: se abre al entrar y se cierra al salir.

    `startSession` existia en la capa de API desde el principio y **no lo llamaba nadie**. La unica
    fila de `telemetry.customer_sessions` que tenia un cliente era la que crea el alta, asi que de
    todo lo que hace despues —cuantas veces entra, desde que dispositivo, cuanto dura— no quedaba
    rastro. Eso no es telemetria de producto: es el registro con el que se reconstruye un fraude o
    se responde a un reclamo, y sin el la respuesta a «¿desde donde se hizo esta compra?» es que no
    se sabe.

    Falla en silencio a proposito. Abrir sesion es una anotacion, y una anotacion que no se puede
    escribir no puede impedir que alguien entre a ver cuanto debe.
  */
  const abrirSesionTelemetria = useCallback(async (customerId: string, authMethod: string) => {
    try {
      const device = await deviceIdentity();
      const permisos = await permisosDecididos();
      const { sessionId, deviceId } = await customerApi.startSession(customerId, {
        device: {
          deviceFingerprintHash: device.deviceFingerprintHash,
          fingerprintVersion: device.fingerprintVersion,
          channel: device.channel,
          userAgent: device.userAgent,
        },
        authMethod,
        locationPermissionGranted: permisos.find((permiso) => permiso.permissionCode === 'location')?.granted,
      });
      sesionTelemetria.current = sessionId;
      dispositivoTelemetria.current = deviceId ?? null;

      /*
       * Y ahora se ESCRIBE en la sesion recien abierta.
       *
       * Abrirla y no mandar nada era lo que pasaba hasta aqui: los permisos que la persona ya habia
       * decidido se consultaban para el alta y se tiraban. Van como `permission_event` —que hubo una
       * decision y cuando—, nunca el contenido detras del permiso.
       *
       * Falla en silencio por la misma razon que abrir la sesion: una anotacion que no se puede
       * escribir no puede impedir que alguien entre a ver cuanto debe.
       */
      await enviarTelemetriaDePermisos(customerId, sessionId, deviceId, permisos);
    } catch {
      sesionTelemetria.current = null;
      dispositivoTelemetria.current = null;
    }
  }, []);

  const signIn = useCallback<SessionValue['signIn']>(
    async (identifier, password) => {
      const tokens = await authApi.login(identifier, password);
      await secureTokenStore.write({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

      const actor = await authApi.me();
      const customerId = actor.customerId ?? actor.actorId;
      const stored: StoredProfile = { customerId, displayName: null, identifier };
      await profileStorage.write(stored);
      setProfile(stored);
      await loadCustomerState(customerId);
      setStatus('authenticated');
      void abrirSesionTelemetria(customerId, 'password');
    },
    [abrirSesionTelemetria, loadCustomerState],
  );

  const register = useCallback<SessionValue['register']>(
    async (input) => {
      const device = await deviceIdentity();
      const created = await onboardingApi.startOnboarding({
        customer: {
          phone: input.phone,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate,
        },
        password: input.password,
        consents: input.consents,
        device,
        /*
          Los permisos del sistema, consultados —no pedidos— en el momento del alta. Lo que llegara
          por `input.permissions` son los que la pantalla haya solicitado explicitamente; lo demas
          es el estado real del dispositivo, que hasta ahora no viajaba y dejaba
          `telemetry.permission_events` vacia para todos los clientes creados desde la app.
        */
        permissions: [...(input.permissions ?? []), ...(await permisosDecididos())],
        onboarding: { sourceType: 'mobile_app', startedStepCode: 'register' },
      });

      // El registro no devuelve tokens: se inicia sesion inmediatamente con las credenciales que la
      // persona acaba de definir, para no pedirle que las escriba dos veces.
      await signIn(input.email, input.password);
      return created;
    },
    [signIn],
  );

  const signOut = useCallback<SessionValue['signOut']>(async () => {
    const abierta = sesionTelemetria.current;
    const salienteId = profile?.customerId;
    if (abierta && salienteId) {
      // Cerrarla antes de revocar el token: despues ya no hay con que autenticar la llamada, y una
      // sesion que nunca se cierra se queda «activa» para siempre en la auditoria.
      await customerApi.endSession(salienteId, abierta).catch(() => undefined);
      sesionTelemetria.current = null;
    }
    const tokens = await secureTokenStore.read();
    if (tokens) {
      // Si la revocacion falla, la sesion local se cierra igual: dejar tokens en el dispositivo
      // porque el servidor no respondio seria el peor de los dos resultados.
      await authApi.logout(tokens.refreshToken).catch(() => undefined);
    }
    await Promise.all([secureTokenStore.clear(), profileStorage.clear()]);
    setProfile(null);
    setOnboarding(null);
    setMe(null);
    setStatus('anonymous');
  }, [profile?.customerId]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    await loadCustomerState(profile.customerId);
  }, [loadCustomerState, profile]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      customerId: profile?.customerId ?? null,
      profile,
      onboarding,
      me,
      refresh,
      signIn,
      register,
      signOut,
    }),
    [me, onboarding, profile, refresh, register, signIn, signOut, status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}

/**
 * Estados de cuenta que habilitan el area de compras.
 *
 * `active` es el unico estado plenamente operativo; el resto entra al area de onboarding o de
 * espera. La app no inventa la regla: refleja `lifecycleStatus` y `eligible` del servidor.
 */
export function areaFor(session: SessionValue): 'auth' | 'onboarding' | 'app' {
  if (session.status !== 'authenticated' || !session.customerId) return 'auth';
  const lifecycle = session.onboarding?.lifecycleStatus ?? session.me?.customer.status ?? 'registered';
  if (lifecycle === 'active') return 'app';
  return 'onboarding';
}
