/**
 * La autorizacion que el cliente acepta, con lo que dice a mano.
 *
 * ## Lo que estaba mal
 *
 * La casilla decia el CODIGO del documento y su version —«privacy-policy-dev · Version v1-dev»— y no
 * habia forma de leerlo. Eso no es un consentimiento informado: es una firma en blanco con aspecto
 * de tramite cumplido, y es justo lo que un consentimiento existe para NO ser.
 *
 * ## Lo que hace ahora
 *
 * Ensena el titulo y el resumen que publica el backend, y un enlace que abre el texto completo. El
 * texto no vive aqui: llega con el documento, versionado, y se edita desde el portal interno.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { color, radius, space, touch } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';

export type ConsentRowProps = {
  title: string;
  summary?: string | null;
  bodyMarkdown?: string | null;
  versionCode?: string | null;
  required?: boolean;
  checked: boolean;
  onToggle: (next: boolean) => void;
};

/**
 * Markdown minimo: encabezados `##`, negritas `**` y parrafos.
 *
 * No entra una libreria por dos formas de texto. Pesaria mas que lo que renderiza y traeria su
 * propia tipografia, que es lo que el sistema de diseno existe para evitar.
 */
function renderBody(markdown: string) {
  return markdown.split('\n\n').map((block, index) => {
    const trimmed = block.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.startsWith('## ')) {
      return (
        <AtlasText key={index} variant="h3" style={styles.bodyHeading}>
          {trimmed.slice(3)}
        </AtlasText>
      );
    }
    return (
      <AtlasText key={index} variant="body" tone="secondary" style={styles.bodyParagraph}>
        {trimmed.replace(/\n/g, ' ').replace(/\*\*/g, '')}
      </AtlasText>
    );
  });
}

export function ConsentRow({ title, summary, bodyMarkdown, versionCode, required, checked, onToggle }: ConsentRowProps) {
  const [reading, setReading] = useState(false);
  const readable = Boolean(bodyMarkdown && bodyMarkdown.trim().length > 0);

  return (
    <View style={styles.row}>
      {/*
        La casilla y el texto son DOS objetivos tactiles distintos. Antes tocar el texto marcaba la
        casilla, así que quien iba a leer terminaba aceptando sin querer — el error que más caro sale
        en una pantalla de consentimiento.
      */}
      <PressSurface
        onPress={() => onToggle(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={title}
        hitSlop={8}
        style={styles.boxTarget}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Icon name="check" size={14} tint={color.surface.primary} /> : null}
        </View>
      </PressSurface>

      <View style={styles.text}>
        <AtlasText variant="bodyStrong">
          {title}
          {required ? ' *' : ''}
        </AtlasText>
        {summary ? (
          <AtlasText variant="caption" tone="secondary">
            {summary}
          </AtlasText>
        ) : null}

        <Pressable
          onPress={() => setReading(true)}
          disabled={!readable}
          accessibilityRole="button"
          accessibilityLabel={`Leer ${title}`}
          hitSlop={6}
          style={styles.readTarget}
        >
          <AtlasText variant="caption" style={{ color: readable ? color.action.primary : color.text.tertiary }}>
            {readable ? 'Leer el documento' : 'Documento no disponible'}
          </AtlasText>
          {readable ? <Icon name="adelante" size={12} tint={color.action.primary} /> : null}
        </Pressable>
      </View>

      <Modal visible={reading} animationType="slide" onRequestClose={() => setReading(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitle}>
              <AtlasText variant="h3">{title}</AtlasText>
              {versionCode ? (
                <AtlasText variant="caption" tone="tertiary">
                  Versión {versionCode}
                </AtlasText>
              ) : null}
            </View>
            <Pressable onPress={() => setReading(false)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}>
              <AtlasText variant="bodyStrong" style={{ color: color.action.primary }}>
                Cerrar
              </AtlasText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody}>{renderBody(bodyMarkdown ?? '')}</ScrollView>

          {/*
            Aceptar desde el propio documento. Quien acaba de leerlo está en el momento exacto de
            decidir; obligarle a cerrar y buscar la casilla es perder esa decision por el camino.
          */}
          <View style={styles.sheetFoot}>
            <Pressable
              onPress={() => {
                onToggle(true);
                setReading(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Aceptar ${title}`}
              style={styles.acceptButton}
            >
              <AtlasText variant="bodyStrong" style={{ color: color.surface.primary }}>
                {checked ? 'Ya lo aceptaste' : 'Acepto'}
              </AtlasText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.sm },
  boxTarget: { minHeight: touch.minSize, justifyContent: 'center' },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  text: { flex: 1, gap: space.xxs },
  readTarget: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingVertical: space.xxs },
  sheet: { flex: 1, backgroundColor: color.surface.primary },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.lg,
    paddingTop: space.xxl,
    borderBottomWidth: 1,
    borderBottomColor: color.border.subtle,
  },
  sheetTitle: { flex: 1, gap: space.xxs },
  sheetBody: { padding: space.lg, paddingBottom: space.xxl },
  bodyHeading: { marginTop: space.md },
  bodyParagraph: { marginTop: space.xs },
  sheetFoot: { padding: space.lg, borderTopWidth: 1, borderTopColor: color.border.subtle },
  acceptButton: {
    minHeight: touch.minSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.action.primary,
  },
});
