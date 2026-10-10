/**
 * La conversación con soporte del comercio, en vivo.
 *
 * En la web es el panel «Conversación» de la pestaña Soporte (`MerchantSupportScreen`), debajo de la
 * lista de casos. En el teléfono va en su propia pantalla, como el chat de la app del cliente: con el
 * teclado abierto no cabe una conversación DENTRO de una lista desplazable sin que el último mensaje
 * —el que se acaba de escribir— quede tapado. El compositor va fijo al pie (`Screen footer`).
 *
 * Lo que dice y hace es el de la web: «En vivo» / «Reconectando…», «Atlas está escribiendo…», doble
 * tic, «Cerrar conversación». El hilo y su ciclo de vida están en `features/soporte/use-hilo-en-vivo.ts`.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { Gap, HeaderAction, Screen, ScreenHeader } from '@cliente/ui/layout';
import { AtlasText, Card, EmptyState, Skeleton } from '@cliente/ui/primitives';
import { supportService } from '@/api/servicios/supportService';
import { fueLeido, nuevoClientMessageId, TEXTOS } from '@/features/soporte/chat';
import { useHiloEnVivo } from '@/features/soporte/use-hilo-en-vivo';
import { Aviso } from '@/ui/aviso';
import { Burbuja } from '@/ui/soporte/burbuja';
import { Compositor } from '@/ui/soporte/compositor';

export default function Conversacion() {
  const { channelId, aviso } = useLocalSearchParams<{ channelId: string; aviso?: string }>();
  const canal = String(channelId ?? '');
  const router = useRouter();
  const hilo = useHiloEnVivo(canal);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  /**
   * El mensaje que se intenta enviar y su identificador. Si falla y se reintenta el MISMO texto, se
   * repite el identificador: si el primer intento sí llegó, el backend no lo guarda dos veces. (La web
   * genera uno nuevo en cada intento; en una red de teléfono el «falló pero llegó» es mucho más común.)
   */
  const pendiente = useRef<{ cuerpo: string; clientMessageId: string } | null>(null);

  const salir = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/soporte');
  };

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || !canal || enviando) return;
    if (pendiente.current?.cuerpo !== cuerpo) pendiente.current = { cuerpo, clientMessageId: nuevoClientMessageId() };
    const { clientMessageId } = pendiente.current;
    // El campo se vacía YA: en una conexión lenta, esperar a la respuesta hace creer que no se envió.
    setTexto('');
    setEnviando(true);
    try {
      const enviado = await supportService.enviarMensaje(canal, { clientMessageId, body: cuerpo });
      hilo.agregar(enviado);
      pendiente.current = null;
      hilo.setError(null);
    } catch {
      setTexto(cuerpo);
      hilo.setError(TEXTOS.noEnvio);
    } finally {
      setEnviando(false);
    }
  };

  /**
   * Cerrar desde este lado. En la web es un botón de texto; aquí es la equis de la cabecera, que en
   * un teléfono también se lee como «salir de la pantalla». Por eso se confirma: cerrar no se deshace.
   */
  const cerrarConversacion = () => {
    Alert.alert('Cerrar conversación', 'La conversación queda en tu historial de casos. Podrás abrir otra cuando quieras.', [
      { text: 'Seguir hablando', style: 'cancel' },
      {
        text: 'Cerrar conversación',
        style: 'destructive',
        onPress: async () => {
          try {
            await supportService.cerrarConversacion(canal);
            salir();
          } catch {
            hilo.setError(TEXTOS.noCerro);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      scroll={false}
      // Sin la entrada escalonada: envuelve cada hijo en un contenedor sin flex y la lista (flex: 1)
      // se resolvería a altura cero. Lo mismo que hace el chat de la app del cliente.
      animate={false}
      footer={
        <View style={styles.pie}>
          {hilo.error ? (
            <AtlasText variant="caption" tone="danger">
              {hilo.error}
            </AtlasText>
          ) : null}
          <Compositor
            texto={texto}
            onChangeText={(valor) => {
              setTexto(valor);
              // «Escribiendo…» es efímero: si falla, no se pierde nada.
              if (valor.length === 1 && canal) void supportService.avisarEscribiendo(canal).catch(() => undefined);
            }}
            onEnviar={() => void enviar()}
            enviando={enviando}
            deshabilitado={hilo.cerrado}
          />
        </View>
      }
    >
      <ScreenHeader
        title="Conversación"
        subtitle={hilo.conectado ? 'En vivo' : 'Reconectando…'}
        onBack="auto"
        action={hilo.cerrado ? undefined : <HeaderAction icon="cerrar" label="Cerrar conversación" onPress={cerrarConversacion} />}
      />

      {aviso === 'sin-agentes' ? <Aviso tono="warning">{TEXTOS.sinAgentes}</Aviso> : null}
      {hilo.cerrado ? (
        <Aviso tono="info" titulo="Soporte cerró esta conversación">
          Si necesitas algo más, abre otra desde Soporte.
        </Aviso>
      ) : null}

      {hilo.cargando && hilo.mensajes.length === 0 ? (
        <Card>
          <Skeleton height={40} width="70%" />
          <Skeleton height={40} width="55%" />
        </Card>
      ) : null}

      {!hilo.cargando && hilo.mensajes.length === 0 ? (
        <EmptyState icon="chat" title="Aún no hay mensajes" detail="Escribe abajo y te respondemos por aquí mismo." />
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.lista}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.contenido}
        testID="hilo-de-soporte"
      >
        {hilo.mensajes.map((mensaje) => (
          <Burbuja key={mensaje.messageId} mensaje={mensaje} leido={fueLeido(mensaje, hilo.readState)} />
        ))}
        {hilo.escribiendo ? (
          <AtlasText variant="caption" tone="secondary">
            Atlas está escribiendo…
          </AtlasText>
        ) : null}
      </ScrollView>

      <Gap size="sm" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pie: { gap: space.sm },
  lista: { flex: 1 },
  contenido: { gap: space.sm, paddingBottom: space.base, flexGrow: 1, justifyContent: 'flex-end' },
});
