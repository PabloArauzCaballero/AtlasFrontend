/**
 * El código a mano de la caja, en casillas como el PIN.
 *
 * Mismo mecanismo que `PinField`: las casillas son decorado y el texto vive en UN input transparente encima, así
 * pegar, borrar y autocompletar los resuelve el sistema. Cambia lo que deja escribir: sólo los símbolos del código
 * (`ALFABETO_CODIGO_CAJA`), en mayúsculas y a la vista —un código se lee y se compara con el cartel, no se oculta—.
 * Ocho casillas en dos grupos de cuatro, como se imprime (`K7M2-9QXD`) y como se dicta.
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LARGO_CODIGO_CAJA, limpiarCodigoCaja } from '../features/codigo-caja';
import { color, inputChrome, radius, space } from '../theme/tokens';
import { FieldFoot, FieldLabel } from './help-sheet';
import { AtlasText } from './primitives';

export function CodigoCajaField({
  label,
  value,
  onChangeText,
  error,
  hint,
  ayuda,
  onComplete,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string | null;
  hint?: string;
  ayuda?: string;
  /** Se dispara al completar las ocho casillas: evita pedir un toque más para nada. */
  onComplete?: (codigo: string) => void;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const alCambiar = (crudo: string) => {
    const codigo = limpiarCodigoCaja(crudo);
    onChangeText(codigo);
    if (codigo.length === LARGO_CODIGO_CAJA) onComplete?.(codigo);
  };

  return (
    <View style={styles.wrapper}>
      <FieldLabel label={label} required ayuda={ayuda} />
      <Pressable
        onPress={() => input.current?.focus()}
        accessibilityRole="none"
        accessibilityLabel={`${label}: ${LARGO_CODIGO_CAJA} caracteres`}
        testID="codigo-caja-field"
      >
        <View style={styles.casillas}>
          {Array.from({ length: LARGO_CODIGO_CAJA }, (_, indice) => {
            const llena = indice < value.length;
            const activa = focused && indice === value.length;
            return (
              <View key={indice} style={styles.celda}>
                {/* El guion entre los dos grupos: el código se imprime y se dicta de a cuatro. */}
                {indice === LARGO_CODIGO_CAJA / 2 ? <View style={styles.guion} /> : null}
                <View style={[styles.casilla, llena && styles.casillaLlena, activa && styles.casillaActiva, error ? styles.casillaError : null]}>
                  {llena ? <AtlasText variant="h3">{value[indice]}</AtlasText> : null}
                </View>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={input}
          keyboardAppearance={inputChrome.keyboardAppearance}
          value={value}
          onChangeText={alCambiar}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={LARGO_CODIGO_CAJA * 2}
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.inputOculto}
          accessibilityLabel={label}
        />
      </Pressable>
      <FieldFoot error={error} hint={hint} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.xs },
  casillas: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  celda: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  casilla: {
    flex: 1,
    aspectRatio: 0.78,
    maxHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border.field,
    backgroundColor: color.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaLlena: { borderColor: color.border.focus, backgroundColor: color.brandWash.to },
  casillaActiva: { borderColor: color.border.focus, borderWidth: 2 },
  casillaError: { borderColor: color.feedback.danger },
  guion: { width: 6, height: 2, borderRadius: 1, backgroundColor: color.text.tertiary },
  inputOculto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
});
