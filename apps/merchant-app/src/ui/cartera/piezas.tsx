/**
 * Piezas pequeñas que comparten «Mi cartera» y «Consumo y facturación», hechas con las primitivas de
 * la app del cliente.
 *
 * La web pinta tablas (`<table>` con seis columnas y `min-w-[560px]`) que en un teléfono obligan a
 * desplazar de lado. Aquí cada fila de la tabla es una TARJETA o una fila de lista con las mismas
 * columnas como pares etiqueta–valor: se pierde la alineación en columnas y se gana poder leer una
 * cuota entera sin mover el dedo.
 */
import { StyleSheet, View } from 'react-native';
import { color, space } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { AtlasText, Badge, Cargando, type BadgeTone } from '@cliente/ui/primitives';
import { nombreDeCaja, type Origen } from '@/features/cartera/estados';

/** El «Cargando…» y el «no hay nada» de los paneles de la web: una línea centrada y discreta. */
export function TextoDePanel({ cargando, vacio, testID }: { cargando: boolean; vacio: string; testID?: string }) {
  if (cargando) return <Cargando texto="Cargando…" />;
  return (
    <AtlasText variant="caption" tone="secondary" align="center" style={styles.vacio} testID={testID}>
      {vacio}
    </AtlasText>
  );
}

/** El `StatusPill` de la web. */
export function Pastilla({ texto, tono = 'neutral' }: { texto: string; tono?: BadgeTone }) {
  return <Badge label={texto} tone={tono} />;
}

/** Una cifra con su etiqueta encima y una nota debajo: las casillas de «Comisión por venta». */
export function Cifra({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: 'warning' }) {
  return (
    <View style={styles.cifra} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <AtlasText variant="micro" tone="tertiary">
        {etiqueta.toUpperCase()}
      </AtlasText>
      <AtlasText variant="h3" tone={tono ?? 'primary'} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </AtlasText>
      {nota ? (
        <AtlasText variant="caption" tone="tertiary">
          {nota}
        </AtlasText>
      ) : null}
    </View>
  );
}

/**
 * Una fila «etiqueta · valor» compacta, para las columnas de una tabla web convertida en tarjeta.
 * `fuerte` es la columna que la web pinta en negrita (lo que falta, el total).
 */
export function Dato({ etiqueta, valor, fuerte = false, apagado = false }: { etiqueta: string; valor: string; fuerte?: boolean; apagado?: boolean }) {
  return (
    <View style={styles.dato}>
      <AtlasText variant="caption" tone="secondary">
        {etiqueta}
      </AtlasText>
      <AtlasText variant={fuerte ? 'captionStrong' : 'caption'} tone={apagado ? 'tertiary' : 'primary'} align="right" style={styles.datoValor}>
        {valor}
      </AtlasText>
    </View>
  );
}

/** `OrigenDeCaja` de la web: la sucursal y la caja de la compra, o que no la hubo. */
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
    <View style={styles.origen} testID="origen-de-caja">
      <Icon name="comercio" size={14} tint={color.accent.base} />
      <AtlasText variant="captionStrong">{origen.branchName ?? 'Sucursal sin nombre'}</AtlasText>
      {caja ? <Badge label={caja} tone="info" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { paddingVertical: space.lg },
  cifra: { flex: 1, minWidth: '45%', gap: 2 },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 2 },
  datoValor: { flexShrink: 1 },
  origen: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  cursiva: { fontStyle: 'italic' },
});
