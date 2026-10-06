/**
 * Cambiar el correo.
 *
 * ## El callejon que cierra
 *
 * Quien escribia mal su correo en el registro —o lo dejaba de usar— no tenia por donde cambiarlo:
 * el perfil solo lo mostraba, y verificar el telefono no lo arreglaba. Con el contacto ya verificado
 * la cuenta quedaba atada para siempre a un correo que no es suyo, que es justo por donde se
 * recupera la contrasena.
 *
 * ## Por que el correo nuevo no reemplaza al viejo hasta confirmar el codigo
 *
 * Escribir un correo no prueba nada. El servidor lo guarda sin verificar y solo lo convierte en el
 * principal —y en el de ingreso— cuando llega el codigo que se envio A ESE correo. Hasta entonces
 * el anterior sigue funcionando: equivocarse otra vez al escribirlo no deja a nadie fuera.
 *
 * Vive en `(onboarding)` porque ese grupo solo exige sesion: sirve igual a quien esta en pleno alta
 * que a quien ya tiene la cuenta activa.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { changeEmailFailure, domainOf, emailError } from '../../src/features/change-email';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { Field } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState } from '../../src/ui/primitives';

type Step = 'email' | 'code' | 'done';
type Sent = { contactMethodId: string; expiresAt: string; deliveryFailed: boolean };

export default function ChangeEmail() {
  const router = useRouter();
  const session = useSession();
  const customerId = session.customerId;
  const currentDomain = session.me?.customer.emailDomain ?? null;

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [promoted, setPromoted] = useState(true);

  const localEmailError = emailError(email);
  const failure = error ? changeEmailFailure(error, step === 'email' ? 'email' : 'code') : null;
  const fieldError = (field: 'email' | 'code') => (failure?.kind === 'field' && failure.field === field ? failure.message : null);
  const banner = failure?.kind === 'banner' ? failure : null;
  const generic = error && !failure ? describeError(error) : null;

  /*
   * Declarar + pedir el codigo van juntos: para la persona es UN paso («mandame el codigo»).
   * Si ya existe el correo sin verificar, el servidor devuelve el mismo id y esto retoma.
   */
  const sendCode = async () => {
    setEmailTouched(true);
    if (!customerId || busy || localEmailError) return;
    setBusy(true);
    setError(null);
    try {
      const contactMethodId =
        sent?.contactMethodId ??
        (await onboardingApi.addContactMethod(customerId, { contactType: 'email', value: email.trim() })).contactMethodId;
      const result = await onboardingApi.requestContactVerification(customerId, {
        contactType: 'email',
        verificationChannel: 'email',
        contactMethodId,
      });
      setSent({ contactMethodId, expiresAt: result.expiresAt, deliveryFailed: result.deliveryStatus === 'delivery_failed' });
      setCode('');
      setStep('code');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (!customerId || !sent || code.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onboardingApi.submitContactVerification(customerId, {
        contactType: 'email',
        verificationChannel: 'email',
        verificationCode: code,
        contactMethodId: sent.contactMethodId,
      });
      setPromoted(result.primaryContactUpdated !== false);
      await session.refresh();
      setStep('done');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  /** Volver a escribir el correo conserva lo escrito: se corrige, no se empieza de cero. */
  const editEmail = () => {
    setSent(null);
    setCode('');
    setError(null);
    setStep('email');
  };

  const footer =
    step === 'email' ? (
      <Button
        label="Enviarme el código"
        onPress={sendCode}
        loading={busy}
        disabled={busy}
        blockedReason={firstBlocker([[!localEmailError, localEmailError ?? '']])}
      />
    ) : step === 'code' ? (
      <>
        {!sent?.deliveryFailed ? (
          <Button
            label="Confirmar código"
            onPress={confirmCode}
            loading={busy}
            disabled={code.length < 4 || busy}
            blockedReason={firstBlocker([[code.length >= 4, 'Escribe el código que recibiste.']])}
            haptic="success"
          />
        ) : null}
        <Button label="Enviar otro código" variant="ghost" onPress={sendCode} disabled={busy} />
        <Button label="Corregir el correo" variant="ghost" onPress={editEmail} disabled={busy} />
      </>
    ) : (
      <Button label="Listo" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    );

  return (
    <Screen footer={footer}>
      <ScreenHeader
        title="Cambiar mi correo"
        subtitle="Te enviaremos un código al correo nuevo para confirmar que es tuyo."
        onBack={step === 'done' ? undefined : 'auto'}
      />

      {banner ? <ErrorState title={banner.title} detail={banner.detail} /> : null}
      {generic ? (
        <ErrorState
          title={generic.title}
          detail={generic.detail}
          reference={generic.reference}
          onRetry={generic.canRetry ? (step === 'code' ? confirmCode : sendCode) : undefined}
        />
      ) : null}

      {step === 'email' ? (
        <>
          <Card>
            <AtlasText variant="caption" tone="tertiary">
              Tu correo actual
            </AtlasText>
            <AtlasText variant="bodyStrong">{currentDomain ? `Termina en @${currentDomain}` : 'Sin registrar'}</AtlasText>
          </Card>
          <Field
            label="Correo nuevo"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (error) setError(null);
            }}
            onBlur={() => setEmailTouched(true)}
            error={fieldError('email') ?? (emailTouched ? localEmailError : null)}
            hint="Escríbelo con cuidado: ahí llegará el código y con él ingresarás desde ahora."
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            maxLength={180}
            required
          />
          <AtlasText variant="caption" tone="tertiary">
            Hasta que confirmes el código, tu correo actual sigue funcionando.
          </AtlasText>
        </>
      ) : null}

      {step === 'code' && sent ? (
        <>
          {sent.deliveryFailed ? (
            <ErrorState
              title="No pudimos entregar el código"
              detail={`El correo a @${domainOf(email)} no salió. Revisa que esté bien escrito o pide otro código.`}
              onRetry={sendCode}
            />
          ) : (
            <Card>
              <AtlasText variant="bodyStrong">Código enviado a {email.trim()}</AtlasText>
              <AtlasText variant="caption" tone="secondary">
                Vence a las {new Date(sent.expiresAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}.
                Revisa también la carpeta de spam.
              </AtlasText>
            </Card>
          )}
          {!sent.deliveryFailed ? (
            <Field
              label="Código recibido"
              value={code}
              onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 8))}
              error={fieldError('code')}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={8}
              autoFocus
              required
            />
          ) : null}
        </>
      ) : null}

      {step === 'done' ? (
        <Card>
          <AtlasText variant="h3">Correo actualizado</AtlasText>
          <AtlasText variant="body" tone="secondary">
            {promoted
              ? `Desde ahora ingresas con ${email.trim()} y ahí te llegarán los códigos y avisos de tu cuenta.`
              : 'Confirmamos el correo nuevo. Si al ingresar no te lo acepta, escríbenos y lo revisamos.'}
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Nunca te pediremos este código por teléfono ni por redes sociales.
      </AtlasText>
    </Screen>
  );
}
