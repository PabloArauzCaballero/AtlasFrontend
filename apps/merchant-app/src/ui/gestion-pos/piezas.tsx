/**
 * Piezas pequeñas que repiten las tarjetas de Gestión POS, hechas con lo de la app del cliente.
 *
 *  - `OrigenDeCaja`: la sucursal y la caja de la compra (`components/atlas/OrigenDeCaja.tsx` en la web).
 *  - `ImporteDeclarado`: el bloque «IMPORTE / Bs 1.500 / 6 meses · BOB» que la web pone a la derecha
 *    de cada tarjeta. En un teléfono no hay «a la derecha» con sitio para una cifra de 24 px junto al
 *    código y la caja, así que va DEBAJO de la cabecera, a todo el ancho.
 *  - `LineaDeReferencia`: «Referencia del banco: XYZ» con la referencia en negrita.
 */
import { StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Badge, Overline } from '@cliente/ui/primitives';
import { nombreDeCaja, type Origen } from '@/features/gestion-pos/origen-de-caja';

export function OrigenDeCaja({ origen }: { origen: Origen }) {
  const caja = nombreDeCaja(origen);
  if (!origen.branchName && !caja) {
    return (
      <AtlasText variant="caption" tone="tertiary" style={styles.cursiva}>
        Sin caja registrada en la compra
      </AtlasText>
    );
  }
  return (
    <View style={styles.origen} testID="origen-de-caja" accessible accessibilityLabel={[origen.branchName ?? 'Sucursal sin nombre', caja].filter(Boolean).join(', ')}>
      <Icon name="comercio" size={14} tint={color.accent.base} />
      <AtlasText variant="captionStrong">{origen.branchName ?? 'Sucursal sin nombre'}</AtlasText>
      {caja ? <Badge label={caja} tone="info" /> : null}
    </View>
  );
}

export function ImporteDeclarado({ etiqueta, importe, nota }: { etiqueta: string; importe: string; nota: string }) {
  return (
    <View style={styles.importe} accessible accessibilityLabel={`${etiqueta}: ${importe}. ${nota}`}>
      <Overline>{etiqueta}</Overline>
      <AtlasText variant="amount" numberOfLines={1} adjustsFontSizeToFit>
        {importe}
      </AtlasText>
      <AtlasText variant="caption" tone="secondary">
        {nota}
      </AtlasText>
    </View>
  );
}

export function LineaDeReferencia({ referencia }: { referencia: string | null }) {
  return (
    <AtlasText variant="caption" tone="secondary">
      Referencia del banco:{' '}
      <AtlasText variant="captionStrong">{referencia ?? 'sin referencia'}</AtlasText>
    </AtlasText>
  );
}

const styles = StyleSheet.create({
  origen: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  cursiva: { fontStyle: 'italic' },
  importe: { gap: 2 },
});
