/**
 * El PIN de cuatro digitos.
 *
 * ## Por que no es un campo de contrasena
 *
 * Un `TextInput` con puntitos no dice cuantos digitos faltan. Cuatro casillas si: se ve de un
 * vistazo lo que llevas y lo que queda, que es justo lo que hace que un PIN se teclee sin mirar.
 * Y el teclado sale numerico sin que nadie tenga que cambiarlo.
 *
 * ## Un solo campo invisible detras
 *
 * Las casillas son decorado: el texto vive en UN input transparente que las cubre. Cuatro inputs
 * reales obligarian a mover el foco a mano en cada tecla —y a devolverlo al borrar—, que es donde
 * fallan todos los teclados de PIN: al pegar el codigo, al borrar dos veces seguidas, al autocompletar
 * el SMS. Con uno solo, el sistema hace lo suyo y las casillas solo pintan.
 *
 * ## El ojo sigue estando
 *
 * Un PIN se teclea a ciegas y equivocarse cuesta un intento de los cinco que hay antes del bloqueo.
 * Poder mirarlo es lo que evita el bloqueo por un dedo torpe.
 */
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { color, inputChrome, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText } from './primitives';

export const PIN_LENGTH = 4;

export function PinField({
  label,
  value,
  onChangeText,
  error,
  hint,
  autoFocus = false,
  onComplete,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  /** Se dispara al completar los cuatro digitos: evita pedir un toque mas para nada. */
  onComplete?: (pin: string) => void;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleChange = (raw: string) => {
    // Solo digitos: pegar «1 2-3 4» desde otra app tiene que funcionar igual que teclearlo.
    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
    onChangeText(digits);
    if (digits.length === PIN_LENGTH) onComplete?.(digits);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <AtlasText variant="caption" tone="secondary">
          {label} *
        </AtlasText>
        <Pressable
          onPress={() => setVisible(!visible)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
        >
          <Icon name={visible ? 'ojo-tachado' : 'ojo'} size={20} tint={visible ? color.action.primary : color.text.tertiary} />
        </Pressable>
      </View>

      {/*
        Las casillas son la superficie tocable del campo, y hasta ahora no tenian nombre.

        Con `accessibilityRole="none"` y sin etiqueta, un lector de pantalla anunciaba el rotulo
        —«Tu PIN»— y despues cuatro vistas mudas: quien navega con VoiceOver no encontraba donde
        escribir. Y por el mismo motivo tampoco podia encontrarlo una prueba automatizada, que es
        como se descubrio: el unico campo del alta que habia que tocar por coordenada.

        `accessibilityRole="none"` se queda —el campo real es el `TextInput` de debajo, y anunciar
        esto como boton diria que hace algo que no hace— pero ya tiene nombre e identificador.
      */}
      <Pressable
        onPress={() => input.current?.focus()}
        accessibilityRole="none"
        accessibilityLabel={`${label}: ${PIN_LENGTH} dígitos`}
        testID="pin-field"
      >
        <View style={styles.boxes}>
          {Array.from({ length: PIN_LENGTH }, (_, index) => {
            const filled = index < value.length;
            const active = focused && index === value.length;
            return (
              <View
                key={index}
                style={[styles.box, filled && styles.boxFilled, active && styles.boxActive, error ? styles.boxError : null]}
              >
                {filled ? (
                  visible ? (
                    <AtlasText variant="amount">{value[index]}</AtlasText>
                  ) : (
                    <View style={styles.dot} />
                  )
                ) : null}
              </View>
            );
          })}
        </View>

        {/*
          El campo real: transparente y encima de las casillas. `caretHidden` porque el cursor
          parpadeando sobre las casillas se lee como un fallo de dibujo.
        */}
        <TextInput
          ref={input}
          /*
            El campo esta escondido, pero el TECLADO no: sin esto sube el teclado claro de fabrica
            sobre la pantalla del PIN, que es la primera que ve quien vuelve a entrar en la app.
          */
          keyboardAppearance={inputChrome.keyboardAppearance}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          autoFocus={autoFocus}
          caretHidden
          secureTextEntry={!visible && Platform.OS === 'ios'}
          textContentType="oneTimeCode"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.hiddenInput}
          accessibilityLabel={label}
        />
      </Pressable>

      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : hint ? (
        <AtlasText variant="caption" tone="tertiary">
          {hint}
        </AtlasText>
      ) : null}
    </View>
  );
}

const BOX = 64;

const styles = StyleSheet.create({
  wrapper: { gap: space.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  boxes: { flexDirection: 'row', gap: space.md, justifyContent: 'center' },
  /*
    La casilla es un HUECO, no un pedestal.

    Estaba pintada con `surface.raised` —el color de una tarjeta—, asi que las cuatro casillas del
    PIN se leian como cuatro botones colocados sobre la pantalla en vez de como cuatro sitios donde
    escribir. Es la misma correccion que ya llevaban los campos de texto: mas oscuro que lo que las
    contiene, el hueco se ve hueco.
  */
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: color.border.focus, backgroundColor: color.brandWash.to },
  boxActive: { borderColor: color.border.focus, borderWidth: 2 },
  boxError: { borderColor: color.feedback.danger },
  dot: { width: 14, height: 14, borderRadius: radius.pill, backgroundColor: color.text.primary },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BOX,
    opacity: 0,
    // En Android un input de opacidad 0 sigue recibiendo el toque; el color es por si alguna
    // version lo pinta igual.
    color: 'transparent',
  },
});
