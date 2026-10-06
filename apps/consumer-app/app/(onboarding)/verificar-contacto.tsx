/**
 * Verificacion del telefono.
 *
 * El codigo lo genera y entrega el servidor. Si el canal no esta disponible en el entorno, la
 * pantalla lo dice tal cual y ofrece el otro canal: un codigo que nunca se envio y una pantalla que
 * dice "revisa tus mensajes" es la peor combinacion posible.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Field, OptionGroup } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState } from '../../src/ui/primitives';

type Channel = 'sms' | 'whatsapp' | 'email';

export default function VerifyContact() {
  const router = useRouter();
  const session = useSession();
  const customerId = session.customerId;

  const [channel, setChannel] = useState<Channel>('sms');
  const [sent, setSent] = useState<{ expiresAt: string; deliveryStatus: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const contactType: 'phone' | 'email' = channel === 'email' ? 'email' : 'phone';

  const sendCode = async () => {
    if (!customerId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onboardingApi.requestContactVerification(customerId, {
        contactType,
        verificationChannel: channel,
      });
      setSent({ expiresAt: result.expiresAt, deliveryStatus: result.deliveryStatus });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (!customerId || code.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.submitContactVerification(customerId, {
        contactType,
        verificationChannel: channel,
        verificationCode: code,
      });
      await session.refresh();
      router.replace('/(onboarding)/progreso');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;
  const channelUnavailable = error instanceof AtlasApiError && error.code === 'VERIFICATION_CHANNEL_UNAVAILABLE';
  // El servidor registra el intento aunque el proveedor falle: hay que decirlo, no fingir exito.
  const deliveryFailed = sent?.deliveryStatus === 'delivery_failed';

  return (
    <Screen
      footer={
        sent && !deliveryFailed ? (
          <>
            <Button
              label="Confirmar código"
              onPress={confirmCode}
              loading={busy}
              disabled={code.length < 4 || busy}
              blockedReason={firstBlocker([[code.length >= 4, 'Escribe el código que recibiste.']])}
              haptic="success"
            />
            <Button label="Enviar otro código" variant="ghost" onPress={sendCode} disabled={busy} />
          </>
        ) : (
          <Button label="Enviarme el código" onPress={sendCode} loading={busy} disabled={busy} />
        )
      }
    >
      <ScreenHeader title="Verifica tu contacto" subtitle="Confirmamos que el número o correo es tuyo." onBack="auto" />

      {described ? (
        <ErrorState
          title={channelUnavailable ? 'Canal no disponible' : described.title}
          detail={
            channelUnavailable
              ? 'Ese canal no esta habilitado en este momento. Prueba con otro.'
              : described.detail
          }
          reference={described.reference}
        />
      ) : null}

      {deliveryFailed ? (
        <ErrorState
          title="No pudimos entregar el código"
          detail="El código se generó pero el proveedor no lo entregó. Intenta de nuevo o cambia de canal."
          onRetry={sendCode}
        />
      ) : null}

      <OptionGroup<Channel>
        label="Cómo quieres recibir el código"
        value={channel}
        onChange={(next) => {
          setChannel(next);
          setSent(null);
          setError(null);
        }}
        options={[
          { value: 'sms', label: 'SMS', detail: 'A tu número registrado.' },
          { value: 'whatsapp', label: 'WhatsApp', detail: 'Al mismo número.' },
          { value: 'email', label: 'Correo', detail: 'A tu correo registrado.' },
        ]}
      />

      {channel === 'email' ? (
        <Button
          label="¿Escribiste mal tu correo? Cámbialo"
          variant="ghost"
          onPress={() => router.push('/(onboarding)/cambiar-correo')}
          disabled={busy}
        />
      ) : null}

      {sent && !deliveryFailed ? (
        <>
          <Card>
            <AtlasText variant="bodyStrong">Código enviado</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              Vence a las {new Date(sent.expiresAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}.
            </AtlasText>
          </Card>

          <Field
            label="Código recibido"
            value={code}
            onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
            autoFocus
            required
          />
        </>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Nunca te pediremos este código por teléfono ni por redes sociales.
      </AtlasText>
    </Screen>
  );
}
