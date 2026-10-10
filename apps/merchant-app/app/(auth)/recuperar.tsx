/**
 * «Olvidé mi contraseña» del comercio, en dos pasos: pedir el código y confirmarlo con la contraseña
 * nueva. Textos de `AtlasERPFrontend/app/recuperar-acceso` (canal `comercio`).
 *
 * Se avanza SIEMPRE tras pedir el código, exista o no la cuenta: la respuesta del backend es la misma
 * a propósito, para que esta pantalla no sirva de comprobador de qué correos son de un comercio.
 *
 * El correo llega del ingreso como parámetro de la ruta. En el teléfono no hay historial de
 * navegador ni registros de proxy que lo guarden, que era el motivo de la web para no ponerlo en la URL.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { IconField } from '@cliente/ui/form-controls';
import { Gap, Screen, ScreenHeader } from '@cliente/ui/layout';
import { AtlasText, Button } from '@cliente/ui/primitives';
import { mensajeDeError } from '@/api/client';
import { authApi } from '@/api/endpoints/auth';
import { Aviso } from '@/ui/aviso';

type Paso = 'pedir' | 'confirmar' | 'listo';

export default function Recuperar() {
  const router = useRouter();
  const params = useLocalSearchParams<{ correo?: string }>();
  const [paso, setPaso] = useState<Paso>('pedir');
  const [email, setEmail] = useState(typeof params.correo === 'string' ? params.correo : '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pedirCodigo = async () => {
    if (submitting || email.trim() === '') return;
    setError(null);
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset({ email: email.trim() });
      setPaso('confirmar');
    } catch (caught) {
      setError(mensajeDeError(caught, 'No fue posible enviar el código. Inténtalo de nuevo en un momento.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmar = async () => {
    if (submitting) return;
    if (code.length !== 6 || newPassword.length < 10) {
      setError('Escribe el código de 6 dígitos y una contraseña de al menos 10 caracteres.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await authApi.confirmPasswordReset({ email: email.trim(), code, newPassword });
      setPaso('listo');
    } catch (caught) {
      setError(mensajeDeError(caught, 'No fue posible cambiar la contraseña.'));
    } finally {
      setSubmitting(false);
    }
  };

  const volver = () => router.replace('/ingresar');

  if (paso === 'listo') {
    return (
      <Screen footer={<Button label="Ir al acceso" onPress={volver} testID="recuperar-ir-al-acceso" />}>
        <ScreenHeader
          eyebrow="Contraseña nueva"
          title="Ya puedes entrar"
          subtitle="Tu contraseña quedó cambiada. Por seguridad se cerraron las sesiones que tenías abiertas en otros dispositivos."
        />
      </Screen>
    );
  }

  if (paso === 'confirmar') {
    return (
      <Screen footer={<Button label="Cambiar mi contraseña" onPress={() => void confirmar()} loading={submitting} testID="recuperar-confirmar" />}>
        <ScreenHeader
          eyebrow="Revisa tu correo"
          title="Escribe el código"
          subtitle={`Si ${email.trim()} corresponde a una cuenta registrada, ahí llegó un código de 6 dígitos. Sólo sirve una vez y caduca en pocos minutos.`}
          onBack={() => setPaso('pedir')}
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
          ayuda="Código de seis dígitos que te llegó al correo; caduca en pocos minutos."
          required
          testID="recuperar-codigo"
        />
        <IconField
          label="Contraseña nueva"
          icon="candado"
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="new-password"
          hint="Al menos 10 caracteres. Nunca la compartas; soporte jamás te la pedirá."
          ayuda="Tu contraseña nueva del portal; distingue mayúsculas."
          required
          testID="recuperar-clave"
        />
        {error ? <Aviso tono="danger">{error}</Aviso> : null}
        <Button
          label="No me llegó: pedir otro código"
          variant="ghost"
          icon="refrescar"
          onPress={() => {
            setPaso('pedir');
            setCode('');
            setNewPassword('');
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Enviarme el código" onPress={() => void pedirCodigo()} loading={submitting} testID="recuperar-pedir" />}>
      <ScreenHeader
        eyebrow="Portal del comercio"
        title="Recuperar el acceso"
        subtitle="Escribe el correo de tu comercio y te enviamos un código para poner una contraseña nueva."
        onBack="auto"
      />
      <IconField
        label="Correo del comercio"
        icon="sobre"
        value={email}
        onChangeText={setEmail}
        placeholder="usuario@micomercio.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        ayuda="El correo con el que entras al portal de tu comercio. Ej.: usuario@micomercio.com."
        required
        testID="recuperar-correo"
      />
      {error ? <Aviso tono="danger">{error}</Aviso> : null}
      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        ¿Ya la recordaste?
      </AtlasText>
      <Button label="Volver al acceso" variant="ghost" onPress={volver} />
    </Screen>
  );
}
