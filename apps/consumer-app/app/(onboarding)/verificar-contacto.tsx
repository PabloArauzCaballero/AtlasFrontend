/**
 * Verificacion del telefono, y despues del correo.
 *
 * Desde el 2026-09-18 son DOS rondas en la misma pantalla: primero el telefono (WhatsApp o SMS),
 * que es obligatorio —es por donde se cobra y se avisa—, y despues el correo, que se verifica pero
 * NO bloquea el avance: un correo mal tecleado no puede tumbar un alta, y «Verificar despues» esta
 * a la vista. Si el servidor no tiene ningun canal de telefono encendido, se empieza por el correo.
 *
 * El codigo lo genera y entrega el servidor. Si el canal no esta disponible en el entorno, la
 * pantalla lo dice tal cual y ofrece el otro canal: un codigo que nunca se envio y una pantalla que
 * dice "revisa tus mensajes" es la peor combinacion posible.
 */
import { StyleSheet, View, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useRef } from 'react';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import type { CanalDeVerificacion } from '../../src/api/endpoints/onboarding';
import { canalElegido, canalesOfrecidos, type CanalesOfrecidos } from '../../src/features/onboarding/canales-de-verificacion';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { useSession } from '../../src/session/session';
import { space } from '../../src/theme/tokens';
import { firstBlocker } from '../../src/ui/blocked';
import { IconField, SelectField } from '../../src/ui/form-controls';
import { Gap, Screen, useScrollToError } from '../../src/ui/layout';
import { StepHeader } from '../../src/ui/step-header';
import { AtlasText, Button, Card, CardHeader, ErrorState, IconChip } from '../../src/ui/primitives';
import { bitacora } from '../../src/features/bitacora';

type Channel = 'sms' | 'whatsapp' | 'email';

/**
 * Los canales que el SERVIDOR puede entregar ahora mismo.
 *
 * Pregunta a `/customer-onboarding/verification-channels`; toda la decision sobre lo que vuelve vive
 * en `canales-de-verificacion.ts`, que se prueba sin montar React. Aqui solo queda el ciclo de vida.
 *
 * `sinPantalla` a proposito: si esta consulta falla no es culpa de quien usa la app ni le impide
 * seguir —se cae al respaldo—, asi que no merece una pantalla de error.
 */
