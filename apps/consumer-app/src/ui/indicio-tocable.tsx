/**
 * El pie que dice «esto se toca»: la acción en el color de marca y un chevron, al final de una tarjeta tocable.
 *
 * Pablo (2026-10-15): «la tarjeta tocable que se vea que es cliqueable; al usuario le costaría darse cuenta». Una
 * tarjeta que se hunde al tocarla sólo enseña que es tocable DESPUÉS de tocarla. El indicio lo dice antes, con las
 * dos señales que iOS usa en sus listas: un verbo en el color de acción y el chevron hacia la derecha.
 *
 * No es un botón aparte: va DENTRO de la tarjeta pulsable y no recibe el toque (toda la tarjeta lo recibe), así que
 * el lector de pantalla no lo anuncia dos veces.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { color, space, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText } from './primitives';

export function IndicioTocable({ texto, separador = true, style, testID }: { texto: string; separador?: boolean; style?: ViewStyle; testID?: string }) {
  return (
    <View
      style={[styles.pie, separador && styles.conFilo, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
    >
      <AtlasText variant="bodyStrong" style={styles.texto}>
        {texto}
      </AtlasText>
      <Icon name="adelante" size={18} tint={color.accent.strong} />
    </View>
  );
}

const styles = StyleSheet.create({
  pie: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.sm },
  conFilo: { borderTopWidth: stroke.hairline, borderTopColor: color.border.subtle, marginTop: space.xs },
  texto: { flex: 1, color: color.accent.strong },
});
