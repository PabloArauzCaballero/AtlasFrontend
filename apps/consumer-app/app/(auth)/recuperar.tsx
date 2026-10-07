/**
 * Recuperacion de contrasena en dos pasos: se pide el codigo y luego se canjea.
 *
 * La respuesta del servidor es identica exista o no la cuenta —para no permitir enumeracion—, asi
 * que la pantalla tampoco puede afirmar que el correo existe. Dice lo unico cierto: si existe, el
 * codigo va en camino.
 */
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useState } from 'react';
import * as authApi from '../../src/api/endpoints/auth';
import { describeError } from '../../src/api/errors';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { PinField } from '../../src/ui/pin-field';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { space } from '../../src/theme/tokens';
import { AtlasLogo } from '../../src/ui/brand';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

type Step = 'request' | 'confirm' | 'done';

export default function RecoverPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  if (step === 'done') {
    return (
      <Screen footer={<Button label="Ir a ingresar" onPress={() => router.replace('/(auth)/ingresar')} />}>
        <ScreenHeader title="PIN actualizado" subtitle="Ya puedes ingresar con tu PIN nuevo." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        step === 'request' ? (
          <Button
            label="Enviarme el código" icon="sobre"
            loading={busy}
            disabled={!email.includes('@') || busy}
            blockedReason={firstBlocker([[email.includes('@'), 'Escribe el correo de tu cuenta.']])}
            onPress={() =>
              run(async () => {
                await authApi.requestPasswordReset(email.trim());
                setStep('confirm');
              })
            }
          />
        ) : (
          <Button
            label="Guardar mi PIN" icon="check"
            loading={busy}
            disabled={code.length !== 6 || newPassword.length !== 4 || busy}
            blockedReason={firstBlocker([
              [code.length === 6, 'El código tiene 6 dígitos.'],
              [newPassword.length === 4, 'Tu PIN nuevo debe ser de 4 dígitos.'],
            ])}
            onPress={() =>
              run(async () => {
                await authApi.confirmPasswordReset({ email: email.trim(), code, newPassword });
                setStep('done');
              })
            }
          />
        )
      }
    >
      <AtlasLogo size={36} style={styles.marca} />
      {/*
        El paso, en el antetitulo. Son dos pantallas encadenadas dibujadas en la misma: sin numero,
        pasar de la primera a la segunda se lee como que la pantalla cambio de contenido sola.
      */}
      <ScreenHeader
        eyebrow={`Paso ${step === 'request' ? 1 : 2} de 2`}
        title="Recuperar acceso"
        subtitle={step === 'request' ? 'Te enviamos un código de 6 dígitos por correo.' : 'Escribe el código que recibiste.'}
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {step === 'request' ? (
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          ayuda="El correo con el que te registraste. Ahí te enviamos un código de seis dígitos para poner un PIN nuevo; si escribes otro correo no llegará nada, y por seguridad la pantalla no te lo dirá."
          required
        />
      ) : (
        <>
          <Field
            label="Código de 6 dígitos"
            value={code}
            onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            ayuda="Los seis dígitos que te acabamos de enviar por correo, sin espacios. Sirven una sola vez y vencen en pocos minutos; si no llegó, revisa la carpeta de spam antes de pedir otro."
            required
          />
          {/*
            Un PIN, no una contrasena: lo mismo que se creo al registrarse y lo mismo que pide el
            acceso.

            Esta pantalla se quedo en el modelo viejo cuando el alta paso al PIN de cuatro digitos, y
            el resultado era una incoherencia con consecuencias: quien olvidaba su PIN solo podia
            recuperarlo convirtiendolo en una contrasena larga, en una pantalla cuyo campo de acceso
            sigue llamandose «PIN». El servidor ya aplicaba la regla correcta por tipo de actor; lo
            que faltaba era pedir aqui lo que alli se acepta.
          */}
          <PinField
            label="Tu PIN nuevo"
            value={newPassword}
            onChangeText={setNewPassword}
            hint="Cuatro dígitos que recuerdes. Evita 1234, tu año de nacimiento o cuatro iguales."
            ayuda="Cuatro dígitos nuevos con los que vas a entrar y autorizar tus compras desde ahora. El PIN anterior deja de servir en cuanto guardes. El servidor rechaza los fáciles de adivinar, como 1234 o cuatro iguales."
          />
        </>
      )}

      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        Si el correo no está registrado no recibirás nada: la respuesta es la misma por seguridad.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  marca: { marginBottom: space.sm },
});
