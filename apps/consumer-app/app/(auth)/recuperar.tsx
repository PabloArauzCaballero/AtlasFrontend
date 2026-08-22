/**
 * Recuperacion de contrasena en dos pasos: se pide el codigo y luego se canjea.
 *
 * La respuesta del servidor es identica exista o no la cuenta —para no permitir enumeracion—, asi
 * que la pantalla tampoco puede afirmar que el correo existe. Dice lo unico cierto: si existe, el
 * codigo va en camino.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as authApi from '../../src/api/endpoints/auth';
import { describeError } from '../../src/api/errors';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
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
        <ScreenHeader title="Contraseña actualizada" subtitle="Ya puedes ingresar con tu nueva contraseña." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        step === 'request' ? (
          <Button
            label="Enviarme el código"
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
            label="Guardar contraseña"
            loading={busy}
            disabled={code.length !== 6 || newPassword.length < 10 || busy}
            blockedReason={firstBlocker([
              [code.length === 6, 'El código tiene 6 dígitos.'],
              [newPassword.length >= 10, 'La contraseña nueva necesita al menos 10 caracteres.'],
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
      <ScreenHeader
        title="Recuperar acceso"
        subtitle={step === 'request' ? 'Te enviamos un código de 6 dígitos por correo.' : 'Escribe el código que recibiste.'}
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {step === 'request' ? (
        <Field
          label="Correo electronico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
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
            required
          />
          <Field
            label="Nueva contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            hint="Mínimo 10 caracteres."
            required
          />
        </>
      )}

      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        Si el correo no esta registrado no recibiras nada, y la respuesta es la misma por seguridad.
      </AtlasText>
    </Screen>
  );
}
