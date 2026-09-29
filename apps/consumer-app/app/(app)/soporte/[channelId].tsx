/**
 * La conversacion con soporte.
 *
 * ## Por que se parece a WhatsApp y no a un formulario de tickets
 *
 * Porque quien escribe ya tiene un problema, y la forma en que la gente cuenta un problema es
 * hablando. Burbujas, orden de llegada, doble tic y «escribiendo…» no son adorno: son las señales
 * que dicen «esto llego» y «alguien esta del otro lado». Un formulario con un boton «enviar
 * consulta» deja a la persona sin ninguna de las dos.
 *
 * ## Lo que NO se copia de WhatsApp
 *
 * No hay «entregado». El servidor sabe que guardo el mensaje, no que el telefono del agente lo
 * recibio; pintar un segundo tic gris seria afirmar algo que no nos consta. Dos estados ciertos
 * —enviado y leido— informan mejor que tres con uno inventado.
 *
 * Y no se puede borrar ni editar lo enviado: la transcripcion es la prueba de lo que se hablo con
 * una entidad financiera. Corregir manda un mensaje nuevo, como en la vida real.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as supportApi from '../../../src/api/endpoints/support';
import { CHAT_POLL_MS, fueLeido, mezclarMensajes, subirFotoAlChat, ultimaSecuencia } from '../../../src/features/support-chat';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, EmptyState, Skeleton } from '../../../src/ui/primitives';
import { color, radius, space } from '../../../src/theme/tokens';

/** Identificador propio del mensaje. Se conserva al reintentar: es lo que evita duplicarlo. */
function nuevoClientMessageId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Conversacion() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const [mensajes, setMensajes] = useState<supportApi.SupportMessage[]>([]);
  const [readState, setReadState] = useState<supportApi.ReadState[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** El mensaje que se está intentando enviar, con el identificador que debe repetirse al reintentar. */
  const pendiente = useRef<{ cuerpo: string; clientMessageId: string } | null>(null);

  const canal = String(channelId ?? '');

  /**
   * Cerrar la conversación desde el teléfono.
   *
   * `closeChannel` existía en el cliente de API y no tenía botón: la persona sólo podía dejar de
   * escribir, y el canal seguía abierto en la cola del agente. Se confirma antes porque cerrar no
   * se deshace; después la pantalla vuelve atrás porque ya no hay hilo que mirar.
   */
  const cerrarConversacion = () => {
    Alert.alert('Cerrar la conversación', 'Podrás abrir otra cuando quieras.', [
      { text: 'Seguir hablando', style: 'cancel' },
      {
        text: 'Cerrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await supportApi.closeChannel(canal);
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/ayuda');
          } catch {
            setError('No pudimos cerrar la conversación. Inténtalo de nuevo.');
          }
        },
      },
    ]);
  };

  /**
   * Trae lo nuevo y marca leido en la misma pasada.
   *
   * Marcar leido aqui —y no al abrir— es lo correcto: la persona esta mirando la pantalla en este
   * momento. Marcarlo al abrir dejaria como leidos mensajes que llegaron despues, mientras miraba
   * otra cosa.
   */
  const refrescar = useCallback(
    async (desde?: string) => {
      if (!canal) return;
      try {
        const transcript = await supportApi.readTranscript(canal, desde ? { afterSequence: desde } : {});
        setReadState(transcript.readState);
        setMensajes((previos) => {
          const combinados = mezclarMensajes(previos, transcript.messages);
          const ultima = ultimaSecuencia(combinados);
          if (ultima) void supportApi.markRead(canal, ultima).catch(() => undefined);
          return combinados;
        });
        setError(null);
      } catch {
        // Un fallo de red no vacia la conversacion que ya se esta leyendo: se reintenta al siguiente
        // ciclo. Borrar lo que hay en pantalla ante un corte seria castigar al usuario por el corte.
        setError('Sin conexión. Seguimos intentando.');
      } finally {
        setCargando(false);
      }
    },
    [canal],
  );

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMensajes((actuales) => {
        void refrescar(ultimaSecuencia(actuales));
        return actuales;
      });
    }, CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [refrescar]);

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);

    /*
     * El identificador se CONSERVA entre reintentos del mismo mensaje.
     *
     * Se vio en el simulador: el envío venció por tiempo del lado del cliente, el servidor sí lo
     * había guardado, y al reintentar con un identificador nuevo el mensaje salió DOS veces. La
     * idempotencia la ofrece el backend, pero sólo funciona si el cliente repite el mismo
     * `clientMessageId` — generarlo otra vez en el reintento la anula.
     */
    if (pendiente.current?.cuerpo !== cuerpo) {
      pendiente.current = { cuerpo, clientMessageId: nuevoClientMessageId() };
    }
    const { clientMessageId } = pendiente.current;

    // El campo se vacia YA: si esperara a la respuesta, en una conexion lenta la persona creeria
    // que no se envio y volveria a escribirlo.
    setTexto('');
    try {
      const enviado = await supportApi.sendMessage(canal, { clientMessageId, body: cuerpo });
      pendiente.current = null;
      setMensajes((previos) => mezclarMensajes(previos, [enviado]));
      setError(null);
    } catch {
      // El texto vuelve al campo y `pendiente` se mantiene: el próximo intento reusa su identificador.
      setTexto(cuerpo);
      setError('No pudimos enviar tu mensaje. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const adjuntarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const elegida = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (elegida.canceled || !elegida.assets[0]) return;

    setEnviando(true);
    try {
      const adjunto = await subirFotoAlChat({ channelId: canal, localUri: elegida.assets[0].uri });
      const enviado = await supportApi.sendMessage(canal, {
        clientMessageId: nuevoClientMessageId(),
        body: 'Te envío una imagen',
        messageType: 'IMAGE',
        attachment: adjunto,
      });
      setMensajes((previos) => mezclarMensajes(previos, [enviado]));
      setError(null);
    } catch {
      setError('No pudimos enviar la imagen. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen
      scroll={false}
      /*
       * `animate={false}` no es cosmético: la entrada escalonada envuelve cada hijo en un contenedor
       * SIN flex, y ahí dentro el `flex: 1` de la lista se resuelve a altura cero — la conversación
       * desaparecía entera. Es lo que el propio `Screen` documenta para contenido que ocupa la
       * pantalla completa.
       */
      animate={false}
      footer={
        <View style={{ gap: space.sm }}>
          {error ? (
            <AtlasText variant="caption" tone="danger">
              {error}
            </AtlasText>
          ) : null}
          <Field
            label="Tu mensaje"
            value={texto}
            onChangeText={(valor) => {
              setTexto(valor);
              // Avisar «escribiendo…» es efimero y no se guarda: si falla, no se pierde nada.
              if (valor.length === 1) void supportApi.announceTyping(canal).catch(() => undefined);
            }}
            placeholder="Escribe aquí…"
            ayuda="Cuéntanos qué pasó con tus palabras: qué intentabas hacer, qué viste y cuándo. Nunca escribas tu PIN ni el código que te llega por SMS o correo: nadie de Atlas te los va a pedir."
            multiline
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Foto" variant="secondary" icon={null} onPress={() => void adjuntarFoto()} disabled={enviando} />
            <View style={{ flex: 1 }}>
              <Button
                label="Enviar"
                onPress={() => void enviar()}
                loading={enviando}
                disabled={texto.trim().length === 0}
                blockedReason={texto.trim().length === 0 ? 'Escribe un mensaje para enviarlo.' : null}
              />
            </View>
          </View>
        </View>
      }
    >
      <ScreenHeader
        title="Soporte"
        subtitle="Escríbenos tu duda."
        onBack="auto"
        action={<Button label="Cerrar" variant="secondary" icon={null} onPress={cerrarConversacion} disabled={cargando} />}
      />

      {cargando ? (
        <Card>
          <Skeleton height={40} width="70%" />
          <Skeleton height={40} width="55%" />
        </Card>
      ) : null}

      {!cargando && mensajes.length === 0 ? (
        <EmptyState icon="ayuda" title="Aún no hay mensajes" detail="Escribe abajo y te respondemos por aquí mismo." />
      ) : null}

      {/*
        La lista OCUPA lo que queda, y por eso lleva `flex: 1`.

        Sin él, el `ScrollView` se encoge a la altura de su contenido y, al abrir el teclado, la
        conversación queda reducida a una franja con el último mensaje cortado por el compositor —
        justo el mensaje que la persona acaba de escribir. Se vio en el simulador, no en el tipado.
      */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.base, flexGrow: 1, justifyContent: 'flex-end' }}
      >
        {mensajes.map((mensaje) => (
          <Burbuja key={mensaje.messageId} mensaje={mensaje} leido={fueLeido(mensaje, readState)} />
        ))}
      </ScrollView>

      <Gap size="sm" />
    </Screen>
  );
}

/**
 * Un mensaje.
 *
 * El del sistema —la advertencia de no compartir claves— va centrado y sin lado: no es de ninguna
 * de las dos partes, es una regla de la casa. Confundirlo con un mensaje del agente haria pensar
 * que el agente esta a punto de pedir algo.
 */
function Burbuja({ mensaje, leido }: { mensaje: supportApi.SupportMessage; leido: boolean }) {
  const mio = mensaje.senderActorType === 'CUSTOMER';
  const delSistema = mensaje.senderActorType === 'SYSTEM' || mensaje.visibility === 'SYSTEM';

  if (delSistema) {
    return (
      <Card tone="warning" padding="tight">
        <AtlasText variant="caption" tone="secondary">
          {mensaje.body}
        </AtlasText>
      </Card>
    );
  }

  return (
    <View style={{ alignItems: mio ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          // El mío en superficie de marca tenue y el del agente en la superficie elevada normal:
          // el lado ya lo dice, pero el color lo dice también para quien no distingue el lado.
          backgroundColor: mio ? color.surface.raisedStrong : color.surface.raised,
          borderRadius: radius.lg,
          padding: space.sm,
          gap: space.xs,
        }}
      >
        <AtlasText variant="body">{mensaje.body}</AtlasText>

        {mensaje.attachments.map((adjunto) => (
          <Badge key={adjunto.attachmentId} label={`📎 ${adjunto.filename}`} tone="info" />
        ))}

        {/*
          La redaccion se EXPLICA. Un texto que aparece tachado sin motivo se lee como un fallo de la
          app; decir que se oculto un codigo enseña, ademas, por que no hay que compartirlo.
        */}
        {mensaje.redacted ? (
          <AtlasText variant="caption" tone="secondary">
            Ocultamos un dato sensible de este mensaje por tu seguridad.
          </AtlasText>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs }}>
          <AtlasText variant="caption" tone="secondary">
            {new Date(mensaje.createdAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
          </AtlasText>
          {mio ? (
            <AtlasText variant="caption" tone={leido ? 'brand' : 'secondary'}>
              {leido ? 'Leído' : 'Enviado'}
            </AtlasText>
          ) : null}
        </View>
      </View>
    </View>
  );
}
