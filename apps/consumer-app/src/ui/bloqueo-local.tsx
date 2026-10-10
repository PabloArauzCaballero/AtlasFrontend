/**
 * La capa que tapa la app y pide Face ID / Touch ID / huella o el PIN (APP-13).
 *
 * La regla vive en `features/bloqueo-local.ts` (`crearVigilante`); aqui solo se le pasan los cambios
 * de `AppState`, los toques de pantalla y un reloj, y se dibuja. Se monta UNA vez, en la raiz, y solo
 * hace algo con sesion abierta y en el telefono: en el navegador no hay biometria y la sesion web ya
 * vive lo que vive la pestaña.
 *
 * No es opcional: no hay ajuste en el perfil que lo apague. Con biometria registrada se pide la
 * biometria; sin ella, el PIN.
 *
 * ## Lo que NO hace
 *
 * Cerrar la sesion. Desbloquear no pide al servidor ninguna sesion nueva; el PIN se comprueba con
 * `/auth/pin/verify`, que solo dice si es el de la cuenta de la sesion y nunca expulsa por un dedo
 * torpe. «Salir de la cuenta» esta, para quien no es el dueño o no recuerda el PIN, y es la persona
 * quien lo elige. El cierre por tiempo es el tope de 8 h (`session/tope-de-sesion.ts`).
 *
 * ## Por que un `Modal`
 *
 * Una vista absoluta quedaria DEBAJO de cualquier hoja abierta (las hojas son `Modal`): quien se fue
 * con «Confirma tu PIN» o una hoja de ayuda a la vista volveria a verla encima del candado. El
 * `Modal` se presenta por encima de todo, y su `onRequestClose` vacio deja el boton atras de Android
 * sin efecto.
 */
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { AtlasApiError } from '../api/errors';
import { verifyPin } from '../api/endpoints/auth';
import { autenticarConBiometria, leerBiometria, nombreDeLaBiometria, type Biometria } from '../device/biometria';
import { useSinCapturas } from '../device/sin-capturas';
import {
  bloquear,
  crearVigilante,
  desbloquear,
  estaBloqueada,
  REVISION_MS,
  suscribirBloqueo,
  suscribirInteraccion,
} from '../features/bloqueo-local';
import { useSession } from '../session/session';
import { color, marca, space } from '../theme/tokens';
import { AtlasLogo } from './brand';
import { PinField } from './pin-field';
import { AtlasText, Button, Cargando } from './primitives';

export function BloqueoLocal() {
  const session = useSession();
  const enTelefono = Platform.OS !== 'web';
  const conSesion = session.status === 'authenticated' && enTelefono;
  const bloqueada = useSyncExternalStore(suscribirBloqueo, estaBloqueada, estaBloqueada);
  const [biometria, setBiometria] = useState<Biometria | null>(null);

  /* La biometria del telefono: al abrir sesion y cada vez que se tapa (pudo registrarse o borrarse una cara). */
  useEffect(() => {
    if (!conSesion) return;
    let vigente = true;
    void leerBiometria().then((bio) => {
      if (vigente) setBiometria(bio);
    });
    return () => {
      vigente = false;
    };
  }, [conSesion, bloqueada]);

  /*
    El vigilante: uno por sesion abierta. Escucha `AppState` (salir y volver), los toques (la inactividad)
    y un reloj cada 15 s con la app a la vista. La hora de salida vive DENTRO del vigilante y no en
    disco: al abrir en frio se bloquea siempre (lo hace la sesion al restaurar), asi que no hay nada que
    recordar entre ejecuciones.
  */
  useEffect(() => {
    if (!conSesion) return;
    const vigilante = crearVigilante({ ahora: Date.now, bloquear, bloqueada: estaBloqueada });
    const suscripcion = AppState.addEventListener('change', (estado: AppStateStatus) => vigilante.cambioDeEstado(estado));
    const quitarToques = suscribirInteraccion(() => vigilante.interaccion());
    const quitarDesbloqueo = suscribirBloqueo(() => {
      if (!estaBloqueada()) vigilante.desbloqueado();
    });
    // En segundo plano no corre (iOS congela los temporizadores) y, si corriera, el vigilante lo ignora.
    const reloj = setInterval(() => vigilante.revisar(), REVISION_MS);
    return () => {
      suscripcion.remove();
      quitarToques();
      quitarDesbloqueo();
      clearInterval(reloj);
    };
  }, [conSesion]);

  /*
    El selector de apps (iOS): con sesion abierta, la vista previa sale difuminada. En Android lo hace
    `FLAG_SECURE` en las pantallas sensibles (`device/sin-capturas.ts`).
  */
  useEffect(() => {
    if (!conSesion || Platform.OS !== 'ios') return;
    void ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => undefined);
    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, [conSesion]);

  if (!conSesion || !bloqueada) return null;
  return <Candado biometria={biometria} onSalir={() => void session.signOut()} />;
}

