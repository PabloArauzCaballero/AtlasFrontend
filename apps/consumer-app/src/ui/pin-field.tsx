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
import { bitacora as bitacoraDelAlta, esCampo } from '../features/bitacora/bitacora';
import { ganchosDeCampo } from '../features/bitacora/ganchos';
import { color, inputChrome, radius, space } from '../theme/tokens';
import { FieldFoot, FieldLabel } from './help-sheet';
import { toqueWeb } from './hit-slop';
import { Icon } from './icons';
import { AtlasText } from './primitives';

export const PIN_LENGTH = 4;

export function PinField({
  label,
  value,
  onChangeText,
  error,
  hint,
  ayuda,
  autoFocus = false,
  onComplete,
  bitacora,
  tamano = 'base',
  autoComplete,
  textContentType = 'oneTimeCode',
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string | null;
  hint?: string;
  /** Que PIN se pide aqui y para que sirve. Abre en la hoja del ⓘ, junto al rotulo. */
  ayuda?: string;
  autoFocus?: boolean;
  /** Se dispara al completar los cuatro digitos: evita pedir un toque mas para nada. */
  onComplete?: (pin: string) => void;
  /** Codigo en la bitacora del alta. De un PIN solo se anotan foco, desenfoque y «completo». */
  bitacora?: string;
  /**
   * `'grande'` para la pantalla de ingreso, donde el PIN es lo único que se teclea: casillas de 72
   * en vez de 64 y más aire entre ellas, para que se acierten con el pulgar y se lean de un vistazo.
   */
  tamano?: 'base' | 'grande';
  /** El login quiere `current-password` (el gestor de contraseñas lo rellena); el alta no. */
  autoComplete?: 'current-password' | 'new-password' | 'one-time-code' | 'off';
  /** `password` en el login; por defecto `oneTimeCode`, que es lo que sirve al alta y a recuperar. */
  textContentType?: 'password' | 'newPassword' | 'oneTimeCode';
}) {
  const anotar = ganchosDeCampo(bitacora, () => value.length);
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleChange = (raw: string) => {
    // Solo digitos: pegar «1 2-3 4» desde otra app tiene que funcionar igual que teclearlo.
    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
    onChangeText(digits);
    if (digits.length === PIN_LENGTH) {
      if (esCampo(bitacora)) bitacoraDelAlta.campoCompleto(bitacora);
      onComplete?.(digits);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/*
        El rotulo pasa a ser el MISMO `FieldLabel` que el resto de los controles.

        Aqui se dibujaba con `caption` —el estilo del texto de ayuda de debajo— y con el asterisco
        escrito a mano en el literal, asi que el unico campo del alta que se lee como un campo era
        justo el que no lo parecia. El ojo sigue a la derecha, ahora como `trailing` de la fila.
      */}
      <FieldLabel
        label={label}
        required
        ayuda={ayuda}
        trailing={
          <Pressable
            onPress={() => setVisible(!visible)}
            hitSlop={12}
            {...toqueWeb(12)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar PIN' : 'Mostrar PIN'}
          >
            <Icon name={visible ? 'ojo-tachado' : 'ojo'} size={20} tint={visible ? color.action.primary : color.text.tertiary} />
          </Pressable>
        }
      />

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
        <View style={[styles.boxes, tamano === 'grande' && styles.boxesGrande]}>
          {Array.from({ length: PIN_LENGTH }, (_, index) => {
            const filled = index < value.length;
            const active = focused && index === value.length;
            return (
              <View
                key={index}
                style={[styles.box, tamano === 'grande' && styles.boxGrande, filled && styles.boxFilled, active && styles.boxActive, error ? styles.boxError : null]}
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
          textContentType={textContentType}
          autoComplete={autoComplete}
          onFocus={() => {
            setFocused(true);
            anotar.onFocus();
          }}
          onBlur={() => {
            setFocused(false);
            anotar.onBlur();
          }}
          style={[styles.hiddenInput, tamano === 'grande' && styles.hiddenInputGrande]}
          accessibilityLabel={label}
        />
      </Pressable>

      <FieldFoot error={error} hint={hint} />
    </View>
  );
}

const BOX = 64;
const BOX_GRANDE = 72;

const styles = StyleSheet.create({
  wrapper: { gap: space.xs },
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
    borderColor: color.border.field,
    backgroundColor: color.surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxesGrande: { gap: space.lg },
  boxGrande: { width: BOX_GRANDE, height: BOX_GRANDE },
  hiddenInputGrande: { height: BOX_GRANDE },
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
