/**
 * Verificacion del telefono.
 *
 * El codigo lo genera y entrega el servidor. Si el canal no esta disponible en el entorno, la
 * pantalla lo dice tal cual y ofrece el otro canal: un codigo que nunca se envio y una pantalla que
 * dice "revisa tus mensajes" es la peor combinacion posible.
 */
import { StyleSheet, View, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { space } from '../../src/theme/tokens';
import { firstBlocker } from '../../src/ui/blocked';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Button, Card, CardHeader, ErrorState, IconChip } from '../../src/ui/primitives';

type Channel = 'sms' | 'whatsapp' | 'email';

/**
 * Cuanto le queda de vida al codigo, en segundos, contando de verdad.
 *
 * ## Por que un contador y no la hora de vencimiento
 *
 * La pantalla decia «Vence a las 11:30» y ahi se quedaba: a las 11:31 seguia diciendo lo mismo, con
 * el campo abierto invitando a teclear un codigo que el servidor ya no acepta. La persona se entera
 * del vencimiento **fallando**, y un fallo de codigo se lee como «lo escribi mal», que es justo la
 * conclusion equivocada: lo que hay que hacer no es reintentar, es pedir otro.
 *
 * ## Por que se recalcula desde `Date.now()` en cada tic
 *
 * Y no restando uno al valor anterior. Un contador que se decrementa se queda congelado mientras la
 * app esta en segundo plano —que es exactamente donde va a estar la persona: en su bandeja de
 * correo o en sus mensajes— y al volver muestra un tiempo que no existe. Restar contra el reloj da
 * el valor correcto al primer fotograma despues de volver.
 *
 * La hora de vencimiento la manda el SERVIDOR (`expiresAt`). Aqui no se inventa ninguna duracion:
 * si el backend cambia la ventana, esta pantalla la sigue sin tocar una linea.
 */
function useRestante(expiresAt: string | null): number {
  const calcular = () => (expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0);
  const [restante, setRestante] = useState(calcular);

  useEffect(() => {
    if (!expiresAt) {
      setRestante(0);
      return;
    }
    setRestante(calcular());
    const id = setInterval(() => {
      const quedan = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRestante(quedan);
      // Llegado a cero el intervalo se apaga solo: seguir despertando cada segundo para recalcular
      // un cero no cambia nada en pantalla y mantiene vivo un temporizador por pantalla abierta.
      if (quedan === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return restante;
}

/** `4:07`, no `247 s`. Un codigo se espera en minutos y segundos, como cualquier cuenta atras. */
function comoReloj(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

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
    // El codigo viejo se borra al pedir otro: dejarlo escrito hace que el primer toque de
    // «Confirmar» gaste un intento con el codigo que acaba de quedar invalidado.
    setCode('');
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

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);
  const channelUnavailable = error instanceof AtlasApiError && error.code === 'VERIFICATION_CHANNEL_UNAVAILABLE';
  // El servidor registra el intento aunque el proveedor falle: hay que decirlo, no fingir exito.
  const deliveryFailed = sent?.deliveryStatus === 'delivery_failed';

  const restante = useRestante(sent && !deliveryFailed ? sent.expiresAt : null);
  /*
    Vencido por dos caminos, y hacen falta los dos.

    El contador cubre el caso normal —la persona esta mirando la pantalla cuando se acaba el
    tiempo—. El error del servidor cubre el resto: el reloj del telefono adelantado, la app dormida
    durante el ultimo minuto, o un codigo que el backend invalido antes de tiempo. Fiarse solo del
    contador seria confiar en el reloj del dispositivo para decidir algo que decide el servidor.
  */
  const vencidoPorServidor = error instanceof AtlasApiError && error.code === 'VERIFICATION_CODE_EXPIRED';
  const vencido = Boolean(sent) && !deliveryFailed && (restante === 0 || vencidoPorServidor);

  return (
    <Screen scrollRef={scroll}
      footer={
        sent && !deliveryFailed ? (
          /*
            Vencido, los dos botones INTERCAMBIAN su papel.

            Mientras el codigo vale, la accion es confirmarlo y reenviar es la salida de emergencia.
            Cuando vence, lo unico que se puede hacer es pedir otro: dejar «Confirmar» encendido y
            en primer lugar invita a gastar un intento en un codigo que el servidor ya rechaza —y
            los intentos fallidos bloquean la cuenta temporalmente—.
          */
          vencido ? (
            <>
              <Button label="Enviarme otro código" onPress={sendCode} loading={busy} disabled={busy} />
              <Button
                label="Confirmar código"
                variant="ghost"
                onPress={confirmCode}
                disabled
                blockedReason="Ese código venció. Pide uno nuevo."
              />
            </>
          ) : (
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
          )
        ) : (
          <Button label="Enviarme el código" onPress={sendCode} loading={busy} disabled={busy} />
        )
      }
    >
      <StepHeader code="contact_verification" title="Verifica tu contacto" subtitle="Confirmamos que el número o correo es tuyo." />

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

      <SelectField<Channel>
        label="Cómo quieres recibir el código"
        value={channel}
        onChange={(next) => {
          setChannel(next);
          setSent(null);
          setError(null);
        }}
        opciones={[
          { valor: 'sms', etiqueta: 'SMS', detalle: 'A tu número registrado.' },
          { valor: 'whatsapp', etiqueta: 'WhatsApp', detalle: 'Al mismo número.' },
          { valor: 'email', etiqueta: 'Correo', detalle: 'A tu correo registrado.' },
        ]}
      />

      {sent && !deliveryFailed ? (
        <>
          {vencido ? (
            <Card tone="danger">
              <CardHeader
                icon="alerta"
                iconTone="danger"
                title="El código venció"
                detail={`Por seguridad los códigos duran poco. Pide otro y te lo enviamos al mismo ${
                  channel === 'email' ? 'correo' : 'número'
                }.`}
                divider={false}
              />
            </Card>
          ) : (
            <Card padding="tight">
              <View style={styles.enviado}>
                <IconChip name="reloj" tone="brand" size="sm" />
                <View style={styles.enviadoTexto}>
                  <AtlasText variant="title">Código enviado</AtlasText>
                  {/*
                    El tiempo que queda, no la hora a la que vence. «Vence a las 11:30» obliga a
                    mirar el reloj y restar; «Vence en 4:07» ya es la respuesta a la unica pregunta
                    que se hace quien esta esperando un codigo: si le da tiempo a ir a buscarlo.
                  */}
                  <AtlasText variant="caption" tone="secondary">
                    Vence en la cuenta atrás
                  </AtlasText>
                </View>
                {/*
                  La cuenta atras en cifras TABULARES: es un numero que cambia cada segundo, y con
                  cifras proporcionales el bloque se ensancha y se encoge en cada tic. Es el sitio
                  de la app donde mas se nota, y era el unico que no las llevaba.
                */}
                <AtlasText variant="amountSmall" tone={restante < 60 ? 'warning' : 'primary'}>
                  {comoReloj(restante)}
                </AtlasText>
              </View>
            </Card>
          )}

          <IconField icon="escudo"
            label="Código recibido"
            value={code}
            onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
            // Vencido, el campo se cierra: teclear ahi solo puede acabar en un intento fallido.
            editable={!vencido}
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

const styles = StyleSheet.create({
  enviado: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  enviadoTexto: { flex: 1, gap: space.xxs },
});
