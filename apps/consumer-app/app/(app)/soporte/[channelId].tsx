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
import { AdjuntoImagen } from '../../../src/ui/adjunto-imagen';
import { CompositorChat } from '../../../src/ui/compositor-chat';
import { AvisoDelSistema, BurbujaChat, InicioDeChat, NotaDeSeguridad, PresenciaDeSoporte, SeparadorDeDia } from '../../../src/ui/chat-kit';
import { armarHilo, horaCorta, type LadoDelMensaje } from '../../../src/features/chat-hilo';
import { Gap, HeaderAction, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Card, Skeleton } from '../../../src/ui/primitives';
import { color, space } from '../../../src/theme/tokens';
import { useCopy } from '../../../src/features/use-contenido-remoto';

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
  /** La foto elegida y aún sin enviar: se ve, se puede quitar y admite un texto antes de mandarla. */
  const [fotoPendiente, setFotoPendiente] = useState<string | null>(null);
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
    if ((!cuerpo && !fotoPendiente) || enviando) return;
    setEnviando(true);

    if (pendiente.current?.cuerpo !== cuerpo) {
      pendiente.current = { cuerpo, clientMessageId: nuevoClientMessageId() };
    }
    const { clientMessageId } = pendiente.current;

    try {
      if (fotoPendiente) {
        // Con foto: se sube y se manda con el texto que la persona quiso poner (o el de siempre).
        const adjunto = await subirFotoAlChat({ channelId: canal, localUri: fotoPendiente });
        const enviado = await supportApi.sendMessage(canal, {
          clientMessageId,
          body: cuerpo || 'Te envío una imagen',
          messageType: 'IMAGE',
          attachment: adjunto,
        });
        setMensajes((previos) => mezclarMensajes(previos, [enviado]));
        setFotoPendiente(null);
        setTexto('');
      } else {
        // El campo se vacia YA: si esperara a la respuesta, en una conexion lenta la persona creeria
        // que no se envio y volveria a escribirlo.
        setTexto('');
        const enviado = await supportApi.sendMessage(canal, { clientMessageId, body: cuerpo });
        setMensajes((previos) => mezclarMensajes(previos, [enviado]));
      }
      pendiente.current = null;
      setError(null);
    } catch {
      // Texto y foto se QUEDAN: el próximo intento reusa su identificador y no se pierde nada.
      if (!fotoPendiente) setTexto(cuerpo);
      setError(fotoPendiente ? 'No pudimos enviar la imagen. Inténtalo de nuevo.' : 'No pudimos enviar tu mensaje. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const elegirFoto = async (origen: 'camara' | 'galeria') => {
    const permiso =
      origen === 'camara' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError(origen === 'camara' ? 'Necesitamos permiso para usar la cámara.' : 'Necesitamos permiso para acceder a tus fotos.');
      return;
    }
    const opciones = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.7 };
    const elegida = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (elegida.canceled || !elegida.assets[0]) return;
    // NO se envía: queda como adjunto pendiente.
    setFotoPendiente(elegida.assets[0].uri);
    setError(null);
  };

  const adjuntarFoto = () => {
    Alert.alert('Adjuntar una foto', undefined, [
      { text: 'Tomar foto', onPress: () => void elegirFoto('camara') },
      { text: 'Elegir de la galería', onPress: () => void elegirFoto('galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const hilo = armarHilo(mensajes, ladoDelMensaje);

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
          <CompositorChat
            texto={texto}
            onChangeText={(valor) => {
              setTexto(valor);
              // Avisar «escribiendo…» es efimero y no se guarda: si falla, no se pierde nada.
              if (valor.length === 1) void supportApi.announceTyping(canal).catch(() => undefined);
            }}
            onEnviar={() => void enviar()}
            onAdjuntar={adjuntarFoto}
            adjuntoUri={fotoPendiente}
            onQuitarAdjunto={() => setFotoPendiente(null)}
            enviando={enviando}
            placeholder="Cuéntanos qué pasó…"
          />
          {/* Nadie de Atlas pide el PIN ni los códigos, y quien escribe con prisa no abre una ayuda para enterarse. */}
          <NotaDeSeguridad />
        </View>
      }
    >
      <ScreenHeader
        title="Soporte"
        onBack="auto"
        action={<HeaderAction icon="cerrar" label="Cerrar la conversación" onPress={cerrarConversacion} />}
      />
      <PresenciaDeSoporte estado={error ? 'reconectando' : 'en_linea'} />

      {cargando ? (
        <Card>
          <Skeleton height={40} width="70%" />
          <Skeleton height={40} width="55%" />
        </Card>
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.base, flexGrow: 1, justifyContent: 'flex-end' }}
      >
        {!cargando && mensajes.length === 0 ? (
          <InicioDeChat sugerencias={SUGERENCIAS} onElegir={(frase) => setTexto(frase)} />
        ) : null}
        {hilo.map((entrada) =>
          entrada.tipo === 'dia' ? (
            <SeparadorDeDia key={entrada.clave} dia={entrada.etiqueta} />
          ) : (
            <Mensaje
              key={entrada.clave}
              mensaje={entrada.mensaje}
              lado={entrada.lado}
              primeroDelGrupo={entrada.primeroDelGrupo}
              ultimoDelGrupo={entrada.ultimoDelGrupo}
              leido={fueLeido(entrada.mensaje, readState)}
            />
          ),
        )}
      </ScrollView>

      <Gap size="sm" />
    </Screen>
  );
}

/**
 * Los temas con los que más se escribe a soporte. Tocar uno escribe la primera frase; la persona la
 * completa con su caso. Son frases en su voz, no categorías del sistema.
 */
const SUGERENCIAS = [
  'Tengo una duda sobre mi próxima cuota',
  'Pagué y todavía no se refleja',
  'Quiero saber cómo va mi solicitud',
  'Tuve un problema al comprar en un comercio',
] as const;

function ladoDelMensaje(mensaje: supportApi.SupportMessage): LadoDelMensaje {
  if (mensaje.senderActorType === 'SYSTEM' || mensaje.visibility === 'SYSTEM') return 'sistema';
  return mensaje.senderActorType === 'CUSTOMER' ? 'mio' : 'suyo';
}

/**
 * Un mensaje.
 *
 * El del sistema —la advertencia de no compartir claves— va centrado y sin lado: no es de ninguna
 * de las dos partes, es una regla de la casa. Confundirlo con un mensaje del agente haria pensar
 * que el agente esta a punto de pedir algo.
 */
function Mensaje({
  mensaje,
  lado,
  primeroDelGrupo,
  ultimoDelGrupo,
  leido,
}: {
  mensaje: supportApi.SupportMessage;
  lado: LadoDelMensaje;
  primeroDelGrupo: boolean;
  ultimoDelGrupo: boolean;
  leido: boolean;
}) {
  const t = useCopy();
  if (lado === 'sistema') return <AvisoDelSistema texto={mensaje.body ?? ''} />;
  const mio = lado === 'mio';

  return (
    <BurbujaChat
      mio={mio}
      primeroDelGrupo={primeroDelGrupo}
      ultimoDelGrupo={ultimoDelGrupo}
      hora={horaCorta(mensaje.createdAt)}
      estado={mio ? (leido ? 'leido' : 'enviado') : undefined}
      /*
        La redaccion se EXPLICA. Un texto que aparece tachado sin motivo se lee como un fallo de la
        app; decir que se oculto un codigo enseña, ademas, por que no hay que compartirlo.
      */
      nota={mensaje.redacted ? t.texto('soporte.dato_oculto') : null}
    >
      {mensaje.body ? (
        <AtlasText variant="body" style={mio ? { color: color.text.onBrand } : undefined}>
          {mensaje.body}
        </AtlasText>
      ) : null}
      {mensaje.attachments.map((adjunto) =>
        adjunto.mime?.startsWith('image/') ? (
          <AdjuntoImagen key={adjunto.attachmentId} adjunto={adjunto} />
        ) : (
          <Badge key={adjunto.attachmentId} label={`📎 ${adjunto.filename}`} tone="info" />
        ),
      )}
    </BurbujaChat>
  );
}
