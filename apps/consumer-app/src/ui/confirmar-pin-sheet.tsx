/**
 * La hoja que vuelve a pedir el PIN antes de una acción sensible.
 *
 * ## Para qué sirve
 *
 * Una sesión abierta en un teléfono prestado, perdido o sin bloqueo no debería bastar para leer todo lo que
 * Atlas sabe de una persona. Antes de enseñarlo se le pide el PIN otra vez: la sesión dice quién abrió la
 * app, el PIN dice que quien la tiene en la mano es esa persona.
 *
 * ## Cómo
 *
 * Son las mismas cuatro casillas del ingreso (con su ojo) y, con el cuarto dígito, se comprueba solo. El
 * servidor sólo responde si el PIN es el de la cuenta de la SESIÓN: no abre otra, no manda correo y un PIN
 * incorrecto no cierra la sesión actual.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AtlasApiError } from '../api/errors';
import { verifyPin } from '../api/endpoints/auth';
import { useSinCapturas } from '../device/sin-capturas';
import { space, marca } from '../theme/tokens';
import { BottomSheet } from './help-sheet';
import { PinField } from './pin-field';
import { AtlasText, Button, Cargando } from './primitives';

export function ConfirmarPinSheet<R = unknown>({
  visible,
  onClose,
  onVerificado,
  motivo = 'Por tu seguridad, escribe tu PIN para continuar.',
  verificar = verifyPin as unknown as (pin: string) => Promise<R>,
}: {
  visible: boolean;
  onClose: () => void;
  /** Se llama UNA vez, cuando el servidor confirmó el PIN, con lo que devolvió `verificar`. */
  onVerificado: (resultado: R) => void;
  motivo?: string;
  /**
   * Cómo se comprueba el PIN. Por omisión, `verifyPin` (sólo responde si es el correcto). Una operación
   * que el servidor protege con prueba de un solo uso pasa `reauthenticate`, y recibe la prueba en
   * `onVerificado` para mandarla con la operación.
   */
  verificar?: (pin: string) => Promise<R>;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  // Mientras la hoja esta a la vista: sin capturas ni grabaciones del PIN (APP-18).
  useSinCapturas('confirmar-pin', visible);

  // Cada vez que se abre, empieza limpia: un PIN escrito antes no debe quedarse a la vista.
  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
      setVerificando(false);
    }
  }, [visible]);

  const comprobar = async (completo: string) => {
    if (verificando) return;
    setVerificando(true);
    setError(null);
    try {
      const resultado = await verificar(completo);
      onVerificado(resultado);
    } catch (caught) {
      setPin('');
      if (caught instanceof AtlasApiError && caught.code === 'ACCOUNT_LOCKED') {
        // El bloqueo del ingreso dura minutos, no uno: decir «espera un minuto» haría volver a fallar.
        setError('Por tu seguridad bloqueamos el PIN unos minutos tras varios intentos fallidos. Vuelve a probar más tarde.');
      } else if (caught instanceof AtlasApiError && caught.kind === 'rate_limited') {
        setError('Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
      } else if (caught instanceof AtlasApiError && (caught.code === 'PIN_INCORRECT' || caught.status === 400)) {
        setError('PIN incorrecto.');
      } else if (caught instanceof AtlasApiError && (caught.kind === 'network' || caught.kind === 'timeout')) {
        setError('Sin conexión. Revisa tu internet y vuelve a intentar.');
      } else {
        setError('No pudimos comprobar tu PIN. Inténtalo de nuevo.');
      }
    } finally {
      setVerificando(false);
    }
  };

  return (
    <BottomSheet visible={visible} titulo="Confirma tu PIN" onClose={onClose} cierre="Cancelar" evitarTeclado>
      <View style={styles.cuerpo}>
        <AtlasText variant="body" tone="secondary">
          {motivo}
        </AtlasText>
        <PinField
          label="PIN"
          value={pin}
          onChangeText={setPin}
          tamano="grande"
          autoFocus
          autoComplete="current-password"
          textContentType="password"
          onComplete={(completo) => void comprobar(completo)}
          error={error}
          ayuda={`Los cuatro dígitos con los que entras a la app. Nadie de ${marca.nombre} te los pide por mensaje o llamada.`}
        />
        {verificando ? <Cargando texto="Comprobando…" /> : null}
        <Button label="Cancelar" icon="cerrar" variant="ghost" onPress={onClose} disabled={verificando} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  cuerpo: { padding: space.lg, gap: space.md },
});
