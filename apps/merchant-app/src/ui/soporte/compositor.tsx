/**
 * El campo y el botón de enviar del chat de soporte del comercio.
 *
 * Es el `CompositorChat` de la app del cliente SIN el clip: allí la persona puede mandar una foto,
 * y el chat del comercio en la web no admite adjuntos (sólo «Tu mensaje» y «Enviar»). Un clip que no
 * hace nada, o que hace algo que la web no hace, rompe la primera regla de esta app. El dibujo —campo
 * redondeado, botón circular que se enciende cuando hay texto— es el del cliente, con sus tokens.
 */
import { StyleSheet, TextInput, View } from 'react-native';
import { color, inputChrome, radius, space, stroke, touch } from '@cliente/theme/tokens';
import { Icon } from '@cliente/ui/icons';
import { PressSurface } from '@cliente/ui/motion';
import { Cargando } from '@cliente/ui/primitives';

export function Compositor({
  texto,
  onChangeText,
  onEnviar,
  enviando = false,
  deshabilitado = false,
}: {
  texto: string;
  onChangeText: (valor: string) => void;
  onEnviar: () => void;
  enviando?: boolean;
  deshabilitado?: boolean;
}) {
  const puedeEnviar = texto.trim().length > 0 && !enviando && !deshabilitado;
  return (
    <View style={styles.fila}>
      <TextInput
        value={texto}
        onChangeText={onChangeText}
        placeholder="Escribe aquí…"
        placeholderTextColor={color.text.tertiary}
        multiline
        editable={!deshabilitado}
        keyboardAppearance={inputChrome.keyboardAppearance}
        selectionColor={inputChrome.selectionColor}
        cursorColor={inputChrome.cursorColor}
        accessibilityLabel="Tu mensaje"
        accessibilityHint="Tu respuesta o aclaración para el equipo de soporte."
        style={styles.campo}
        testID="compositor-campo"
      />
      <PressSurface
        onPress={puedeEnviar ? onEnviar : undefined}
        disabled={!puedeEnviar}
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        accessibilityState={{ disabled: !puedeEnviar, busy: enviando }}
        style={[styles.redondo, puedeEnviar ? styles.activo : null]}
        testID="compositor-enviar"
      >
        {enviando ? <Cargando /> : <Icon name="enviar" size={22} tint={puedeEnviar ? color.text.onBrand : color.text.tertiary} />}
      </PressSurface>
    </View>
  );
}

const DIAMETRO = touch.minSize;

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  redondo: {
    width: DIAMETRO,
    height: DIAMETRO,
    borderRadius: DIAMETRO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
  activo: { backgroundColor: color.action.primary },
  campo: {
    flex: 1,
    minHeight: DIAMETRO,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: stroke.hairline,
    borderColor: color.border.field,
    backgroundColor: color.surface.sunken,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.sm + 2,
    color: color.text.primary,
    fontSize: 16,
  },
});
