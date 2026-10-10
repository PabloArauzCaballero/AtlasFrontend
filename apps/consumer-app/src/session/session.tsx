/**
 * Sesion del cliente final: restauracion al abrir, login, registro y cierre.
 *
 * Es la unica pieza que decide si la persona entra al area autenticada, sigue en onboarding o ve la
 * bienvenida. Las rutas consultan este estado; no lo reimplementan.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { configureClient } from '../api/client';
import { esMarcaDeCookie, marcaDeCookie } from '../api/marca-de-cookie';
import * as authApi from '../api/endpoints/auth';
import * as customerApi from '../api/endpoints/customer';
import * as onboardingApi from '../api/endpoints/onboarding';
import * as telemetryApi from '../api/endpoints/telemetry';
import { deviceIdentity, snapshotDeSesion } from '../device/device';
import { permisosDecididos, type PermissionReport } from '../device/permissions';
import type { ContextoDeRastreo } from '../device/tracking-context';
import { activarSeñalesDelDispositivo, desactivarSeñalesDelDispositivo } from './device-signals';
import { profileStorage, secureTokenStore, type StoredProfile } from './token-storage';
import { bitacora } from '../features/bitacora';
import { olvidarPinConfirmado } from '../features/pin-verificado';
import { bloquearAlArrancar, marcarSesionRecienAbierta, olvidarBloqueo } from '../features/bloqueo-local';
import { cancelarRepasos } from '../features/refresco';
import { guardarInicioConPin, leerInicioConPin, olvidarInicioConPin, sesionVencida, type MotivoDeSalida } from './tope-de-sesion';
import { useRastreoEnPrimerPlano } from './use-rastreo-primer-plano';
import { cerrarSesionEnServidor } from './cierre-de-sesion';
import { useLatidoDeSesion, type ContextoDeLatido } from './use-latido-de-sesion';
import { limpiarDatosLocales } from './datos-locales';

export type SessionStatus = 'restoring' | 'anonymous' | 'authenticated';

/**
 * Lo mas que espera «Cerrar sesión» a la red. Despues, la sesion LOCAL se cierra igual y la persona
 * ve la pantalla de entrada: con la red colgada no puede quedarse mirando un boton que gira. Lo que
 * faltara del servidor (revocar el token) sigue en segundo plano.
 */
export const PLAZO_SALIDA_MS = 6_000;

/** Cada cuanto se mira el tope de 8 h con la app abierta (ademas de al volver al frente). */
const REVISION_DEL_TOPE_MS = 60_000;
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
  /** Por que se cerro la ultima sesion sin pedirlo, para decirlo en la pantalla de entrada. */
  motivoDeSalida: MotivoDeSalida | null;
  /**
   * `servidorYaRevoco`: el servidor ya cerró TODAS las sesiones (cambio de PIN). Se salta lo que habla con él con
   * el token muerto —cada llamada daba 401, intentaba refrescar y esperaba— y se cierra sólo lo local.
   * `motivo`: por qué se cierra sin que la persona lo pidiera (el tope de 8 h).
   *
   * Nunca tarda más de `PLAZO_SALIDA_MS` y nunca lanza: funcione o no la red, termina en la pantalla de entrada.
   */
  signOut(opciones?: { servidorYaRevoco?: boolean; motivo?: MotivoDeSalida }): Promise<void>;
  /**
   * Vuelve a registrar los consentimientos y a encender las señales con la decision de permisos
   * que la persona acaba de tomar. Lo llama la pantalla de permisos cuando se abre DENTRO del alta:
   * sin esto, la decision solo llegaria al servidor en el siguiente inicio de sesion, y la seccion
   * `device_permissions` seguiria pendiente.
   */
  reactivarSeñales(): Promise<void>;
};

