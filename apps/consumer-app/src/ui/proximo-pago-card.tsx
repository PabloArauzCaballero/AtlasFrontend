/**
 * El próximo pago, en una fila (Pablo, 2026-10-12): qué se debe y cuándo vence, y nada más.
 *
 * Antes era una tarjeta entera —título, pastilla de estado, importe grande, comercio y un botón «Ver cómo pagar»—
 * que pesaba casi lo mismo que la del crédito. Ahora TODA la fila es el botón: tocarla lleva a cómo pagar, que es
 * donde está el comercio y su QR. Vencida, la ficha y la etiqueta pasan a rojo; el importe no, porque es el dato.
 */
import { StyleSheet, View } from 'react-native';
import { color, space } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText, Card, IconChip, Overline } from './primitives';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «21 de oct» a partir de `2026-10-21`. A mano y no con `new Date(iso)`: una fecha sin hora se lee como medianoche
 * UTC, y en Bolivia (UTC−4) eso es el día ANTERIOR. Lo que no tenga esa forma se devuelve tal cual.
 */
export function fechaDeVencimiento(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const mes = partes ? MESES[Number(partes[2]) - 1] : undefined;
  return partes && mes ? `${Number(partes[3])} de ${mes}` : iso;
}

export function ProximoPagoCard({
  importe,
  cuando,
  vencido = false,
  onPress,
}: {
  importe: string;
  /** En minúscula y sin punto: va detrás del importe («vence el 21 de oct»). */
  cuando: string;
  vencido?: boolean;
  onPress: () => void;
}) {
  const etiqueta = vencido ? 'Pago vencido' : 'Próximo pago';
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}: ${importe}, ${cuando}. Toca para ver cómo pagar.`}
      testID="proximo-pago-card"
    >
      <Card padding="tight">
        <View style={styles.fila}>
          <IconChip name="pagos" tone={vencido ? 'danger' : 'neutral'} />
          <View style={styles.texto}>
            <Overline tone={vencido ? 'danger' : 'secondary'}>{etiqueta}</Overline>
            <AtlasText variant="body" tone="secondary" numberOfLines={2}>
              <AtlasText variant="amountMicro">{importe}</AtlasText>
              {` · ${cuando}`}
            </AtlasText>
          </View>
          <Icon name="adelante" size={18} tint={color.text.tertiary} />
        </View>
      </Card>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  texto: { flex: 1, gap: space.xxs },
});