function Candado({ biometria: leida, onSalir }: { biometria: Biometria | null; onSalir: () => void }) {
  useSinCapturas('bloqueo-local');
  // Mientras se lee la biometria no se dibuja el PIN (abriria el teclado debajo de Face ID); se pide sola si la hay.
  const biometria = leida ?? { disponible: false, tipo: null };
  const nombre = nombreDeLaBiometria(biometria.tipo);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [pidiendoBiometria, setPidiendoBiometria] = useState(false);

  const pedirBiometria = useCallback(async () => {
    if (!biometria.disponible) return;
    setPidiendoBiometria(true);
    const resultado = await autenticarConBiometria(`Desbloquea ${marca.nombre}`);
    setPidiendoBiometria(false);
    if (resultado === 'ok') desbloquear();
    else if (resultado === 'fallo') setError(`No pudimos reconocer ${nombre}. Escribe tu PIN.`);
  }, [biometria.disponible, nombre]);

  // Al aparecer, la biometria se pide sola: es lo que la persona espera al volver a una app de banco.
  useEffect(() => {
    void pedirBiometria();
  }, [pedirBiometria]);

  /*
    Y otra vez al VOLVER de segundo plano con el candado puesto. Si iOS arranco la app en segundo plano (la tarea de
    ubicacion la despierta), el primer intento fallo sin que nadie lo viera y la persona encontraba el candado sin
    Face ID. Solo tras `background`: la propia hoja de Face ID pasa por `inactive → active` y repetir ahi la volveria
    a abrir sin fin al cancelarla.
  */
  useEffect(() => {
    let estuvoFuera = false;
    const suscripcion = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'background') estuvoFuera = true;
      else if (estado === 'active' && estuvoFuera) {
        estuvoFuera = false;
        void pedirBiometria();
      }
    });
    return () => suscripcion.remove();
  }, [pedirBiometria]);

  const comprobar = async (completo: string) => {
    if (verificando) return;
    setVerificando(true);
    setError(null);
    try {
      await verifyPin(completo);
      setPin('');
      desbloquear();
    } catch (caught) {
      setPin('');
      if (caught instanceof AtlasApiError && caught.kind === 'rate_limited') {
        setError('Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
      } else if (caught instanceof AtlasApiError && (caught.code === 'PIN_INCORRECT' || caught.status === 400)) {
        setError('PIN incorrecto.');
      } else if (caught instanceof AtlasApiError && (caught.kind === 'network' || caught.kind === 'timeout')) {
        setError(
          biometria.disponible
            ? `Sin conexión: el PIN se comprueba en el servidor. Prueba con ${nombre}.`
            : 'Sin conexión: el PIN se comprueba en el servidor. Vuelve a intentar cuando tengas internet.',
        );
      } else {
        setError('No pudimos comprobar tu PIN. Inténtalo de nuevo.');
      }
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={styles.fondo} testID="bloqueo-local">
        <View style={styles.cuerpo}>
          <AtlasLogo size={56} />
          <AtlasText variant="h2" align="center">
            {marca.nombre} está bloqueada
          </AtlasText>
          <AtlasText variant="body" tone="secondary" align="center">
            {biometria.disponible
              ? `Usa ${nombre} o escribe tu PIN para seguir donde lo dejaste.`
              : 'Escribe tu PIN para seguir donde lo dejaste.'}
          </AtlasText>
          {biometria.disponible ? (
            <Button
              label={`Desbloquear con ${nombre}`}
              icon="candado"
              onPress={() => void pedirBiometria()}
              loading={pidiendoBiometria}
              disabled={verificando}
            />
          ) : null}
          {leida === null ? (
            <Cargando texto="Preparando el desbloqueo…" />
          ) : (
          <PinField
            label="PIN"
            value={pin}
            onChangeText={setPin}
            tamano="grande"
            autoFocus={!biometria.disponible}
            autoComplete="current-password"
            textContentType="password"
            onComplete={(completo) => void comprobar(completo)}
            error={error}
            editable={!verificando}
            testID="bloqueo-pin"
            ayuda={`Los cuatro dígitos con los que entras a la app. Nadie de ${marca.nombre} te los pide por mensaje o llamada.`}
          />
          )}
          {verificando ? <Cargando texto="Comprobando…" /> : null}
          <Button label="Salir de mi cuenta" icon="salir" variant="ghost" onPress={onSalir} disabled={verificando} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.surface.primary, justifyContent: 'center' },
  cuerpo: { padding: space.xl, gap: space.md, alignItems: 'stretch' },
});