export type RegisterInput = {
  /*
    Desde el 2026-09-18 el nombre y la fecha de nacimiento NO se piden al crear la cuenta: los lee
    el carnet en la fase 2 y la persona los confirma. Siguen aceptandose por si una pantalla vieja
    los manda.
  */
  firstName?: string;
  lastName?: string;
  birthDate?: string;
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
  /*
    El contexto del rastreo SI va en estado y no en una referencia, al reves que los dos de arriba.

    Es lo unico de aqui que tiene que hacer repintar: el temporizador de primer plano
    (`useRastreoEnPrimerPlano`) se enciende cuando aparece y se apaga cuando desaparece, y con una
    referencia el efecto no se enteraria de que ya hay sesion con la que medir.
  */
  const [rastreo, setRastreo] = useState<ContextoDeRastreo | null>(null);
  /*
    La sesion a la que se le manda el latido. En estado por lo mismo que `rastreo`: el latido se
    enciende cuando aparece y se apaga cuando desaparece. Aparte de `rastreo` porque no depende de
    que las señales del dispositivo se activen: basta con que la sesion este abierta.
  */
  const [latido, setLatido] = useState<ContextoDeLatido | null>(null);
  const [motivoDeSalida, setMotivoDeSalida] = useState<MotivoDeSalida | null>(null);
  /*
    La persona (o el tope) pidio salir. Lo que siga hablando con el servidor despues —la revocacion va en
    segundo plano si la red tarda— puede acabar en un refresco rechazado: eso no es «se cerro tu sesion».
  */
  const salidaPedida = useRef(false);

  useEffect(() => {
    configureClient({
      tokenStore: secureTokenStore,
      /*
        El servidor RECHAZO el refresco: los tokens ya se borraron. Se cierra lo local (rastreo, latido,
        candado, repasos pendientes) y se dice por que. Las compras de prueba y el perfil guardado NO se
        borran: puede ser la misma persona que vuelve a entrar en un minuto (ver `datos-locales.ts`).
        El area autenticada redirige sola al ingreso al ver `anonymous`.
      */
      onSessionExpired: (codigo) => {
        if (salidaPedida.current) return;
        setRastreo(null);
        setLatido(null);
        olvidarPinConfirmado();
        olvidarBloqueo();
        cancelarRepasos();
        void olvidarInicioConPin();
        void desactivarSeñalesDelDispositivo().catch(() => undefined);
        sesionTelemetria.current = null;
        setMotivoDeSalida(codigo === 'SESSION_EXPIRED' ? 'sesion_caducada' : 'sesion_cerrada');
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
      // Lo pide la sesion (al restaurar o tras entrar), no una pantalla: sin esto la carga de cada
      // arranque marcaba como usada la pantalla de entrada, tambien a quien sigue en el registro.
      onboardingApi.getStatus(customerId, { sinPantalla: true }),
      customerApi.getMe(customerId, { sinPantalla: true }),
    ]);
    if (statusResult.status === 'fulfilled') setOnboarding(statusResult.value);
    if (meResult.status === 'fulfilled') setMe(meResult.value);
    return statusResult.status === 'fulfilled' ? statusResult.value : null;
  }, []);

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
          /*
            El detalle del teléfono en CADA inicio de sesión, no sólo en el alta. Sin esto, entrar después desde
            un emulador o desde otro modelo no dejaba rastro: la IP la toma el servidor de la conexión, pero la
            marca, el modelo y si hay root o emulador sólo los puede decir el dispositivo.
          */
          snapshot: snapshotDeSesion(device.snapshot),
        },
        authMethod,
        locationPermissionGranted: permisos.find((permiso) => permiso.permissionCode === 'location')?.granted,
      }, { sinPantalla: true });
      sesionTelemetria.current = sessionId;
      dispositivoTelemetria.current = deviceId ?? null;
      // El latido exige el `deviceId` de la sesion: sin el, el servidor responderia 400 a cada uno.
      setLatido(deviceId ? { customerId, sessionId, deviceId } : null);

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

      /*
        La bitacora del alta ya puede vaciarse: ahora existen la sesion y el dispositivo a los que
        el servidor exige atar cada lote. Lo anotado antes de este momento —desde «Crear mi cuenta»—
        sale ahora con sus marcas de tiempo originales.
      */
      if (deviceId) bitacora.adjuntarSesion({ customerId, sessionId, deviceId });

      /*
       * Y ahora las dos señales que la persona autorizo al arrancar: la agenda y la ubicacion.
       *
       * Va DESPUES de abrir la sesion de telemetria porque necesita su `deviceId` y su `sessionId`:
       * el servidor ata cada entrega al vinculo cliente-dispositivo y sin el responde 403. Ver
       * `session/device-signals.ts`, que registra el consentimiento antes de leer nada.
       */
      if (deviceId) {
        setRastreo({ customerId, deviceId, sessionId });
        await activarSeñalesDelDispositivo({ customerId, deviceId, sessionId });
      }
    } catch {
      sesionTelemetria.current = null;
      dispositivoTelemetria.current = null;
    }
  }, []);

  /* `signOut` desde `restore` y desde el vigilante del tope, que se declaran antes que el. */
  const signOutRef = useRef<SessionValue['signOut'] | null>(null);

  const restore = useCallback(async () => {
    const tokens = await secureTokenStore.read();
    const stored = await profileStorage.read();
    if (!tokens || !stored) {
      setStatus('anonymous');
      return;
    }
    /*
      El tope de 8 h, ANTES de enseñar nada: una sesion vencida (o de la que no se sabe cuando se abrio)
      no entra ni a la portada; se cierra —tambien en el servidor— y se pide el PIN con su motivo.
    */
    if (sesionVencida(await leerInicioConPin(), Date.now())) {
      setProfile(stored);
      await signOutRef.current?.({ motivo: 'sesion_caducada' });
      return;
    }
    setProfile(stored);
    try {
      const estado = await loadCustomerState(stored.customerId);
      /*
        `loadCustomerState` no lanza (tolera fallos parciales): si el refresco fue RECHAZADO mientras
        cargaba, el almacen ya esta vacio y `onSessionExpired` ya saco a la persona. Marcarla dentro
        aqui la devolvia a un area autenticada sin sesion. En la web es el caso de cada recarga con la
        cookie vencida.
      */
      if (!(await secureTokenStore.read())) {
        setProfile(null);
        setStatus('anonymous');
        return;
      }
      // Abrir en frio con una sesion guardada SIEMPRE pide Face ID o el PIN (APP-13), antes del primer fotograma.
      bloquearAlArrancar();
      setStatus('authenticated');
      /*
        Quien vuelve con el alta a medias retoma su bitacora ANTES de que la sesion de telemetria la
        vacie: lo guardado en disco sale con su linea de tiempo original, y lo que haga desde ahora
        se anota a continuacion. Con la cuenta ya activa no hay nada que retomar.
      */
      if (estado && estado.lifecycleStatus !== 'active') await bitacora.arrancar('reanudado');
      /*
        Al RESTAURAR tambien se abre sesion de telemetria y se reactivan las señales.
        
        Sin esto, quien abre la app con sesion valida —que es el caso normal a partir del segundo
        dia— no volvia a medir nunca hasta el siguiente login, y el rastreo de segundo plano se
        quedaba apuntando a la sesion de telemetria del dia que se registro.
      */
      void abrirSesionTelemetria(stored.customerId, 'restored_session');
    } catch {
      // Token invalido o servidor caido: se conserva el perfil para poder reintentar, pero no se
      // deja entrar al area autenticada con datos que no se pudieron verificar.
      setStatus('anonymous');
    }
  }, [abrirSesionTelemetria, loadCustomerState]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const signIn = useCallback<SessionValue['signIn']>(
    async (identifier, password) => {
      const tokens = await authApi.login(identifier, password);
      salidaPedida.current = false;
      // En la web (modo cookie) el token de refresco no llega: lo guarda el navegador en una cookie HttpOnly.
      await secureTokenStore.write({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? marcaDeCookie() });

      const actor = await authApi.me();
      const customerId = actor.customerId ?? actor.actorId;
      /*
        Entra un cliente DISTINTO del último que hubo en este teléfono (APP-09). Si el anterior salió
        con `signOut` ya está limpio; si su sesión CADUCÓ, `onSessionExpired` no borró nada y sus
        compras de prueba, la lectura de su carnet y sus fotos seguirían ahí. Ver `datos-locales.ts`.
      */
      const anterior = await profileStorage.read().catch(() => null);
      if (anterior && anterior.customerId !== customerId) await limpiarDatosLocales();
      const stored: StoredProfile = { customerId, displayName: null, identifier };
      await profileStorage.write(stored);
      setProfile(stored);
      await loadCustomerState(customerId);
      // Acaba de escribir su PIN: el bloqueo local (APP-13) no se lo vuelve a pedir al entrar, y el tope de 8 h empieza ahora.
      marcarSesionRecienAbierta();
      await guardarInicioConPin(Date.now());
      setMotivoDeSalida(null);
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

  /* El cierre en curso: pulsar dos veces, o que lo pidan el candado y el tope a la vez, no cierra dos veces. */
  const saliendo = useRef<Promise<void> | null>(null);
  const perfilActual = useRef<StoredProfile | null>(null);
  perfilActual.current = profile;

  const signOut = useCallback<SessionValue['signOut']>((opciones) => {
    if (saliendo.current) return saliendo.current;
    const servidorYaRevoco = opciones?.servidorYaRevoco === true;
    salidaPedida.current = true;
    const tarea = (async () => {
      /*
        Se apaga el rastreo ANTES de revocar el token.

        El sistema recuerda la tarea de ubicacion entre arranques de la app: si no se detiene aqui,
        sigue despertando el bundle y mandando posiciones de alguien que ya cerro sesion, con un token
        que ya no vale. La tarea sabe apagarse sola al no encontrar contexto, pero eso ocurre en la
        siguiente posicion y no ahora.
      */
      setRastreo(null);
      // Quien entre después en este teléfono NO hereda un PIN confirmado: «Mis datos» lo vuelve a pedir.
      olvidarPinConfirmado();
      // Ni candado a la vista ni nada que herede quien entre después (APP-13).
      olvidarBloqueo();
      // Ni un repaso de datos pendiente con la sesion que se cierra.
      cancelarRepasos();
      // El latido se apaga lo primero: ni un latido mas de una sesion que se esta cerrando.
      setLatido(null);

      const abierta = sesionTelemetria.current;
      sesionTelemetria.current = null;
      const salienteId = perfilActual.current?.customerId;
      const tokens = await secureTokenStore.read().catch(() => null);

      /*
        Lo que habla con el servidor, con PLAZO. Antes se esperaba paso a paso —bitacora, cierre de la
        sesion de telemetria, revocacion— y con la red lenta «Cerrar sesión» se quedaba girando sin
        llevar a ninguna parte. Ahora, pasado `PLAZO_SALIDA_MS`, la sesion local se cierra igual y lo
        que falte sigue en segundo plano.
      */
      const enElServidor = (async () => {
        await desactivarSeñalesDelDispositivo().catch(() => undefined);
        if (servidorYaRevoco) return;
        // Lo que quede de bitacora sale con el token todavia valido; despues se borra del disco.
        await bitacora.cerrar().catch(() => undefined);
        // Cerrarla antes de revocar el token: despues ya no hay con que autenticar la llamada. Ver `cierre-de-sesion.ts`.
        if (abierta && salienteId) await cerrarSesionEnServidor(salienteId, abierta);
        // Si la revocacion falla, la sesion local se cierra igual. En la web el token está en la cookie.
        if (tokens) await authApi.logout(esMarcaDeCookie(tokens.refreshToken) ? null : tokens.refreshToken).catch(() => undefined);
      })();
      let plazo: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        enElServidor,
        new Promise<void>((resolve) => {
          plazo = setTimeout(resolve, PLAZO_SALIDA_MS);
        }),
      ]);
      clearTimeout(plazo);

      await Promise.all([
        secureTokenStore.clear().catch(() => undefined),
        profileStorage.clear().catch(() => undefined),
        olvidarInicioConPin(),
      ]);
      // Compras de prueba, lectura del carnet, fotos y descargas: quien entre después no las hereda.
      await limpiarDatosLocales().catch(() => undefined);
    })()
      .catch(() => undefined)
      .finally(() => {
        // Pase lo que pase arriba, la sesion LOCAL termina cerrada: el area autenticada redirige al ingreso.
        setProfile(null);
        setOnboarding(null);
        setMe(null);
        setMotivoDeSalida(opciones?.motivo ?? null);
        setStatus('anonymous');
        saliendo.current = null;
      });
    saliendo.current = tarea;
    return tarea;
  }, []);
  signOutRef.current = signOut;

  /*
    El tope de 8 h con la app abierta: al volver al frente y cada minuto. Al abrir en frio lo mira `restore`.
  */
  useEffect(() => {
    if (status !== 'authenticated') return;
    let vigente = true;
    const revisar = async () => {
      const inicio = await leerInicioConPin();
      if (vigente && sesionVencida(inicio, Date.now())) await signOutRef.current?.({ motivo: 'sesion_caducada' });
    };
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar();
    });
    const reloj = setInterval(() => void revisar(), REVISION_DEL_TOPE_MS);
    return () => {
      vigente = false;
      suscripcion.remove();
      clearInterval(reloj);
    };
  }, [status]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    await loadCustomerState(profile.customerId);
  }, [loadCustomerState, profile]);

  const reactivarSeñales = useCallback(async () => {
    const customerId = profile?.customerId;
    const deviceId = dispositivoTelemetria.current;
    const sessionId = sesionTelemetria.current;
    if (!customerId || !deviceId) return;
    try {
      setRastreo({ customerId, deviceId, sessionId });
      await activarSeñalesDelDispositivo({ customerId, deviceId, sessionId });
    } catch {
      // Igual que al abrir sesion: la evidencia se pierde, el alta no.
    }
  }, [profile?.customerId]);

  // El temporizador de primer plano vive aqui porque aqui esta el contexto y aqui se sabe si la
  // persona tiene sesion: montarlo en una pantalla lo apagaria al navegar a otra.
  useRastreoEnPrimerPlano(rastreo, status === 'authenticated' && rastreo !== null);
  // El latido, por la misma razon: vive con la sesion, no con una pantalla. Ver `use-latido-de-sesion.ts`.
  useLatidoDeSesion(status === 'authenticated' ? latido : null);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      customerId: profile?.customerId ?? null,
      profile,
      onboarding,
      me,
      motivoDeSalida,
      refresh,
      signIn,
      register,
      signOut,
      reactivarSeñales,
    }),
    [me, motivoDeSalida, onboarding, profile, reactivarSeñales, refresh, register, signIn, signOut, status],
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
