/**
 * El `InlineNotice` del portal web, con las piezas de la app del cliente: una tarjeta con tono y su
 * texto. Lo usan los errores de formulario y los avisos de estado (en revisión, rechazado, bloqueado).
 */
import { View, StyleSheet } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { AtlasText, Card, type CardTone } from '@cliente/ui/primitives';

export type TonoAviso = 'info' | 'success' | 'warning' | 'danger';

const TONO_TARJETA: Record<TonoAviso, CardTone> = {
  info: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function Aviso({ tono = 'info', titulo, children, testID }: { tono?: TonoAviso; titulo?: string; children?: React.ReactNode; testID?: string }) {
  return (
    <Card tone={TONO_TARJETA[tono]} padding="tight" testID={testID} accessibilityRole={tono === 'danger' ? 'alert' : undefined}>
      <View style={styles.cuerpo}>
        {titulo ? <AtlasText variant="title">{titulo}</AtlasText> : null}
        {typeof children === 'string' ? (
          <AtlasText variant="body" tone="secondary">
            {children}
          </AtlasText>
        ) : (
          children
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: space.xs },
});
