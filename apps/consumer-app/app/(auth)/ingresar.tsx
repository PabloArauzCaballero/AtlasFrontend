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
import { StyleSheet } from 'react-native';
import { IconField } from '../../src/ui/form-controls';
import { PIN_LENGTH, PinField } from '../../src/ui/pin-field';
import { space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasLogo } from '../../src/ui/brand';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';
import { useSinCapturas } from '../../src/device/sin-capturas';

export default function SignIn() {
  // PIN, carnet o datos bancarios: sin capturas ni grabaciones de pantalla (APP-18).
  useSinCapturas('pin-ingreso');
  const router = useRouter();
  const session = useSession();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  /*
    «Ingresar» va SIEMPRE en verde (pedido de Pablo, 2026-10-06). Antes arrancaba apagado, en gris, hasta
    tener los dos datos, y se leía como que no se podía entrar. Ahora lo que falta se dice al pulsar, en el
    campo que falta y no en un texto suelto debajo del botón.
  */
  const [intentado, setIntentado] = useState(false);
  const faltaIdentificador = identifier.trim().length < 3;
  const errorIdentificador = intentado && faltaIdentificador ? 'Escribe el correo o teléfono con el que te registraste.' : null;
  const errorPinFaltante =
    intentado && pin.length !== PIN_LENGTH ? (pin.length === 0 ? 'Falta tu PIN.' : `Faltan ${PIN_LENGTH - pin.length} dígitos del PIN.`) : null;

  /*
    `entrante` es el PIN recién completado: `onComplete` dispara en la misma pasada que `setPin`, y el
    `pin` del cierre todavía es el de tres dígitos. Sin pasarlo, el cuarto dígito no enviaba nada.
  */
  const submit = async (entrante?: string) => {
    const clave = entrante ?? pin;
    if (submitting) return;
    if (identifier.trim().length < 3 || clave.length !== PIN_LENGTH) {
      setIntentado(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await session.signIn(identifier.trim(), clave);
      router.replace('/');
    } catch (caught) {
      setError(caught);
      // Casillas vacías para reescribir: con las cuatro llenas el cuarto dígito no dispararía otro intento.
      setPin('');
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
          <Button label="Ingresar" icon="adelante" onPress={() => submit()} loading={submitting} testID="ingresar-enviar" />
          <Button label="Crear una cuenta" icon="perfil" variant="secondary" onPress={() => router.replace('/(onboarding)/registro')} />
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
        error={errorIdentificador}
        ayuda="El correo o el número de celular con el que creaste tu cuenta. El teléfono va sin el código de país. Ej.: valeria.mendez@gmail.com o 76500123."
        required
      />

      {/*
        El PIN son CUATRO casillas grandes y nada más: es lo único que se teclea aquí. El ojo sigue
        (lo trae `PinField`) para verlo como números normales; con el cuarto dígito, entra solo.
      */}
      <PinField
        label="PIN"
        value={pin}
        onChangeText={setPin}
        tamano="grande"
        autoComplete="current-password"
        textContentType="password"
        onComplete={(completo) => void submit(completo)}
        error={credentialsRejected ? 'PIN incorrecto' : errorPinFaltante}
        ayuda="Los cuatro dígitos que elegiste al registrarte. Tras cinco intentos fallidos la cuenta se bloquea un rato por seguridad; si no lo recuerdas, usa «Recuperar acceso» antes de agotarlos."
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
