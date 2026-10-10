/**
 * La hoja del asistente del comercio: el chat de ayuda que contesta al momento.
 *
 * El comportamiento es el del panel del portal web (`AtlasERPFrontend/components/atlas/AtlasAssist.tsx`,
 * superficie `merchant-portal`): contesta CÓMO usar el portal —dónde está una pantalla, qué significa
 * un estado, qué pasos seguir—, guarda la conversación, tiene «Nueva conversación» e «Historial», y
 * cuando la respuesta lo amerita ofrece hablar con soporte. El aspecto es el de `AssistSheet` de la
 * app del cliente (`apps/consumer-app/src/ui/assist-sheet.tsx`), con sus mismas primitivas.
 *
 * No se usa `AssistSheet` tal cual porque su texto es del cliente final (QR, cuotas, PIN, «no ve tus
 * saldos») y sus preguntas sugeridas también, y porque arrastra en tiempo de ejecución el cliente de
 * API de la otra app. El estado viene de `useAsistente`, que tiene la misma forma que `useAssist`.
 *
 * ## Sin SSE, a propósito
 *
 * La respuesta llega entera en el JSON, con un «está escribiendo…» mientras tanto: React Native no
 * trae EventSource y la pasarela del ERP tampoco transmite por partes.
 */
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { color, marca, radius, space, stroke, touch } from '@cliente/theme/tokens';
import { Field } from '@cliente/ui/fields';
import { BottomSheet } from '@cliente/ui/help-sheet';
import { Icon, type IconName } from '@cliente/ui/icons';
import { PressSurface } from '@cliente/ui/motion';
import { AtlasText, Button } from '@cliente/ui/primitives';
import { AVISO_DATOS, MAX_PREGUNTA, PREGUNTAS_FRECUENTES, RUTA_DE_SOPORTE, pantallaDelAsistente } from '@/features/asistente/asistente';
import type { Asistente, BurbujaAsistente } from '@/features/asistente/use-asistente';
import { HistorialDelAsistente } from './historial';

