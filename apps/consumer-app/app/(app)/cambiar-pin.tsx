/**
 * Cambiar mi PIN, con la sesión abierta.
 *
 * Hasta el 2026-09-14 la app sólo tenía «recuperar»: quien quería cambiar su PIN por decisión
 * propia —se lo dijo a alguien, lo adivinaron— tenía que cerrar sesión y fingir que lo olvidó. El
 * servidor ya ofrecía el cambio en dos pasos (`/auth/password/change/*`); faltaba la pantalla.
 *
 * Dos pasos y no uno: el PIN actual se comprueba primero y el código llega al correo de la cuenta,
 * así que un teléfono desbloqueado en manos ajenas no basta para cambiar el PIN.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as authApi from '../../src/api/endpoints/auth';
import { describeError } from '../../src/api/errors';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { PinField } from '../../src/ui/pin-field';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, ErrorState } from '../../src/ui/primitives';

type Step = 'current' | 'confirm' | 'done';

export default function ChangePin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
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
      <Screen footer={<Button label="Volver a mi perfil" onPress={() => router.back()} />}>
        <ScreenHeader title="PIN actualizado" subtitle="Desde ahora entras con tu PIN nuevo. Las demás sesiones abiertas se cerraron." />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        step === 'current' ? (
          <Button
            label="Enviarme el código" icon="sobre"
            loading={busy}
            disabled={currentPin.length !== 4 || busy}
            blockedReason={firstBlocker([[currentPin.length === 4, 'Escribe tu PIN actual (4 dígitos).']])}
            onPress={() =>
              run(async () => {
                const challenge = await authApi.requestPinChange(currentPin);
                setChallengeToken(challenge.challengeToken);
                setStep('confirm');
              })
            }
          />
        ) : (
          <Button
            label="Guardar mi PIN nuevo"
            loading={busy}
            disabled={code.length !== 6 || newPin.length !== 4 || newPin === currentPin || busy}
            blockedReason={firstBlocker([
              [code.length === 6, 'El código tiene 6 dígitos.'],
              [newPin.length === 4, 'Tu PIN nuevo debe ser de 4 dígitos.'],
              [newPin !== currentPin, 'El PIN nuevo tiene que ser distinto del actual.'],
            ])}
            onPress={() =>
              run(async () => {
                await authApi.confirmPinChange({ challengeToken, code, newPassword: newPin });
                setStep('done');
              })
            }
          />
        )
      }
    >
      <ScreenHeader
        eyebrow={`Paso ${step === 'current' ? 1 : 2} de 2`}
        title="Cambiar mi PIN"
        subtitle={step === 'current' ? 'Primero confirma el PIN que usas hoy.' : 'Escribe el código que te llegó por correo y tu PIN nuevo.'}
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {step === 'current' ? (
        <PinField
          label="Tu PIN actual"
          value={currentPin}
          onChangeText={setCurrentPin}
          ayuda="Los cuatro dígitos con los que entras hoy a la app. Se piden para confirmar que eres tú quien cambia el PIN y no alguien con tu teléfono desbloqueado."
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
          <PinField
            label="Tu PIN nuevo"
            value={newPin}
            onChangeText={setNewPin}
            hint="Cuatro dígitos que recuerdes. Evita 1234, tu año de nacimiento o cuatro iguales."
            ayuda="Cuatro dígitos nuevos con los que vas a entrar y autorizar tus compras desde ahora. El PIN anterior deja de servir en cuanto guardes. El servidor rechaza los fáciles de adivinar, como 1234 o cuatro iguales."
          />
        </>
      )}

      <Gap size="base" />
      <AtlasText variant="caption" tone="tertiary">
        El código vence en unos minutos y sólo sirve una vez. Si no te llega, revisa que tu correo esté verificado en «Tu cuenta».
      </AtlasText>
    </Screen>
  );
}
