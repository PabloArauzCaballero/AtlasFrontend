/**
 * La capa que tapa la app al volver a ella y pide Face ID / huella o el PIN (APP-13).
 *
 * La regla vive en `features/bloqueo-local.ts`; aqui solo se escucha al sistema (`AppState`) y se
 * dibuja. Se monta UNA vez, en la raiz, y solo hace algo con sesion abierta y en el telefono: en el
 * navegador no hay biometria y la sesion web ya vive lo que vive la pestaña.
 *
 * ## Lo que NO hace
 *
 * Cerrar la sesion. Desbloquear no pide al servidor ninguna sesion nueva; el PIN se comprueba con
 * `/auth/pin/verify`, que solo dice si es el de la cuenta de la sesion y nunca expulsa por un dedo
 * torpe. «Salir de la cuenta» esta, para quien no es el dueño o no recuerda el PIN, y es la persona
 * quien lo elige.
 *
 * ## Por que un `Modal`
 *
 * Una vista absoluta quedaria DEBAJO de cualquier hoja abierta (las hojas son `Modal`): quien se fue
 * con «Confirma tu PIN» o una hoja de ayuda a la vista volveria a verla encima del candado. El
 * `Modal` se presenta por encima de todo, y su `onRequestClose` vacio deja el boton atras de Android
 * sin efecto.
 */
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { AtlasApiError } from '../api/errors';
import { verifyPin } from '../api/endpoints/auth';
import { autenticarConBiometria, leerBiometria, nombreDeLaBiometria, type Biometria } from '../device/biometria';
import { useSinCapturas } from '../device/sin-capturas';
import {
  anotarSalida,
  bloquear,
  bloqueoActivado,
  debePedirDesbloqueo,
  desbloquear,
  estaBloqueada,
  leerPreferenciaDeBloqueo,
  leerSalida,
  sesionAbiertaConPinAhora,
  suscribirBloqueo,
  suscribirPreferenciaDeBloqueo,
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

  const [biometria, setBiometria] = useState<Biometria>({ disponible: false, tipo: null });
  const [activado, setActivado] = useState<boolean | null>(null);
  const activadoRef = useRef<boolean | null>(null);
  activadoRef.current = activado;

  /* La preferencia y la biometria: al abrir sesion y cada vez que Perfil cambia la preferencia. */
  useEffect(() => {
    if (!conSesion) {
      setActivado(null);
      return;
    }
    let vigente = true;
    const leer = async () => {
      const [bio, preferencia] = await Promise.all([leerBiometria(), leerPreferenciaDeBloqueo()]);
      if (!vigente) return;
      setBiometria(bio);
      setActivado(bloqueoActivado(preferencia, bio.disponible));
    };
    void leer();
    const quitar = suscribirPreferenciaDeBloqueo(() => void leer());
    return () => {
      vigente = false;
      quitar();
    };
  }, [conSesion]);

  /* Al ABRIR la app con una sesion guardada: si salio hace mas de cinco minutos, o no se sabe. */
  useEffect(() => {
    if (!conSesion || activado === null) return;
    if (!activado) {
      desbloquear();
      return;
    }
    if (sesionAbiertaConPinAhora()) return;
    let vigente = true;
    void leerSalida().then((salida) => {
      if (vigente && debePedirDesbloqueo(salida, Date.now())) bloquear();
    });
    return () => {
      vigente = false;
    };
  }, [activado, conSesion]);

  /* Al irse y al volver. */
  useEffect(() => {
    if (!conSesion) return;
    /*
      Solo cuenta el segundo plano de verdad (`background`), no `inactive`: el propio dialogo de
      Face ID, el centro de control o una llamada entrante pasan por `inactive` y volver de ahi no es
      «haber salido». Al volver se compara con la hora de salida y se olvida.
    */
    let salidaEn: number | null = null;
    const suscripcion = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'background') {
        salidaEn = Date.now();
        void anotarSalida(salidaEn);
      } else if (estado === 'active' && salidaEn !== null) {
        if (activadoRef.current && debePedirDesbloqueo(salidaEn, Date.now())) bloquear();
        salidaEn = null;
      }
    });
    return () => suscripcion.remove();
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

function Candado({ biometria, onSalir }: { biometria: Biometria; onSalir: () => void }) {
  useSinCapturas('bloqueo-local');
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
