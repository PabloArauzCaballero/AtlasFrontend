/**
 * El historial de Atlas Assist, dentro de la misma hoja.
 *
 * Es una VISTA de la hoja, no otra pantalla: la persona toca «Historial», elige una conversación y
 * vuelve al chat con ella abierta para seguir preguntando. Cuatro caras —cargando, vacío, error y
 * lista— porque un historial que sólo sabe pintar la lista llena deja mudo al que llega sin nada
 * o sin señal.
 *
 * ## Borrar se confirma en la propia fila
 *
 * `Alert.alert` no hace nada en la web y `window.confirm` está descartado, así que la confirmación
 * es la fila misma: cambia a «¿Borrar esta conversación?» con «Cancelar» y «Borrar». Funciona igual
 * en el teléfono y en el navegador, y no tapa el resto de la lista.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AssistConversationSummary } from '../api/endpoints/assist';
import { fechaRelativa, type EstadoHistorial } from '../features/assist';
import { color, radius, space, stroke, touch } from '../theme/tokens';
import { toqueWeb } from './hit-slop';
import { Icon } from './icons';
import { AtlasText, Badge, Button, Skeleton } from './primitives';
import { webData } from '../web/estilo';

export function AssistHistorial({
  historial,
  actualId,
  aviso,
  onReintentar,
  onAbrir,
  onBorrar,
  onVolver,
}: {
  historial: EstadoHistorial;
  /** La conversación abierta en el chat, para marcarla en la lista. */
  actualId: string | null;
  /** El resultado de la última acción que falló (abrir o borrar). */
  aviso: string | null;
  onReintentar: () => void;
  onAbrir: (id: string) => void;
  onBorrar: (id: string) => void;
  onVolver: () => void;
}) {
  return (
    <View style={styles.cuerpo} {...webData('asistente-historial-vista')}>
      <View style={styles.cabecera}>
        <Pressable
          onPress={onVolver}
          accessibilityRole="button"
          accessibilityLabel="Volver al chat"
          style={styles.volver}
          hitSlop={8}
          {...toqueWeb(8)}
          {...webData('presionable')}
          testID="asistente-historial-volver"
        >
          <Icon name="atras" size={18} tint={color.action.primary} />
          <AtlasText variant="bodyStrong" tone="brand">
            Volver al chat
          </AtlasText>
        </Pressable>
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={styles.listaContenido}>
        {aviso ? (
          <AtlasText variant="caption" tone="danger" testID="asistente-historial-aviso">
            {aviso}
          </AtlasText>
        ) : null}

        {historial.fase === 'cargando' || historial.fase === 'inactivo' ? (
          <View style={styles.cargando} testID="asistente-historial-cargando" accessibilityLabel="Cargando tus conversaciones">
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : null}

        {historial.fase === 'error' ? (
          <View style={styles.estado} testID="asistente-historial-error">
            <AtlasText variant="body" tone="danger">
              {historial.mensaje}
            </AtlasText>
            <Button label="Reintentar" icon="refrescar" variant="secondary" onPress={onReintentar} testID="asistente-historial-reintentar" />
          </View>
        ) : null}

        {historial.fase === 'lista' && historial.items.length === 0 ? (
          <View style={styles.estado} testID="asistente-historial-vacio">
            <AtlasText variant="title">Aún no tienes conversaciones</AtlasText>
            <AtlasText variant="body" tone="secondary">
              Cuando le preguntes algo a Atlas Assist, la conversación quedará guardada aquí para que puedas retomarla.
            </AtlasText>
          </View>
        ) : null}

        {historial.fase === 'lista'
          ? historial.items.map((item, n) => (
              <Fila key={item.conversationId} item={item} n={n} abierta={item.conversationId === actualId} onAbrir={onAbrir} onBorrar={onBorrar} />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function Fila({
  item,
  n,
  abierta,
  onAbrir,
  onBorrar,
}: {
  item: AssistConversationSummary;
  n: number;
  abierta: boolean;
  onAbrir: (id: string) => void;
  onBorrar: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const titulo = item.title.trim() || 'Conversación sin título';
  const preguntas = item.turnCount === 1 ? '1 pregunta' : `${item.turnCount} preguntas`;
  const cuando = fechaRelativa(item.updatedAt);

  if (confirmando) {
    return (
      <View style={[styles.fila, styles.filaConfirmar]} testID={`asistente-historial-confirmacion-${n}`}>
        <AtlasText variant="bodyStrong">¿Borrar esta conversación?</AtlasText>
        <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
          «{titulo}» se elimina y no se puede recuperar.
        </AtlasText>
        <View style={styles.confirmarAcciones}>
          <Button
            label="Cancelar"
            variant="secondary"
            icon="cerrar"
            haptic="none"
            style={styles.confirmarBoton}
            onPress={() => setConfirmando(false)}
            testID={`asistente-historial-cancelar-${n}`}
          />
          <Button
            label="Borrar"
            variant="destructive"
            icon="papelera"
            style={styles.confirmarBoton}
            onPress={() => {
              setConfirmando(false);
              onBorrar(item.conversationId);
            }}
            testID={`asistente-historial-confirmar-${n}`}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fila}>
      <Pressable
        onPress={() => onAbrir(item.conversationId)}
        accessibilityRole="button"
        accessibilityLabel={`Abrir la conversación ${titulo}`}
        accessibilityHint="Vuelve al chat para seguir con esta conversación"
        style={styles.filaTexto}
        {...webData('presionable')}
        testID={`asistente-historial-fila-${n}`}
      >
        <AtlasText variant="bodyStrong" numberOfLines={2}>
          {titulo}
        </AtlasText>
        <View style={styles.meta}>
          <AtlasText variant="caption" tone="secondary">
            {[cuando, preguntas].filter(Boolean).join(' · ')}
          </AtlasText>
          {abierta ? <Badge label="Abierta" tone="info" /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={() => setConfirmando(true)}
        accessibilityRole="button"
        accessibilityLabel={`Borrar la conversación ${titulo}`}
        style={styles.borrar}
        {...webData('presionable')}
        testID={`asistente-historial-borrar-${n}`}
      >
        <AtlasText variant="captionStrong" tone="danger">
          Borrar
        </AtlasText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { flexShrink: 1 },
  cabecera: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
    borderBottomWidth: stroke.hairline,
    borderBottomColor: color.border.hairline,
  },
  volver: { minHeight: touch.minSize, flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  lista: { flex: 1, flexShrink: 1 },
  listaContenido: { padding: space.lg, gap: space.sm },
  cargando: { gap: space.sm },
  estado: { gap: space.md, paddingVertical: space.md },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
    borderWidth: stroke.hairline,
    borderColor: color.border.hairline,
  },
  filaConfirmar: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm, padding: space.md, borderColor: color.feedbackBorder.danger },
  filaTexto: { flex: 1, minHeight: touch.minSize, padding: space.md, gap: space.xxs, justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  borrar: { minHeight: touch.minSize, minWidth: touch.minSize, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
  confirmarAcciones: { flexDirection: 'row', gap: space.sm },
  confirmarBoton: { flex: 1 },
});
