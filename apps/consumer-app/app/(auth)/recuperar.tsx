/**
 * Recuperacion del PIN en dos pasos: se pide el codigo al correo y luego se canjea por un PIN nuevo.
 *
 * El secreto del cliente es un PIN de 4 digitos, no una contrasena (`isCustomerPinValid` en
 * AtlasBackend). Esta pantalla pedia una contrasena de al menos 10 caracteres, que el servidor
 * rechaza siempre para un cliente: nadie podia recuperar su cuenta desde la app.
 *
 * La respuesta del servidor es identica exista o no la cuenta —para no permitir enumeracion—, asi
 * que la pantalla tampoco puede afirmar que el correo existe. Dice lo unico cierto: si existe, el
 * codigo va en camino.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as authApi from '../../src/api/endpoints/auth';
import { describeError } from '../../src/api/errors';
import { pinProblem } from '../../src/domain/pin';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { PinField } from '../../src/ui/pin-field';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

type Step = 'request' | 'confirm' | 'done';

export default function RecoverPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [repeatPin, setRepeatPin] = useState('');
  const [resent, setResent] = useState(false);
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
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pinError = newPin.length === 4 ? pinProblem(newPin) : null;
  const repeatError = repeatPin.length === 4 && repeatPin !== newPin ? 'Los dos PIN no coinciden.' : null;
  const canConfirm = code.length === 6 && pinProblem(newPin) === null && repeatPin === newPin;

  if (step === 'done') {
    return (
      <Screen footer={<Button label="Ir a ingresar" onPress={() => router.replace('/(auth)/ingresar')} />}>
        <ScreenHeader
          title="PIN actualizado"
          subtitle="Ya puedes ingresar con tu PIN nuevo. Por seguridad cerramos las sesiones que tenías abiertas."
        />
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
            disabled={!emailOk || busy}
            blockedReason={firstBlocker([[emailOk, 'Escribe el correo de tu cuenta.']])}
            onPress={() =>
              run(async () => {
                await authApi.requestPasswordReset(email.trim());
                setStep('confirm');
              })
            }
          />
        ) : (
          <Button
            label="Guardar PIN nuevo"
            loading={busy}
            disabled={!canConfirm || busy}
            blockedReason={firstBlocker([
              [code.length === 6, 'El código tiene 6 dígitos.'],
              [pinProblem(newPin) === null, pinProblem(newPin) ?? ''],
              [repeatPin === newPin, 'Repite el mismo PIN para confirmarlo.'],
            ])}
            onPress={() =>
              run(async () => {
                await authApi.confirmPasswordReset({ email: email.trim(), code, newPassword: newPin });
                setStep('done');
              })
            }
          />
        )
      }
    >
      <ScreenHeader
        title="Recuperar acceso"
        subtitle={
          step === 'request'
            ? 'Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos para crear un PIN nuevo.'
            : `Si ${email.trim()} pertenece a una cuenta, te enviamos un código. Puede tardar un par de minutos; revisa también spam.`
        }
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
          <PinField
            label="Tu PIN nuevo"
            value={newPin}
            onChangeText={setNewPin}
            error={pinError}
            hint="Cuatro dígitos que recuerdes. Evita 1234, tu año de nacimiento o cuatro iguales."
          />
          <PinField label="Repite tu PIN nuevo" value={repeatPin} onChangeText={setRepeatPin} error={repeatError} />
          <Gap size="sm" />
          {resent ? (
            <AtlasText variant="caption" tone="secondary">
              Te enviamos un código nuevo. Usa el más reciente: el anterior deja de funcionar.
            </AtlasText>
          ) : null}
          <Button
            label="Enviarme otro código"
            variant="ghost"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await authApi.requestPasswordReset(email.trim());
                setResent(true);
              })
            }
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