export function HojaDelAsistente({
  visible,
  onClose,
  asistente,
}: {
  visible: boolean;
  onClose: () => void;
  /** El hilo, que vive en el botón flotante: así sobrevive a cerrar y reabrir la hoja. */
  asistente: Asistente;
}) {
  const pathname = usePathname();
  // Desde qué sección se abrió («Gestión POS»): el asistente lo usa para que «aquí» signifique algo.
  const pantalla = pantallaDelAsistente(pathname);
  const [texto, setTexto] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [vista, setVista] = useState<'chat' | 'historial'>('chat');
  const { burbujas, estado, enviar, reintentar } = asistente;

  // Al cerrar la hoja se vuelve al chat: reabrirla no debe dejar a la persona en una lista.
  useEffect(() => {
    if (!visible) setVista('chat');
  }, [visible]);

  const abrirHistorial = () => {
    setVista('historial');
    void asistente.cargarHistorial();
  };
  const abrirConversacion = async (id: string) => {
    if (await asistente.abrirConversacion(id)) setVista('chat');
  };
  const enviando = estado.fase === 'enviando';
  const abriendo = estado.fase === 'cargando';
  const razonNueva =
    enviando || abriendo
      ? 'Espera a que el asistente responda para empezar otra conversación.'
      : burbujas.length === 0
        ? 'Ya estás en una conversación nueva.'
        : null;

  // Lo escrito y aún no enviado vive aquí: cerrar la hoja con un error a medias no lo borra.
  const mandar = (pregunta: string) => {
    enviar(pregunta, pantalla);
    setTexto('');
    // Con el teclado arriba la hoja se queda en una franja y la respuesta que llega no se ve.
    Keyboard.dismiss();
  };

  const irASoporte = () => {
    onClose();
    router.push(RUTA_DE_SOPORTE);
  };

  // Con cada mensaje nuevo, la conversación baja sola a lo último, como cualquier chat.
  useEffect(() => {
    if (visible) scrollRef.current?.scrollToEnd({ animated: true });
  }, [visible, burbujas.length, estado.fase]);

  const vacia = burbujas.length === 0 && !abriendo;

  return (
    <BottomSheet visible={visible} titulo={`Asistente de ${marca.nombre}`} onClose={onClose} cierre="Cerrar" evitarTeclado altura="alta">
      <View style={styles.cuerpo}>
        {vista === 'historial' ? (
          <HistorialDelAsistente
            historial={asistente.historial}
            actualId={asistente.actualId}
            aviso={asistente.avisoHistorial}
            onReintentar={() => void asistente.cargarHistorial()}
            onAbrir={(id) => void abrirConversacion(id)}
            onBorrar={(id) => void asistente.borrarConversacion(id)}
            onVolver={() => setVista('chat')}
          />
        ) : (
          <>
            <View style={styles.acciones}>
              <Accion
                icono="editar"
                etiqueta="Nueva conversación"
                razon={razonNueva}
                onPress={() => asistente.nuevaConversacion()}
                testID="asistente-nueva"
              />
              <Accion icono="reloj" etiqueta="Historial" razon={null} onPress={abrirHistorial} testID="asistente-historial" />
            </View>
            {razonNueva ? (
              <AtlasText variant="caption" tone="tertiary" style={styles.razon} testID="asistente-nueva-razon">
                {razonNueva}
              </AtlasText>
            ) : null}
            {asistente.avisoHistorial ? (
              <AtlasText variant="caption" tone="danger" style={styles.razon}>
                {asistente.avisoHistorial}
              </AtlasText>
            ) : null}
            <ScrollView
              ref={scrollRef}
              style={styles.lista}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              contentContainerStyle={styles.listaContenido}
            >
              {abriendo ? (
                <AtlasText variant="caption" tone="tertiary">
                  Cargando la conversación…
                </AtlasText>
              ) : null}

              {vacia ? (
                <View style={styles.vacio}>
                  <AtlasText variant="body" tone="secondary">
                    Pregúntame cómo hacer algo en la app: dónde está una pantalla, qué significa un estado o qué pasos seguir.
                  </AtlasText>
                  <View style={styles.chips}>
                    {PREGUNTAS_FRECUENTES.map((pregunta, n) => (
                      <PressSurface
                        key={pregunta}
                        onPress={() => mandar(pregunta)}
                        accessibilityRole="button"
                        accessibilityLabel={`Preguntar: ${pregunta}`}
                        style={styles.chip}
                        testID={`asistente-chip-${n}`}
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
                <Burbuja key={burbuja.id} burbuja={burbuja} onHablarConSoporte={irASoporte} />
              ))}

              {enviando ? (
                <View style={styles.escribiendo}>
                  <Icon name="asistente" size={16} tint={color.text.tertiary} />
                  <AtlasText variant="caption" tone="tertiary">
                    El asistente está escribiendo…
                  </AtlasText>
                </View>
              ) : null}

              {estado.fase === 'error' ? (
                <View style={styles.error}>
                  <AtlasText variant="caption" tone="danger" testID="asistente-error">
                    {estado.mensaje}
                  </AtlasText>
                  <Button
                    label="Reintentar"
                    icon="refrescar"
                    variant="secondary"
                    onPress={() => reintentar(pantalla)}
                    testID="asistente-reintentar"
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.pie}>
              <Field
                label="Tu pregunta"
                value={texto}
                onChangeText={(valor) => setTexto(valor.slice(0, MAX_PREGUNTA))}
                maxLength={MAX_PREGUNTA}
                placeholder="Escribe aquí…"
                hint={AVISO_DATOS}
                multiline
                testID="asistente-entrada"
              />
              <Button
                label="Enviar"
                icon="enviar"
                onPress={() => mandar(texto)}
                loading={enviando}
                disabled={texto.trim().length === 0}
                blockedReason={texto.trim().length === 0 ? 'Escribe una pregunta para enviarla.' : null}
                testID="asistente-enviar"
              />
              {/* Hablar con una persona, SIEMPRE visible: el asistente es un atajo, nunca un peaje. */}
              <Button label="Hablar con soporte" icon="chat" variant="ghost" onPress={irASoporte} testID="asistente-humano" />
              <AtlasText variant="micro" tone="tertiary" style={styles.aviso}>
                El asistente puede equivocarse. No ve tus ventas, tu cartera ni tus datos.
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
      style={[styles.accion, apagada && styles.accionApagada]}
      testID={testID}
    >
      <Icon name={icono} size={18} tint={apagada ? color.text.tertiary : color.action.primary} />
      <AtlasText variant="bodyStrong" tone={apagada ? 'tertiary' : 'brand'}>
        {etiqueta}
      </AtlasText>
    </PressSurface>
  );
}

/**
 * Un turno del chat. El del asistente lleva, cuando amerita, el atajo al soporte DENTRO de la burbuja,
 * y avisa cuando el texto salió de la guía sin IA (como la web).
 */
function Burbuja({ burbuja, onHablarConSoporte }: { burbuja: BurbujaAsistente; onHablarConSoporte: () => void }) {
  const mia = burbuja.rol === 'persona';
  return (
    <View style={{ alignItems: mia ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.burbuja, mia ? styles.burbujaMia : styles.burbujaAsistente]}>
        <AtlasText variant="body">{burbuja.texto}</AtlasText>
        {burbuja.sinIa ? (
          <AtlasText variant="micro" tone="tertiary">
            Respuesta sin IA: texto de la guía.
          </AtlasText>
        ) : null}
        {burbuja.sugiereHumano ? (
          <PressSurface
            onPress={onHablarConSoporte}
            accessibilityRole="button"
            accessibilityLabel="Hablar con soporte"
            style={styles.atajoHumano}
          >
            <AtlasText variant="captionStrong" tone="brand">
              Hablar con soporte
            </AtlasText>
          </PressSurface>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flex: 1 },
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
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
  listaContenido: {
    padding: space.lg,
    gap: space.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
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
  burbuja: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    padding: space.sm,
    gap: space.xs,
  },
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
