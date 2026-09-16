/**
 * Campos de formulario.
 *
 * El teclado correcto por tipo de dato, el error debajo del campo y no en un cartel lejano, y el
 * foco visible. Un formulario movil que no contempla el teclado es un formulario web encogido.
 */
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View, type ViewStyle, Switch as RNSwitch } from 'react-native';
import { type Currency, type Minor, formatMoney, parseAmountInput } from '../domain/money';
import { color, inputChrome, press, radius, space, touch, type } from '../theme/tokens';
import { FieldFoot, FieldLabel, HelpButton } from './help-sheet';
import { Icon } from './icons';
import { PressSurface } from './motion';
import { AtlasText } from './primitives';
import { webData } from '../web/estilo';

export type FieldProps = TextInputProps & {
  label: string;
  /** Pie corto y siempre visible. La explicacion completa va en `ayuda`, detras del ⓘ. */
  hint?: string;
  /** Que poner aqui y por que importa, con ejemplo si el formato no es obvio. */
  ayuda?: string;
  error?: string | null;
  required?: boolean;
  containerStyle?: ViewStyle;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, ayuda, error, required, containerStyle, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <FieldLabel label={label} required={required} ayuda={ayuda} />

      <TextInput
        ref={ref}
        {...inputChrome}
        {...rest}
        {...webData('campo')}
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

      <FieldFoot error={error} hint={hint} />
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
  ayuda,
  autoFocus,
}: {
  value: string;
  onChangeAmount: (raw: string, parsed: Minor | null) => void;
  currency?: Currency;
  error?: string | null;
  /** Que importe se escribe aqui y con que se compara. Abre en la hoja del ⓘ. */
  ayuda?: string;
  autoFocus?: boolean;
}) {
  const parsed = parseAmountInput(value, currency);

  return (
    <View style={styles.amountBox}>
      {/*
        El rotulo en versalitas se conserva —es el unico campo de la app que va dentro de una caja
        con su nombre arriba— pero ya lo dibuja `FieldLabel`, que es quien sabe colgarle el ⓘ.
      */}
      <FieldLabel label="Monto total de la compra" variante="overline" ayuda={ayuda} />
      <View style={styles.amountRow}>
        <AtlasText variant="amount" tone="secondary">
          Bs
        </AtlasText>
        <TextInput
          {...inputChrome}
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
      <FieldFoot
        error={error}
        hint={parsed ? formatMoney(parsed, currency) : 'Escribe el monto que te indica el comercio.'}
      />
    </View>
  );
}

/** Selector de una sola opcion. En movil, una fila tocable gana a un desplegable pequeno. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  ayuda,
  error,
}: {
  label: string;
  /**
   * `detalle` y no `detail`: es la MISMA palabra que `OpcionSelect` en `form-controls.tsx`, y
   * mientras fueron dos, mover una lista de un control al otro exigia renombrarla a mano —y el
   * guardian `check-field-help` tenia que conocer dos nombres para lo mismo—.
   */
  options: { value: T; label: string; detalle?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Que se elige aqui y por que importa. Abre en la hoja del ⓘ. */
  ayuda?: string;
  error?: string | null;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} ayuda={ayuda} />
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            /*
              El mismo hundimiento que las filas de lista, no un salto de opacidad.

              Estas filas son el control mas repetido del registro —ocho pasos casi todos de
              opciones— y no tenian recorrido ninguno: la opacidad bajaba a 0.8 en un fotograma y
              volvia en otro. `scaleSubtle` y no `press.scale` porque en una fila ancha el 3 %
              desplaza el borde lo bastante como para leerse como un salto.
            */
            <PressSurface
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              // El detalle entra en el nombre accesible: `PressSurface` con etiqueta esconde el
              // texto de sus hijos, asi que sin esto el lector nunca lee la segunda linea.
              accessibilityLabel={option.detalle ? `${option.label}. ${option.detalle}` : option.label}
              onPress={() => onChange(option.value)}
              scaleTo={press.scaleSubtle}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <AtlasText variant="title" tone={selected ? 'brand' : 'primary'}>
                {option.label}
              </AtlasText>
              {option.detalle ? (
                <AtlasText variant="caption" tone={selected ? 'secondary' : 'tertiary'}>
                  {option.detalle}
                </AtlasText>
              ) : null}
            </PressSurface>
          );
        })}
      </View>
      <FieldFoot error={error} />
    </View>
  );
}

