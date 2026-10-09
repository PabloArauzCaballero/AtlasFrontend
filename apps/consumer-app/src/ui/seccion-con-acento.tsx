/**
 * Una sección de lectura con su barra de marca a la izquierda: título y párrafos.
 *
 * Es la pieza de la política de mora, sacada aquí para que las demás explicaciones se lean igual (Pablo, 2026-10-08:
 * «Cómo crece tu crédito» tenía que verse como la política, no como párrafos separados por rayas).
 */
import { StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { AtlasText } from './primitives';

export function SeccionConAcento({ titulo, parrafos, testID }: { titulo?: string; parrafos: readonly string[]; testID?: string }) {
  return (
    <View style={styles.seccion} testID={testID}>
      <View style={styles.acento} />
      <View style={styles.cuerpo}>
        {titulo ? <AtlasText variant="h3">{titulo}</AtlasText> : null}
        {parrafos.map((parrafo, i) => (
          <AtlasText key={i} variant="body" tone="secondary" style={styles.parrafo}>
            {parrafo}
          </AtlasText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seccion: {
    flexDirection: 'row',
    gap: space.base,
    padding: space.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    backgroundColor: color.surface.raised,
  },
  acento: { width: 3, borderRadius: 2, backgroundColor: color.action.primary },
  cuerpo: { flex: 1, gap: space.sm },
  parrafo: { lineHeight: 22 },
});
