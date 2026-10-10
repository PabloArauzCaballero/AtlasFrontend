/**
 * Lo que va a la derecha del título de cada pantalla: el PDF (sólo ícono) y el avatar de la cuenta.
 * Un solo sitio para que todas las cabeceras queden alineadas igual.
 */
import { StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import type { DocumentoPdf } from '@/features/pdf';
import { BotonCuenta } from './boton-cuenta';
import { BotonPdf } from './boton-pdf';

export function AccionesDeCabecera({ pdf, cuenta = true }: { pdf?: () => DocumentoPdf; cuenta?: boolean }) {
  return (
    <View style={styles.fila}>
      {pdf ? <BotonPdf documento={pdf} compacto /> : null}
      {cuenta ? <BotonCuenta /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