function useCanales(): CanalesOfrecidos & { cargando: boolean } {
  const [catalogo, setCatalogo] = useState<CanalDeVerificacion[] | null>(null);
  const [resuelto, setResuelto] = useState(false);

  useEffect(() => {
    let vivo = true;
    onboardingApi
      .listVerificationChannels()
      .then((r) => {
        if (!vivo) return;
        setCatalogo(r.channels);
        setResuelto(true);
      })
      .catch(() => {
        if (vivo) setResuelto(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
    `cargando` bloquea el boton de pedir el codigo mientras no se sabe que canales hay. Son decimas
    de segundo, pero sin ello un toque inmediato pedia el codigo por el canal por defecto —que puede
    no ser el que el servidor tiene encendido— y devolvia VERIFICATION_CHANNEL_UNAVAILABLE a quien no
    hizo nada mal.
  */
  return { ...canalesOfrecidos(catalogo), cargando: !resuelto };
}

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
  /*
   * Memorizada por `expiresAt`: sin esto la funcion se recreaba en cada render y el efecto que la
   * usa no podia declararla como dependencia sin relanzarse a cada fotograma —o mentir en su lista.
   */
  const calcular = useCallback(
    () => (expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0),
    [expiresAt],
  );
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
  }, [expiresAt, calcular]);

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

  /*
    El canal por defecto YA NO se fija aqui: lo dice el servidor.

    Los tres proveedores se encienden por separado en el backend y pedir un codigo por uno apagado
    responde `VERIFICATION_CHANNEL_UNAVAILABLE`. Quien llega a esta pantalla ya hizo todo el alta,
    asi que el primer intento no puede ser un callejon sin salida que obligue a adivinar cual de los
    tres funciona. Antes se fijaba «correo» porque era el unico encendido — un parche, y rotulado
    como tal: el dia que se encendiera SMS habria hecho falta publicar una app nueva para ofrecerlo.

    `useCanales` pregunta y esta pantalla usa lo que venga.
  */
  const { opciones: todasLasOpciones, cargando } = useCanales();
  /*
    La ronda: telefono primero, correo despues. Se decide con el catalogo: si no hay ningun canal
    de telefono encendido, la unica ronda posible es la del correo.
  */
  const hayTelefono = todasLasOpciones.some((o) => o.valor !== 'email');
  const hayCorreo = todasLasOpciones.some((o) => o.valor === 'email');
  const [ronda, setRonda] = useState<'telefono' | 'correo'>('telefono');
  const rondaEfectiva: 'telefono' | 'correo' = ronda === 'telefono' && !hayTelefono && hayCorreo ? 'correo' : ronda;
  const opciones = todasLasOpciones.filter((o) => (rondaEfectiva === 'correo' ? o.valor === 'email' : o.valor !== 'email'));
  const unico = opciones.length === 1 && opciones[0] ? opciones[0].etiqueta.toLowerCase() : null;
  const [channel, setChannel] = useState<Channel>('whatsapp');

  /*
    Al llegar el catalogo, si el canal elegido no esta entre los que el servidor puede entregar, se
    cambia al primero que si. No pelea con la eleccion de la persona: el catalogo llega una vez y no
    vuelve a cambiar, asi que esto solo corrige el valor inicial.
  */
  useEffect(() => {
    setChannel((actual) => canalElegido(actual, opciones));
    // `opciones` se recalcula en cada render; lo que cambia de verdad es el catalogo o la ronda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasLasOpciones, rondaEfectiva]);
  /*
    `expiresAt` puede ser NULO, y eso significa algo concreto: sabemos que hay un codigo en camino
    pero no cuando vence. Pasa cuando el servidor contesta VERIFICATION_RATE_LIMITED —ya mando uno
    hace menos de 30 s— y en esa respuesta no viaja el vencimiento del anterior. Sin este caso la
    pantalla solo sabia «enviado con reloj» o «error», y el reencuentro con un codigo que YA existe
    caia en «error».
  */
  const [sent, setSent] = useState<{ expiresAt: string | null; deliveryStatus: string; deliveredChannel: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const contactType: 'phone' | 'email' = channel === 'email' ? 'email' : 'phone';

  /** Al terminar la ronda del telefono se pasa a la del correo; al terminar la del correo, al indice. */
  const terminarRonda = async () => {
    await session.refresh();
    if (rondaEfectiva === 'telefono' && hayCorreo) {
      setRonda('correo');
      setChannel('email');
      setSent(null);
      setCode('');
      setError(null);
      return;
    }
    router.replace('/(onboarding)/progreso');
  };

  /**
   * Pide el codigo por un canal CONCRETO.
   *
   * El canal viaja como argumento y no se lee del estado a proposito: el envio de llegada ocurre en
   * el mismo commit en el que el catalogo corrige `channel`, y leer el estado ahi devuelve el valor
   * anterior —`whatsapp`, que es el inicial y en TEST esta apagado—. Quien llama ya tiene delante
   * el catalogo; que decida con el.
   */
  const pedirCodigo = useCallback(
    async (canal: Channel) => {
      if (!customerId) return;
      setBusy(true);
      setError(null);
      // El codigo viejo se borra al pedir otro: dejarlo escrito hace que el primer toque de
      // «Confirmar» gaste un intento con el codigo que acaba de quedar invalidado.
      setCode('');
      try {
        const result = await bitacora.medirEnvio(() =>
          onboardingApi.requestContactVerification(customerId, {
            contactType: canal === 'email' ? 'email' : 'phone',
            verificationChannel: canal,
          }),
        );
        setSent({
          expiresAt: result.expiresAt,
          deliveryStatus: result.deliveryStatus,
          deliveredChannel: result.deliveredChannel ?? null,
        });
      } catch (caught) {
        /*
          «Ya te mandamos uno hace un momento» NO es un fallo, y pintarlo como tal es peor que el
          problema que arregla.

          El servidor guarda 30 s entre envios al mismo contacto (`RESEND_COOLDOWN_MS`) y responde
          409 VERIFICATION_RATE_LIMITED. Como el codigo ahora se pide al llegar, basta con volver
          atras y entrar otra vez —o recargar— para caer dentro de esa ventana: sin este caso, la
          pantalla recibia a alguien que TIENE un codigo valido en el telefono con un cartel rojo de
          «algo no salio bien». Medido contra TEST el 2026-09-21; el codigo anterior sigue vivo diez
          minutos.

          Asi que se trata como lo que es: hay codigo, escribelo. Sin cuenta atras, porque el
          vencimiento del anterior no viene en esta respuesta y un reloj inventado seria mentira.
        */
        if (caught instanceof AtlasApiError && caught.code === 'VERIFICATION_RATE_LIMITED') {
          setSent({ expiresAt: null, deliveryStatus: 'sent', deliveredChannel: null });
        } else {
          setError(caught);
        }
      } finally {
        setBusy(false);
      }
    },
    [customerId],
  );

  /** Reenviar por el canal que hay elegido ahora mismo. Es lo que hace el boton. */
  const sendCode = () => {
    void pedirCodigo(channel);
  };

  /*
    El codigo SALE AL LLEGAR a la pantalla, no cuando alguien encuentra el boton.

    Hasta el 2026-09-21 habia que pulsar «Enviarme el codigo» mientras la pantalla ya decia, en
    pasado, «Te enviamos un codigo»: la frase era falsa hasta ese toque, y quien se la creia esperaba
    en su bandeja un mensaje que nadie habia pedido. El resultado medido era el peor posible: un alta
    parada en una pantalla que afirmaba estar esperando algo que no existia. El servidor no tenia
    nada que ver —comprobado contra TEST ese mismo dia: responde `deliveryStatus: "sent"` en cuanto
    se le pide, por SMS y por correo—; lo que faltaba era pedirlo.

    Una vez por RONDA: al llegar (telefono) y al pasar al correo. Cambiar de canal a mano NO vuelve a
    disparar: eso sigue siendo un acto deliberado y tiene su boton. Un desplegable que manda un
    mensaje en cada cambio gasta los intentos de quien solo estaba mirando las opciones.
  */
  const rondaPedida = useRef<'telefono' | 'correo' | null>(null);
  useEffect(() => {
    if (cargando || !customerId || opciones.length === 0) return;
    if (rondaPedida.current === rondaEfectiva) return;
    rondaPedida.current = rondaEfectiva;
    const canal = canalElegido(channel, opciones);
    setChannel(canal);
    void pedirCodigo(canal);
    // `opciones` y `channel` se recalculan en cada render; lo que dispara es la ronda y el catalogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, customerId, rondaEfectiva, pedirCodigo]);

  const confirmCode = async () => {
    if (!customerId || code.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await bitacora.medirEnvio(() =>
        onboardingApi.submitContactVerification(customerId, {
          contactType,
          verificationChannel: channel,
          verificationCode: code,
        }),
      );
      await terminarRonda();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;
  const envioIncierto = error instanceof AtlasApiError && (error.kind === 'timeout' || error.kind === 'network');

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);
  const channelUnavailable = error instanceof AtlasApiError && error.code === 'VERIFICATION_CHANNEL_UNAVAILABLE';
  // El servidor registra el intento aunque el proveedor falle: hay que decirlo, no fingir exito.
  const deliveryFailed = sent?.deliveryStatus === 'delivery_failed';

  const restante = useRestante(sent?.expiresAt && !deliveryFailed ? sent.expiresAt : null);
  /*
    Vencido por dos caminos, y hacen falta los dos.

    El contador cubre el caso normal —la persona esta mirando la pantalla cuando se acaba el
    tiempo—. El error del servidor cubre el resto: el reloj del telefono adelantado, la app dormida
    durante el ultimo minuto, o un codigo que el backend invalido antes de tiempo. Fiarse solo del
    contador seria confiar en el reloj del dispositivo para decidir algo que decide el servidor.
  */
  /*
    El codigo salio por correo aunque se pidio por telefono.

    Es la reserva del backend cuando el SMS no puede entregarse —el 2026-09-21 la cuenta de Brevo no
    tenia credito y sus 25 envios del dia figuran como `rejected`—. Lo unico que no puede pasar es
    que la pantalla siga diciendo «revisa tus mensajes».
  */
  const porCorreoEnVezDeSms = sent?.deliveredChannel === 'email' && channel !== 'email';
  const vencidoPorServidor = error instanceof AtlasApiError && error.code === 'VERIFICATION_CODE_EXPIRED';
  // Sin vencimiento conocido no se puede declarar vencido por el reloj: solo si lo dice el servidor.
  const vencido = Boolean(sent) && !deliveryFailed && (Boolean(sent?.expiresAt) && restante === 0 ? true : vencidoPorServidor);

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
              <Button label="Enviarme otro código" bitacora="enviar_codigo" onPress={sendCode} loading={busy} disabled={busy} />
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
                bitacora="confirmar_codigo"
                onPress={confirmCode}
                loading={busy}
                disabled={code.length < 4 || busy}
                blockedReason={firstBlocker([[code.length >= 4, 'Escribe el código que recibiste.']])}
                haptic="success"
              />
              <Button label="Enviar otro código" bitacora="enviar_codigo" variant="ghost" onPress={sendCode} disabled={busy} />
            </>
          )
        ) : (
          <>
            {/*
              Este boton ya no es la puerta de entrada: el codigo sale solo. Es la SALIDA cuando el
              envio de llegada no salio —canal apagado, red caida—, y por eso se rotula como lo que
              hace en ese momento.
            */}
            <Button
              label={described ? 'Intentar de nuevo' : 'Enviarme el código'}
              bitacora="enviar_codigo"
              onPress={sendCode}
              loading={busy || cargando}
              disabled={busy || cargando}
            />
            {/*
              El correo no bloquea: quien no lo tiene a mano sigue con el alta y lo verifica despues
              desde su perfil. El telefono si bloquea, y por eso este boton solo existe en su ronda.
            */}
            {rondaEfectiva === 'correo' ? (
              <Button
                label="Verificar mi correo después"
                bitacora="verificar_despues"
                variant="ghost"
                onPress={() => {
                  void session.refresh();
                  router.replace('/(onboarding)/progreso');
                }}
                disabled={busy}
              />
            ) : null}
          </>
        )
      }
    >
      <StepHeader
        code="contact_verification"
        title={rondaEfectiva === 'correo' ? 'Ahora tu correo' : 'Verifica tu teléfono'}
        /*
          El subtitulo habla en PASADO —«te enviamos»— y ahora eso es verdad: el codigo sale al
          abrir la pantalla. Mientras sale, lo dice en presente; si no salio, no promete nada y el
          fallo se explica debajo. Un texto en pasado sobre algo que aun no ocurrio es exactamente
          lo que tenia rota esta pantalla.
        */
        subtitle={
          rondaEfectiva === 'correo'
            ? sent
              ? 'Te enviamos un código a tu correo. Puedes hacerlo después: no detiene tu registro.'
              : described
                ? envioIncierto
                  ? 'No pudimos confirmar si se envió el código. Puedes reintentar o hacerlo después: no detiene tu registro.'
                  : 'No pudimos enviarlo. Puedes reintentar o hacerlo después: no detiene tu registro.'
                : 'Estamos enviando un código a tu correo…'
            : sent
              ? `Te enviamos un código ${channel === 'whatsapp' ? 'por WhatsApp' : 'por SMS'} para confirmar que el número es tuyo.`
              : described
                ? envioIncierto
                  ? 'No pudimos confirmar si se envió el código. Prueba de nuevo o cambia de canal.'
                  : 'No pudimos enviar el código. Prueba de nuevo o cambia de canal.'
                : 'Estamos enviando un código a tu número para confirmar que es tuyo…'
        }
      />

      {described ? (
        <ErrorState
          title={channelUnavailable ? 'Canal no disponible' : described.title}
          detail={
            channelUnavailable
              ? 'Ese canal no está habilitado en este momento. Prueba con otro.'
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
        opciones={opciones}
        ayuda="Por dónde quieres que te llegue el código de seis dígitos que confirma tu contacto. Elige el que revises ahora mismo: el código vence en pocos minutos."
        /*
          Con un solo canal el desplegable no ofrece nada que elegir, asi que se bloquea DICIENDO por
          que. Dejarlo abierto con una sola opcion invita a buscar alternativas que no existen.
        */
        deshabilitadoPorque={unico ? `Ahora mismo el código solo se puede enviar por ${unico}.` : null}
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

                    Sin vencimiento conocido —el codigo ya estaba enviado— se dice eso y nada mas.
                    Un reloj puesto a ojo sobre un codigo ajeno seria peor que no ponerlo.
                  */}
                  {/*
                    Y a DONDE fue. El servidor puede entregarlo por el correo del mismo cliente
                    cuando el SMS no sale (reserva de `OTP_SMS_FALLBACK_TO_EMAIL`): callarlo deja a
                    la persona mirando un telefono en el que no va a aparecer nada. Se dice antes
                    que el vencimiento porque primero se busca el mensaje y despues se corre.
                  */}
                  {porCorreoEnVezDeSms ? (
                    <AtlasText variant="caption" tone="secondary">
                      No pudimos enviarte el SMS, así que te lo mandamos a tu correo. Revisa tu bandeja.
                    </AtlasText>
                  ) : null}
                  <AtlasText variant="caption" tone="secondary">
                    {sent.expiresAt ? 'Vence en la cuenta atrás' : 'Te lo mandamos hace un momento: revisa tus mensajes.'}
                  </AtlasText>
                </View>
                {/*
                  La cuenta atras en cifras TABULARES: es un numero que cambia cada segundo, y con
                  cifras proporcionales el bloque se ensancha y se encoge en cada tic. Es el sitio
                  de la app donde mas se nota, y era el unico que no las llevaba.
                */}
                {sent.expiresAt ? (
                  <AtlasText variant="amountSmall" tone={restante < 60 ? 'warning' : 'primary'}>
                    {comoReloj(restante)}
                  </AtlasText>
                ) : null}
              </View>
            </Card>
          )}

          <IconField icon="escudo" bitacora="codigo_verificacion"
            label="Código recibido"
            value={code}
            onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 8))}
            ayuda="Los dígitos que acabas de recibir, sin espacios. Sirven una sola vez y vencen en pocos minutos; si ya venció, pide otro y usa el último que llegó."
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