/** Casilla de aceptacion. Area tactil completa: el texto tambien alterna el estado. */
export function CheckRow({
  label,
  detail,
  ayuda,
  checked,
  onToggle,
}: {
  label: string;
  /** La linea gris de debajo, siempre visible. Corta: lo largo va en `ayuda`. */
  detail?: string;
  /** Que se acepta al marcar esto y que pasa si no se marca. Abre en la hoja del ⓘ. */
  ayuda?: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={styles.checkWrapper}>
      <PressSurface
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onToggle(!checked)}
        scaleTo={press.scaleSubtle}
        style={styles.checkRow}
      >
        {/*
          La marca es el icono del set, no el caracter «✓».

          El glifo lo dibujaba la fuente del sistema —Manrope no lo trae— asi que la unica marca de
          verificacion de la app se dibujaba con un trazo, un grosor y unos remates que no eran los de
          ninguna otra cosa en pantalla, y ademas cambiaba de forma entre iOS y Android. El icono
          comparte rejilla y grosor con los otros cuarenta.
        */}
        <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
          {checked ? <Icon name="check" size={15} tint={color.text.onBrand} /> : null}
        </View>
        <View style={styles.checkText}>
          <AtlasText variant="body">{label}</AtlasText>
          {detail ? (
            <AtlasText variant="caption" tone="tertiary">
              {detail}
            </AtlasText>
          ) : null}
        </View>
      </PressSurface>
      {/*
        El ⓘ va FUERA de la fila pulsable, no dentro.

        Dentro, cada toque en el icono habria marcado tambien la casilla —el area tactil de la fila es
        toda la fila, que es justo lo que la hace comoda— y quien abre la ayuda de una autorizacion la
        habria aceptado sin leerla.
      */}
      {ayuda ? (
        <View style={styles.checkHelp}>
          <HelpButton ayuda={ayuda} etiqueta={label} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: {
    minHeight: touch.minSize,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    color: color.text.primary,
    /*
      La FAMILIA, que faltaba.

      El campo declaraba solo el tamano, asi que lo que la persona escribia se dibujaba con la
      fuente del sistema mientras la etiqueta de encima y la ayuda de debajo iban en Manrope. En el
      alta hay treinta y tantos campos: era, con diferencia, el sitio donde mas texto de la app se
      pintaba con una tipografia que no es la de la marca — y justo el texto que la persona mira
      mientras lo teclea.
    */
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    /*
      Sin el relleno vertical que Android calcula desde las metricas de la fuente.

      Es el mismo ajuste que `render` en `ui/primitives`, y en un campo se nota todavia mas: el
      relleno se suma DENTRO de la caja, asi que lo tecleado se dibuja por encima del centro del
      campo y el cursor arranca mas alto que el ejemplo que sustituye. Con treinta y tantos campos
      en el alta, es un desalineado que se repite pantalla tras pantalla.
    */
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  /*
    El foco no solo cambia el borde: lo engorda y lo tine.

    Con un único pixel de color, en una pantalla oscura y a la luz del sol, no se distingue cual de
    los seis campos tiene el cursor. Es la senal más util del formulario y la más barata de dar.
  */
  inputFocused: { borderColor: color.border.focus, borderWidth: 1.5 },
  inputError: { borderColor: color.feedback.danger },

  amountBox: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
    padding: space.lg,
    gap: space.sm,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  amountInput: {
    flex: 1,
    color: color.text.primary,
    padding: 0,
    /*
      La familia completa, no `fontWeight: '700'`.

      Era la unica cifra de la app dibujada con negrita fingida: en Android el sistema engorda los
      trazos de la fuente cargada en vez de cambiar de archivo, y ese engorde es exactamente lo que
      delata a una app al lado de su propia web. Ademas hereda las cifras TABULARES, que es lo que
      permite comparar importes sin releerlos.
    */
    fontFamily: type.amount.fontFamily,
    fontSize: type.amount.fontSize,
    lineHeight: type.amount.lineHeight,
    includeFontPadding: false,
    letterSpacing: type.amount.letterSpacing,
    // Se copia campo a campo en vez de esparcir `type.amount`: su `fontVariant` es una tupla de
    // solo lectura y `TextInput` exige un array mutable.
    fontVariant: ['tabular-nums' as const],
  },

  options: { gap: space.sm },
  option: {
    minHeight: touch.minSize,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xxs,
  },
  /*
    La opcion elegida se TINE, no se rellena.

    Rellenarla de menta plena ponia en pantalla dos bloques del mismo color saturado: la opcion y el
    boton principal. Cuando dos elementos gritan igual, ninguno manda, y el que tiene que mandar es
    la accion. Tenida —fondo de marca al 12 %, borde y texto de marca— la seleccion se lee igual de
    clara y el boton recupera su sitio.
  */
  optionSelected: {
    backgroundColor: color.brandWash.from,
    borderColor: color.action.primary,
    borderWidth: 1.5,
  },

  checkWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
  checkRow: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: touch.minSize, paddingVertical: space.sm },
  // Alineado con la primera linea del rotulo, no centrado en una fila que puede medir tres lineas.
  checkHelp: { paddingTop: space.sm + 2, paddingLeft: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
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

/**
 * Un interruptor de encendido/apagado.
 *
 * Se usa el nativo del sistema y no uno dibujado a mano: es el control que la gente ya sabe leer de
 * un vistazo —y, mas importante, el que los lectores de pantalla anuncian correctamente sin que
 * haya que declararle el rol y el estado a mano.
 *
 * `disabled` se pinta apagando el color, no escondiendo el control: una preferencia que no se puede
 * cambiar tiene que VERSE, porque la persona necesita saber que existe y que esta activa.
 */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  ayuda,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * Que enciende o apaga este interruptor. En los avisos lo escribe el SERVIDOR
   * (`description` / `mandatoryReason` de cada preferencia): la app no reescribe con sus palabras
   * lo que Operaciones ya redacto para ese aviso.
   */
  ayuda?: string;
}) {
  const control = (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: color.surface.sunken, true: color.action.primary }}
      thumbColor={color.surface.primary}
      ios_backgroundColor={color.surface.sunken}
      style={disabled ? { opacity: 0.5 } : undefined}
    />
  );

  if (!ayuda) return control;

  // El ⓘ a la IZQUIERDA del interruptor: a la derecha quedaria en el borde de la pantalla, donde ya
  // esta el gesto de volver atras de iOS, y medio toque de cada dos abriria la navegacion.
  return (
    <View style={styles.switchRow}>
      <HelpButton ayuda={ayuda} etiqueta={accessibilityLabel ?? 'este aviso'} />
      {control}
    </View>
  );
}
