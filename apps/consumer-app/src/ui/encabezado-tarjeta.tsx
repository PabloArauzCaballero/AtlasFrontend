/**
 * La cabecera sobria de una tarjeta de cifra: la ficha del icono y UNA línea en versalitas que dice qué es el número.
 *
 * `CardHeader` lleva antetítulo y título, que es lo correcto cuando la tarjeta tiene nombre propio. Aquí el
 * protagonista es la cifra de debajo: con un título encima, «Crédito habilitado» y «Bs 260,00» competían por ser lo
 * primero que se lee (Pablo, 2026-10-12).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme/tokens';
import type { IconName } from './icons';
import { IconChip, Overline } from './primitives';

export function EncabezadoTarjeta({ icono, etiqueta, derecha }: { icono: IconName; etiqueta: string; derecha?: ReactNode }) {
  return (
    <View style={styles.fila}>
      <IconChip name={icono} />
      <Overline style={styles.etiqueta} numberOfLines={2} accessibilityRole="header">
        {etiqueta}
      </Overline>
      {derecha ? <View style={styles.derecha}>{derecha}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  etiqueta: { flex: 1 },
  derecha: { flexShrink: 0 },
});
