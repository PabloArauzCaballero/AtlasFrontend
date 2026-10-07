/**
 * La hoja de Atlas Assist: el chat de ayuda que contesta al momento.
 *
 * ## Qué es y qué no es
 *
 * Contesta CÓMO usar la app —comprar con QR, pagar cuotas, avisos, perfil, PIN— desde un catálogo
 * de hechos verificados. No ve la cuenta de nadie y el pie lo dice siempre, porque un asistente
 * dentro de una app de crédito invita a preguntarle «¿cuánto debo?» y la respuesta honesta es «eso
 * está en tu pantalla de Pagos». El escalado a una persona está SIEMPRE visible: el asistente es
 * un atajo, no una puerta que se cierra.
 *
 * ## Sin SSE, a propósito
 *
 * La respuesta llega entera en el JSON síncrono, con un «está escribiendo…» mientras tanto. Es la
 * misma decisión que el chat de soporte (`features/support-chat.ts`): React Native no trae
 * EventSource y el fetch de Hermes no expone el cuerpo como stream.
 */
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import type { AssistScreen } from '../api/endpoints/assist';
import { PREGUNTAS_FRECUENTES, type BurbujaAssist, type useAssist } from '../features/assist';
import { color, radius, space, stroke, touch } from '../theme/tokens';
import { AssistHistorial } from './assist-historial';
import { Field } from './fields';
import { BottomSheet } from './help-sheet';
import { toqueWeb } from './hit-slop';
import { PressSurface } from './motion';
import { Icon, type IconName } from './icons';
import { AtlasText, Button } from './primitives';
import { webData } from '../web/estilo';

