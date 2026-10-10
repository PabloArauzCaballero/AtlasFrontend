/**
 * Mi cuenta: cambiar la contraseña y salir. Es `app/portal-comercio/cuenta` + `PasswordChangePanel`.
 *
 * Al cambiarla se cierran todas las sesiones, también ésta, igual que en la web. El aviso de que
 * salió bien se muestra en «Ingresar» (`?aviso=clave-cambiada`), que es donde la persona aterriza.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { IconField } from '@cliente/ui/form-controls';
import { Gap, Screen, ScreenHeader } from '@cliente/ui/layout';
import { Button, Card, CardHeader, KeyValue } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { authApi, type PinChallenge } from '@/api/endpoints/auth';
import { useSession } from '@/session/session';
import { Aviso } from '@/ui/aviso';

export default function Cuenta() {
  const router = useRouter();
  const { merchant, logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [challenge, setChallenge] = useState<PinChallenge | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const pedirCodigo = async () => {
    if (submitting || currentPassword === '') return;
    setError(null);
    setSubmitting(true);
    try {
      setChallenge(await authApi.requestPasswordChange({ currentPassword }));
      setCurrentPassword('');
    } catch (caught) {
      setError(mensajeDeError(caught, 'No fue posible enviar el código.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmar = async () => {
    if (!challenge || submitting) return;
    // Antes de gastar el código: descubrir el error de tecleo después obliga a esperar para pedir otro.
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await authApi.confirmPasswordChange({ challengeToken: challenge.challengeToken, code, newPassword });
      await logout();
      router.replace({ pathname: '/ingresar', params: { aviso: 'clave-cambiada' } });
    } catch (caught) {
      setError(mensajeDeError(caught, 'No fue posible cambiar la contraseña.'));
    } finally {
      setSubmitting(false);
    }
  };

  const salir = async () => {
    setSaliendo(true);
    await logout();
    router.replace('/ingresar');
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Cuenta" title="Mi cuenta" subtitle="Seguridad de tu acceso al portal del comercio." onBack="auto" />

      {merchant ? (
        <Card>
          <KeyValue label="Nombre" value={merchant.fullName || '—'} />
          <KeyValue label="Correo" value={merchant.email} />
          {merchant.userCode ? <KeyValue label="Código" value={merchant.userCode} /> : null}
        </Card>
      ) : null}

      <Card>
        {challenge ? (
          <>
            <CardHeader
              title="Cambiar contraseña"
              icon="candado"
              detail={`Enviamos un código de 6 dígitos a tu correo. Vence en ${challenge.expiresInMinutes} minutos.`}
            />
            <IconField
              label="Código del correo"
              icon="sobre"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              ayuda="El código de 6 dígitos que te llegó al correo."
              required
            />
            <IconField
              label="Contraseña nueva"
              icon="candado"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
              hint="Mínimo 10 caracteres, con al menos una letra y un número o símbolo."
              ayuda="Contraseña nueva: mínimo 10 caracteres con letra y número o símbolo."
              required
            />
            <IconField
              label="Repite la contraseña nueva"
              icon="candado"
              value={repeatPassword}
              onChangeText={setRepeatPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
              ayuda="Vuelve a escribir la contraseña nueva para evitar errores."
              required
            />
            {error ? <Aviso tono="danger">{error}</Aviso> : null}
            <Button label="Confirmar contraseña nueva" onPress={() => void confirmar()} loading={submitting} />
          </>
        ) : (
          <>
            <CardHeader
              title="Cambiar contraseña"
              icon="candado"
              detail="Pide un código a tu correo y confírmalo. Al terminar se cierran todas tus sesiones."
            />
            <IconField
              label="Contraseña actual"
              icon="candado"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              autoComplete="current-password"
              ayuda="Tu contraseña actual, para confirmar que eres tú."
              required
            />
            {error ? <Aviso tono="danger">{error}</Aviso> : null}
            <Button label="Enviarme el código" onPress={() => void pedirCodigo()} loading={submitting} />
          </>
        )}
      </Card>

      <Gap size="base" />
      <Button label="Cerrar sesión" icon="salir" variant="secondary" onPress={() => void salir()} loading={saliendo} testID="cuenta-salir" />
    </Screen>
  );
}
