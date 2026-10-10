/**
 * Los botones flotantes de abajo a la derecha: Mi empresa, Soporte y el asistente.
 *
 * Pablo (2026-10-10): la barra de abajo lleva sólo Gestión POS y Cartera, y lo demás va «como en la
 * app del consumidor final», flotando a la derecha. Es también lo que hace el portal web: Mi empresa
 * cuelga del avatar y Soporte y el asistente son botones flotantes.
 *
 * El dibujo es el del `AssistFab` de la app del cliente: círculo, sombra de marca, por encima de la
 * barra de pestañas y del área segura. El asistente es el principal (relleno de marca, abajo, más
 * grande); Mi empresa y Soporte van encima, más chicos y en superficie, para que no compitan con él.
 * Se esconden con el teclado abierto, como el de la app del cliente.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, shadow, space } from '@cliente/theme/tokens';
import { Icon, type IconName } from '@cliente/ui/icons';
import { PressSurface } from '@cliente/ui/motion';
import { AtlasText } from '@cliente/ui/primitives';
import { HojaDelAsistente } from './asistente/hoja';

/** El alto de la barra de pestañas sin el área segura (`BAR_HEIGHT` de `app/(app)/(tabs)/_layout.tsx`). */
const ALTO_BARRA = 72;
const PRINCIPAL = 56;
const SECUNDARIO = 46;

function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setVisible(true));
    const b = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const c = Keyboard.addListener('keyboardWillHide', () => setVisible(false));
    const d = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => [a, b, c, d].forEach((s) => s.remove());
  }, []);
  return visible;
}

function Secundario({ icono, etiqueta, onPress, testID }: { icono: IconName; etiqueta: string; onPress: () => void; testID: string }) {
  return (
    <View style={styles.fila}>
      <View style={styles.rotulo} pointerEvents="none">
        <AtlasText variant="micro" tone="secondary">
          {etiqueta}
        </AtlasText>
      </View>
      <PressSurface onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} style={styles.secundario} testID={testID}>
        <Icon name={icono} size={21} tint={color.text.primary} />
      </PressSurface>
    </View>
  );
}

export function BotonesFlotantes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const teclado = useTecladoVisible();
  const [asistente, setAsistente] = useState(false);

  return (
    <>
      {teclado ? null : (
        <View style={[styles.pila, { bottom: ALTO_BARRA + insets.bottom + space.sm }]} pointerEvents="box-none">
          <Secundario icono="comercio" etiqueta="Mi empresa" onPress={() => router.push('/empresa')} testID="flotante-empresa" />
          <Secundario icono="chat" etiqueta="Soporte" onPress={() => router.push('/soporte')} testID="flotante-soporte" />
          <PressSurface
            onPress={() => setAsistente(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir asistente de ayuda"
            accessibilityHint="Abre un chat que contesta dudas sobre cómo usar la app"
            style={styles.principal}
            testID="asistente-fab"
          >
            <Icon name="asistente" size={26} tint={color.text.onBrand} />
          </PressSurface>
        </View>
      )}
      <HojaDelAsistente visible={asistente} onClose={() => setAsistente(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  pila: { position: 'absolute', right: space.md, alignItems: 'flex-end', gap: space.sm, zIndex: 40 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  rotulo: {
    backgroundColor: color.surface.raised,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: 999,
    ...shadow.card,
  },
  secundario: {
    width: SECUNDARIO,
    height: SECUNDARIO,
    borderRadius: SECUNDARIO / 2,
    backgroundColor: color.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    elevation: 5,
  },
  principal: {
    width: PRINCIPAL,
    height: PRINCIPAL,
    borderRadius: PRINCIPAL / 2,
    backgroundColor: color.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.brandGlow,
    elevation: 6,
  },
});