export function AssistSheet({
  visible,
  onClose,
  pantalla,
  assist,
}: {
  visible: boolean;
  onClose: () => void;
  /** Desde qué pantalla se abrió: el asistente lo usa para que «aquí» signifique algo. */
  pantalla: AssistScreen;
  assist: ReturnType<typeof useAssist>;
}) {
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [vista, setVista] = useState<'chat' | 'historial'>('chat');
  const { burbujas, estado, enviar, reintentar } = assist;

  // Al cerrar la hoja se vuelve al chat: reabrirla no debe dejar a la persona en una lista.
  useEffect(() => {
    if (!visible) setVista('chat');
  }, [visible]);

  const abrirHistorial = () => {
    setVista('historial');
    void assist.cargarHistorial();
  };
  const abrirConversacion = async (id: string) => {
    if (await assist.abrirConversacion(id)) setVista('chat');
  };
  const enviando = estado.fase === 'enviando';
  const abriendo = estado.fase === 'cargando';
  const razonNueva =
    enviando || abriendo
      ? 'Espera a que termine la respuesta para empezar otra conversación.'
      : burbujas.length === 0
        ? 'Ya estás en una conversación nueva.'
        : null;

  /*
    El hilo se guarda en el servidor, pero lo ESCRITO y aún no enviado vive solo aquí: si la hoja
    se cierra con un error a medias, al reabrirla el borrador sigue. Perder lo tecleado por cerrar
    una hoja es la clase de detalle que hace desconfiar de todo lo demás.
  */
  const mandar = (pregunta: string) => {
    enviar(pregunta, pantalla);
    setTexto('');
    // Al enviar, el teclado baja: con él arriba la hoja se queda en una franja y la respuesta que
    // llega no se ve. Quien quiera repreguntar vuelve a tocar el campo, como en cualquier chat.
    Keyboard.dismiss();
  };

  // Con cada mensaje nuevo, la conversación baja sola a lo último — como cualquier chat.
  useEffect(() => {
    if (visible) scrollRef.current?.scrollToEnd({ animated: true });
  }, [visible, burbujas.length, estado.fase]);

  const escribiendo = estado.fase === 'enviando';
  const vacia = burbujas.length === 0 && estado.fase !== 'cargando';

  return (
    <BottomSheet visible={visible} titulo="Atlas Assist" onClose={onClose} cierre="Cerrar" evitarTeclado altura="alta">
      <View style={styles.cuerpo} {...webData('asistente-hoja')}>
        {vista === 'historial' ? (
          <AssistHistorial
            historial={assist.historial}
            actualId={assist.actualId}
            aviso={assist.avisoHistorial}
            onReintentar={() => void assist.cargarHistorial()}
            onAbrir={(id) => void abrirConversacion(id)}
            onBorrar={(id) => void assist.borrarConversacion(id)}
            onVolver={() => setVista('chat')}
          />
        ) : (
          <>
            <View style={styles.acciones}>
              <Accion
                icono="editar"
                etiqueta="Nueva conversación"
                razon={razonNueva}
                onPress={() => assist.nuevaConversacion()}
                testID="asistente-nueva"
              />
              <Accion icono="reloj" etiqueta="Historial" razon={null} onPress={abrirHistorial} testID="asistente-historial" />
            </View>
            {razonNueva ? (
              <AtlasText variant="caption" tone="tertiary" style={styles.razon} testID="asistente-nueva-razon">
                {razonNueva}
              </AtlasText>
            ) : null}
            {assist.avisoHistorial ? (
              <AtlasText variant="caption" tone="danger" style={styles.razon}>
                {assist.avisoHistorial}
              </AtlasText>
            ) : null}
            <ScrollView
              ref={scrollRef}
              style={styles.lista}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              contentContainerStyle={styles.listaContenido}
            >
              {vacia ? (
                <View style={styles.vacio}>
                  <AtlasText variant="body" tone="secondary">
                    Te ayudo con Atlas: qué es y cómo funciona, comprar con QR en un comercio, ver y pagar tus cuotas, tus avisos, tu
                    perfil y tu PIN.
                  </AtlasText>
                  <View style={styles.chips}>
                    {PREGUNTAS_FRECUENTES.map((pregunta) => (
                      <PressSurface
                        key={pregunta}
                        onPress={() => mandar(pregunta)}
                        accessibilityRole="button"
                        accessibilityLabel={`Preguntar: ${pregunta}`}
                        style={styles.chip}
                        {...webData('presionable')}
                        testID={`asistente-chip-${PREGUNTAS_FRECUENTES.indexOf(pregunta)}`}
                      >
                        <AtlasText variant="caption" tone="brand">
                          {pregunta}
                        </AtlasText>
                      </PressSurface>
                    ))}
                  </View>
                </View>
              ) : null}

              {burbujas.map((burbuja) => (
                <Burbuja key={burbuja.id} burbuja={burbuja} onHablarConPersona={() => irASoporte(onClose)} />
              ))}

              {escribiendo ? (
                <View style={styles.escribiendo}>
                  <Icon name="asistente" size={16} tint={color.text.tertiary} />
                  <AtlasText variant="caption" tone="tertiary">
                    Atlas Assist está escribiendo…
                  </AtlasText>
                </View>
              ) : null}

              {estado.fase === 'error' ? (
                <View style={styles.error}>
                  <AtlasText variant="caption" tone="danger">
                    {estado.mensaje}
                  </AtlasText>
                  <Button label="Reintentar" icon="refrescar" variant="secondary" onPress={() => reintentar(pantalla)} />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.pie}>
              <Field
                label="Tu pregunta"
                value={texto}
                onChangeText={setTexto}
                placeholder="Escribe aquí…"
                multiline
                testID="asistente-entrada"
              />
              <Button
                label="Enviar" icon="enviar"
                onPress={() => mandar(texto)}
                loading={escribiendo}
                disabled={texto.trim().length === 0}
                blockedReason={texto.trim().length === 0 ? 'Escribe una pregunta para enviarla.' : null}
                testID="asistente-enviar"
              />
              {/*
                El escalado SIEMPRE visible, no solo cuando el asistente lo sugiere: el asistente es un
                atajo hacia la respuesta, nunca un peaje delante de las personas.
              */}
              <Button label="Hablar con una persona" icon="telefono" variant="ghost" onPress={() => irASoporte(onClose)} testID="asistente-humano" />
              <AtlasText variant="micro" tone="tertiary" style={styles.aviso}>
                Atlas Assist puede equivocarse. No ve tus saldos ni tus movimientos.
              </AtlasText>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

/** Una acción de la barra de arriba del hilo. Apagada, sigue visible y dice por qué (debajo). */
function Accion({
  icono,
  etiqueta,
  razon,
  onPress,
  testID,
}: {
  icono: IconName;
  etiqueta: string;
  razon: string | null;
  onPress: () => void;
  testID: string;
}) {
  const apagada = razon !== null;
  return (
    <PressSurface
      onPress={apagada ? undefined : onPress}
      disabled={apagada}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityHint={razon ?? undefined}
      accessibilityState={{ disabled: apagada }}
      hitSlop={4}
      {...toqueWeb(4)}
      style={[styles.accion, apagada && styles.accionApagada]}
      {...webData('presionable')}
      testID={testID}
    >
      <Icon name={icono} size={18} tint={apagada ? color.text.tertiary : color.action.primary} />
      <AtlasText variant="bodyStrong" tone={apagada ? 'tertiary' : 'brand'}>
        {etiqueta}
      </AtlasText>
    </PressSurface>
  );
}

function irASoporte(onClose: () => void) {
  onClose();
  router.push('/soporte');
}

/**
 * Un turno del chat. El del asistente lleva, cuando amerita, el atajo al chat humano DENTRO de la
 * burbuja: es la respuesta «esto es mejor con una persona» convertida en el gesto que la ejecuta.
 */
function Burbuja({ burbuja, onHablarConPersona }: { burbuja: BurbujaAssist; onHablarConPersona: () => void }) {
  const mia = burbuja.rol === 'persona';
  return (
    <View style={{ alignItems: mia ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.burbuja, mia ? styles.burbujaMia : styles.burbujaAsistente]}>
        <AtlasText variant="body">{burbuja.texto}</AtlasText>
        {burbuja.sugiereHumano ? (
          <PressSurface
            onPress={onHablarConPersona}
            accessibilityRole="button"
            accessibilityLabel="Hablar con una persona"
            style={styles.atajoHumano}
            {...webData('presionable')}
          >
            <AtlasText variant="captionStrong" tone="brand">
              Hablar con una persona
            </AtlasText>
          </PressSurface>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flex: 1 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  accion: {
    minHeight: touch.minSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
  },
  accionApagada: { borderColor: color.border.hairline },
  razon: { paddingHorizontal: space.lg },
  lista: { flex: 1 },
  listaContenido: { padding: space.lg, gap: space.sm, flexGrow: 1, justifyContent: 'flex-end' },
  vacio: { gap: space.md, paddingBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: stroke.hairline,
    borderColor: color.feedbackBorder.brand,
    backgroundColor: color.feedbackSoft.success,
  },
  burbuja: { maxWidth: '85%', borderRadius: radius.lg, padding: space.sm, gap: space.xs },
  burbujaMia: { backgroundColor: color.surface.raisedStrong },
  burbujaAsistente: { backgroundColor: color.surface.raised },
  atajoHumano: { paddingVertical: space.xs, alignSelf: 'flex-start' },
  escribiendo: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  error: { gap: space.sm },
  pie: {
    padding: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: stroke.hairline,
    borderTopColor: color.border.hairline,
  },
  aviso: { textAlign: 'center' },
});
