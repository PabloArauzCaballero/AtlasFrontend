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
import { Pressable, StyleSheet } from 'react-native';
import { IconField } from '../../src/ui/form-controls';
import { toqueWeb } from '../../src/ui/hit-slop';
import { Icon } from '../../src/ui/icons';
import { color, space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasLogo } from '../../src/ui/brand';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

export default function SignIn() {
  const router = useRouter();
  const session = useSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // El mismo interruptor que el registro: quien se equivoca al teclear aqui vuelve a la pantalla
  // de recuperar contrasena, que es el camino mas caro de todos.
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = identifier.trim().length >= 3 && password.length >= 1 && !submitting;

  const blockedReason = firstBlocker([
    [identifier.trim().length >= 3, 'Escribe el correo o teléfono con el que te registraste.'],
    [password.length >= 1, 'Falta tu PIN.'],
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
  /*
   * 401 en login es credencial incorrecta, no sesion expirada: el copy generico confundiria.
   *
   * Pero NO todo 401 aqui es una contrasena mal escrita. La cuenta bloqueada tambien responde 401, y
   * reescribir su mensaje como «contrasena incorrecta» mandaba a la persona a probar contrasenas
   * —que es justo lo que suma intentos fallidos y alarga el bloqueo que ya tiene—. Solo se sustituye
   * el texto cuando el error NO trae un codigo de negocio propio que decir.
   */
  const credentialsRejected = error instanceof AtlasApiError && error.status === 401 && error.code === 'UNAUTHORIZED';
  const detail = credentialsRejected ? 'Correo, teléfono o PIN incorrectos.' : (described?.detail ?? '');
  /*
   * «Sesion expirada» sobre la pantalla de INGRESAR no significa nada: aqui todavia no hay sesion
   * que expirar. El titulo salia de la familia del error —todo 401 es `auth`— y se leia como si la
   * app hubiera perdido algo, cuando lo que pasa es que la contrasena no coincide.
   */
  const title = credentialsRejected ? 'No pudimos ingresar' : (described?.title ?? '');

  return (
    <Screen
      footer={
        <>
          <Button label="Ingresar" icon="adelante" onPress={submit} loading={submitting} disabled={!canSubmit} blockedReason={blockedReason} />
          <Button label="Crear una cuenta" icon="perfil" variant="ghost" onPress={() => router.replace('/(onboarding)/registro')} />
        </>
      }
    >
      {/*
        La marca, antes del titulo.

        Una pantalla de acceso sin logotipo es un formulario de dos campos que podria ser el de
        cualquiera, y es justo la pantalla donde la persona teclea su PIN: reconocer donde se esta
        entrando no es adorno, es lo primero que se comprueba antes de escribir una credencial.
      */}
      <AtlasLogo size={36} style={styles.marca} />
      <ScreenHeader title="Ingresar" subtitle="Usa el correo o teléfono con el que te registraste." onBack="auto" />

      {described ? (
        <ErrorState
          title={title}
          detail={detail}
          reference={described.reference}
          actions={
            described.recovery.length > 0 ? (
              <>
                {described.recovery.map((option, index) => (
                  <Button
                    key={option.href}
                    label={option.label}
                    variant={index === 0 ? 'primary' : 'ghost'}
                    onPress={() => router.replace(option.href as never)}
                  />
                ))}
              </>
            ) : null
          }
        />
      ) : null}

      <IconField
        label="Correo o teléfono"
        icon="sobre"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        ayuda="El correo o el número de celular con el que creaste tu cuenta. El teléfono va sin el código de país. Ej.: valeria.mendez@gmail.com o 76500123."
        required
      />

      <IconField
        label="PIN"
        icon="candado"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        ayuda="Los cuatro dígitos que elegiste al registrarte. Tras cinco intentos fallidos la cuenta se bloquea un rato por seguridad; si no lo recuerdas, usa «Recuperar acceso» antes de agotarlos."
        required
        trailing={
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar PIN' : 'Mostrar PIN'}
            hitSlop={10}
            {...toqueWeb(10)}
          >
            <Icon
              name={showPassword ? 'ojo-tachado' : 'ojo'}
              size={20}
              tint={showPassword ? color.action.primary : color.text.tertiary}
            />
          </Pressable>
        }
      />

      <Gap size="xs" />
      <Button label="Olvidé mi PIN" icon="candado" variant="ghost" onPress={() => router.push('/(auth)/recuperar')} />

      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        Tras varios intentos fallidos la cuenta se bloquea de forma temporal por seguridad.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  marca: { marginBottom: space.sm },
});
