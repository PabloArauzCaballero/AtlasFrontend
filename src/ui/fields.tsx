/**
 * Campos de formulario.
 *
 * El teclado correcto por tipo de dato, el error debajo del campo y no en un cartel lejano, y el
 * foco visible. Un formulario movil que no contempla el teclado es un formulario web encogido.
 */
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { type Currency, type Minor, formatMoney, parseAmountInput } from '../domain/money';
import { color, radius, space, touch, type } from '../theme/tokens';
import { AtlasText } from './primitives';

export type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  containerStyle?: ViewStyle;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, required, containerStyle, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <AtlasText variant="caption" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </AtlasText>

      <TextInput
        ref={ref}
        {...rest}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        placeholderTextColor={color.text.placeholder}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, style]}
      />

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
});

/**
 * Campo de importe.
 *
 * Acepta la forma boliviana ("1.234,50") y la del teclado numerico ("1234.50") y entrega centavos
 * exactos. Nunca devuelve un `number` decimal hacia arriba: el dinero no viaja en coma flotante.
 */
export function AmountField({
  value,
  onChangeAmount,
  currency = 'BOB',
  error,
  autoFocus,
}: {
  value: string;
  onChangeAmount: (raw: string, parsed: Minor | null) => void;
  currency?: Currency;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const parsed = parseAmountInput(value, currency);

  return (
    <View style={styles.amountBox}>
      <AtlasText variant="caption" tone="secondary">
        Monto total de la compra
      </AtlasText>
      <View style={styles.amountRow}>
        <AtlasText variant="amount" tone="secondary">
          Bs
        </AtlasText>
        <TextInput
          accessibilityLabel="Monto total de la compra en bolivianos"
          value={value}
          onChangeText={(next) => onChangeAmount(next, parseAmountInput(next, currency))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0,00"
          placeholderTextColor={color.text.placeholder}
          autoFocus={autoFocus}
          returnKeyType="done"
          style={styles.amountInput}
        />
      </View>
      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : parsed ? (
        <AtlasText variant="caption" tone="tertiary">
          {formatMoney(parsed, currency)}
        </AtlasText>
      ) : (
        <AtlasText variant="caption" tone="tertiary">
          Escribe el monto que te indica el comercio.
        </AtlasText>
      )}
    </View>
  );
}

/** Selector de una sola opcion. En movil, una fila tocable gana a un desplegable pequeno. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string; detail?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
}) {
  return (
    <View style={styles.field}>
      <AtlasText variant="caption" tone="secondary">
        {label}
      </AtlasText>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
            >
              <AtlasText variant="bodyStrong" tone={selected ? 'onBrand' : 'primary'}>
                {option.label}
              </AtlasText>
              {option.detail ? (
                <AtlasText variant="caption" tone={selected ? 'onBrand' : 'tertiary'}>
                  {option.detail}
                </AtlasText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AtlasText variant="caption" tone="danger">
          {error}
        </AtlasText>
      ) : null}
    </View>
  );
}

/** Casilla de aceptacion. Area tactil completa: el texto tambien alterna el estado. */
export function CheckRow({
  label,
  detail,
  checked,
  onToggle,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.optionPressed]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
        {checked ? (
          <AtlasText variant="caption" tone="onBrand">
            ✓
          </AtlasText>
        ) : null}
      </View>
      <View style={styles.checkText}>
        <AtlasText variant="body">{label}</AtlasText>
        {detail ? (
          <AtlasText variant="caption" tone="tertiary">
            {detail}
          </AtlasText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: {
    minHeight: touch.minSize,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    color: color.text.primary,
    fontSize: type.body.fontSize,
  },
  inputFocused: { borderColor: color.border.focus },
  inputError: { borderColor: color.feedback.danger },

  amountBox: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    padding: space.lg,
    gap: space.sm,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amountInput: {
    flex: 1,
    color: color.text.primary,
    fontSize: type.amount.fontSize,
    lineHeight: type.amount.lineHeight,
    fontWeight: '700',
    padding: 0,
  },

  options: { gap: space.sm },
  option: {
    minHeight: touch.minSize,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xxs,
  },
  optionSelected: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  optionPressed: { opacity: 0.8 },

  checkRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: touch.minSize, paddingVertical: space.sm },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxChecked: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  checkText: { flex: 1, gap: space.xxs },
});
