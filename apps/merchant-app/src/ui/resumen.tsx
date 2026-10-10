/**
 * El `Resumen` del portal web: UNA tira de etiqueta + número, sin icono ni sombra (Pablo,
 * 2026-09-18: «lo más simple posible»). Con las piezas de la app del cliente: una tarjeta con las
 * cifras en rejilla de dos columnas, que en un teléfono es lo que cabe sin cortar los montos.
 */
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { AtlasText, Card } from '@cliente/ui/primitives';

export interface DatoDeResumen {
  label: string;
  value: string | number;
  /** Se pinta en tono de aviso (vencido, pendiente). */
  alerta?: boolean;
  nota?: string;
}

export function Resumen({ datos, testID }: { datos: DatoDeResumen[]; testID?: string }) {
  if (!datos.length) return null;
  return (
    <Card padding="tight" testID={testID ?? 'resumen'}>
      <View style={styles.rejilla}>
        {datos.map((dato) => (
          <View key={dato.label} style={styles.celda} accessible accessibilityLabel={`${dato.label}: ${dato.value}`}>
            <AtlasText variant="micro" tone="tertiary" numberOfLines={1}>
              {dato.label.toUpperCase()}
            </AtlasText>
            <AtlasText variant="h3" tone={dato.alerta ? 'warning' : 'primary'} numberOfLines={1} adjustsFontSizeToFit>
              {String(dato.value)}
            </AtlasText>
            {dato.nota ? (
              <AtlasText variant="micro" tone="tertiary">
                {dato.nota}
              </AtlasText>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  celda: { width: '50%', paddingRight: space.sm, gap: 2 },
});
