/**
 * Ingreso.
 *
 * El identificador es el mismo telefono o correo que la persona uso al registrarse: el backend
 * resuelve cualquiera de los dos. Pedir "usuario" seria inventar un dato que nunca creo.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

export default function SignIn() {
  const router = useRouter();
  const session = useSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const canSubmit = identifier.trim().length >= 3 && password.length >= 1 && !submitting;

  const blockedReason = firstBlocker([
    [identifier.trim().length >= 3, 'Escribe el correo o telefono con el que te registraste.'],
    [password.length >= 1, 'Falta tu contrasena.'],
  ]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await session.signIn(identifier.trim(), password);
      router.replace('/');
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const described = error ? describeError(error) : null;
  // 401 en login es credencial incorrecta, no sesion expirada: el copy generico confundiria.
  const detail =
    error instanceof AtlasApiError && error.status === 401
      ? 'Correo, telefono o contrasena incorrectos.'
      : (described?.detail ?? '');

  return (
    <Screen
      footer={
        <>
          <Button label="Ingresar" onPress={submit} loading={submitting} disabled={!canSubmit} blockedReason={blockedReason} />
          <Button label="Crear una cuenta" variant="ghost" onPress={() => router.replace('/(onboarding)/registro')} />
        </>
      }
    >
      <ScreenHeader title="Ingresar" subtitle="Usa el correo o telefono con el que te registraste." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={detail} reference={described.reference} /> : null}

      <Field
        label="Correo o telefono"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        required
      />

      <Field
        label="Contrasena"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        required
      />

      <Gap size="xs" />
      <Button label="Olvide mi contrasena" variant="ghost" onPress={() => router.push('/(auth)/recuperar')} />

      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        Tras varios intentos fallidos la cuenta se bloquea de forma temporal por seguridad.
      </AtlasText>
    </Screen>
  );
}
