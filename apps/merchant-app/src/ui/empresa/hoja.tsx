/**
 * Los `Modal` del portal web («Agregar sucursal», «Editar…», «Confirme que es usted») como hoja que
 * sube desde abajo, con la `BottomSheet` de la app del cliente.
 *
 * La hoja de la app del cliente no desplaza su contenido (está pensada para ayudas cortas). Un
 * formulario con el teclado abierto no cabe en media pantalla, así que aquí va dentro de un
 * `ScrollView` y la hoja evita el teclado.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@cliente/theme/tokens';
import { BottomSheet } from '@cliente/ui/help-sheet';
import { AtlasText } from '@cliente/ui/primitives';

export function Hoja({
  visible,
  titulo,
  descripcion,
  onClose,
  cierre = 'Cancelar',
  children,
  testID,
}: {
  visible: boolean;
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  cierre?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <BottomSheet visible={visible} titulo={titulo} onClose={onClose} cierre={cierre} evitarTeclado>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.desplazable} contentContainerStyle={styles.cuerpo} testID={testID}>
        {descripcion ? (
          <AtlasText variant="body" tone="secondary">
            {descripcion}
          </AtlasText>
        ) : null}
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

/** Los dos botones del pie de un formulario («Cancelar» y la acción), uno junto al otro. */
export function PieDeHoja({ children }: { children: React.ReactNode }) {
  return <View style={styles.pie}>{children}</View>;
}

const styles = StyleSheet.create({
  desplazable: { flexShrink: 1 },
  cuerpo: { padding: space.lg, gap: space.base },
  pie: { gap: space.sm, paddingTop: space.sm },
});
