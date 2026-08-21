/**
 * Controles de formulario con icono, selector de pais y calendario nativo.
 *
 * ## Por que no son variantes de `Field`
 *
 * `Field` es una etiqueta encima de una caja de texto y funciona bien para lo que es. Estos tres no
 * son cajas de texto: uno abre un calendario, otro combina un selector con un numero y el tercero
 * mete un icono DENTRO del borde. Meterlos ahi convertiria un componente legible en un arbol de
 * condicionales, y cada pantalla que use `Field` cargaria con el calendario nativo sin usarlo.
 *
 * ## La rejilla
 *
 * Los tres miden lo mismo de alto y comparten radio, relleno y color de foco. Un formulario donde
 * cada control tiene su propia altura se lee como cinco componentes distintos apilados, no como una
 * ficha; esa sensacion es exactamente lo que separa un formulario que parece nativo de uno que
 * parece una pagina web encogida.
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { forwardRef, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { color, radius, space, touch, type } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AtlasText } from './primitives';

const CONTROL_HEIGHT = 56;

/* ------------------------------------------------------------------ campo con icono */

export type IconFieldProps = TextInputProps & {
  label: string;
  icon: IconName;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** Accion a la derecha del campo: mostrar la contrasena, limpiar, lo que el campo necesite. */
  trailing?: React.ReactNode;
};

export const IconField = forwardRef<TextInput, IconFieldProps>(function IconField(
  { label, icon, hint, error, required, trailing, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.block}>
      <AtlasText variant="caption" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </AtlasText>

      <View style={[styles.control, focused && styles.controlFocused, error ? styles.controlError : null]}>
        {/*
          El icono va DENTRO del borde y con el tono del texto secundario: es una pista de que dato
          se pide, no un boton. Pintarlo del color de marca lo convertiria en algo que invita a
          tocarse y no pasa nada al hacerlo.
        */}
        <Icon name={icon} size={20} tint={focused ? color.action.primary : color.text.tertiary} />
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
          style={[styles.input, style]}
        />
        {trailing}
      </View>

      <FieldFoot error={error} hint={hint} />
    </View>
  );
});

/* ------------------------------------------------------------------ fecha */

/** `YYYY-MM-DD` a partir de una fecha LOCAL, sin pasar por UTC. */
function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function readableDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Fecha con la que abre el calendario cuando aun no hay valor. */
  initialDate?: Date;
};

/**
 * Fecha con calendario NATIVO.
 *
 * Escribir `1996-04-12` a mano es pedirle a alguien que hable el formato de una base de datos. Y no
 * es solo incomodo: la mitad de los errores de este formulario eran de formato, no de dato — la
 * persona sabia perfectamente cuando nacio.
 *
 * El calendario tambien impide por construccion lo que la validacion tenia que rechazar despues:
 * con `maximumDate` no hay forma de elegir una fecha futura ni de teclear un mes 13.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  placeholder = 'Elige tu fecha',
  minimumDate,
  maximumDate,
  initialDate,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const current = useMemo(() => {
    if (value) {
      const parsed = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return initialDate ?? new Date();
  }, [value, initialDate]);

  /*
   * En Android el dialogo es del sistema y se cierra solo; en iOS el selector se queda montado y
   * necesita su propia hoja con un boton de cierre. Se distingue aqui y no en la pantalla porque es
   * un detalle del control, no del formulario.
   */
  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange(toIsoDate(picked));
  };

  return (
    <View style={styles.block}>
      <AtlasText variant="caption" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </AtlasText>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${readableDate(value)}. Tocar para cambiar` : `${label}. Tocar para elegir`}
        style={[styles.control, error ? styles.controlError : null]}
      >
        <Icon name="pagos" size={20} tint={color.text.tertiary} />
        <AtlasText variant="body" style={[styles.controlText, !value && { color: color.text.placeholder }]}>
          {value ? readableDate(value) : placeholder}
        </AtlasText>
        <Icon name="adelante" size={16} tint={color.text.tertiary} />
      </Pressable>

      <FieldFoot error={error} hint={hint} />

      {open && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="spinner"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <AtlasText variant="bodyStrong">{label}</AtlasText>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Listo">
                <AtlasText variant="bodyStrong" style={{ color: color.action.primary }}>
                  Listo
                </AtlasText>
              </Pressable>
            </View>
            <DateTimePicker
              value={current}
              mode="date"
              display="spinner"
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant="dark"
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ telefono */

export type Country = { code: string; dial: string; flag: string; name: string };

/**
 * Los paises que este producto atiende de verdad, con Bolivia primero.
 *
 * No es la lista de las Naciones Unidas a proposito: doscientas filas para elegir entre cuatro
 * convierte un selector en un buscador, y quien vive en Santa Cruz no tiene por que recorrer medio
 * mundo hasta encontrar el suyo. Los vecinos estan porque el remitente puede estar de viaje o ser
 * migrante; el resto se anade cuando el negocio llegue alli.
 */
const COUNTRY_LIST = [
  { code: 'BO', dial: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'AR', dial: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: 'CL', dial: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dial: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: 'PY', dial: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'UY', dial: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: 'CO', dial: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'EC', dial: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'MX', dial: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'Estados Unidos' },
] as const satisfies readonly Country[];

/**
 * Se exporta con Bolivia separada del resto.
 *
 * `COUNTRIES[0]` obliga a quien lo use a tratar un `undefined` que no puede ocurrir. `DEFAULT_COUNTRY`
 * dice lo mismo sin mentir al tipo, y ademas nombra la decision: el pais por defecto es una eleccion
 * de producto, no el primero de una lista que alguien podria reordenar.
 */
export const DEFAULT_COUNTRY: Country = COUNTRY_LIST[0];
export const COUNTRIES: readonly Country[] = COUNTRY_LIST;

export type PhoneFieldProps = {
  label: string;
  /** Solo los digitos NACIONALES. El prefijo vive en `country`, no dentro del texto. */
  value: string;
  onChangeText: (digits: string) => void;
  country: Country;
  onChangeCountry: (country: Country) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
};

/**
 * Telefono con prefijo de pais separado del numero.
 *
 * Antes el campo empezaba con `+591` dentro del texto y se podia borrar, mover o duplicar: el
 * numero que salia hacia el backend dependia de que nadie tocara los cuatro primeros caracteres.
 * Separarlos hace imposible ese error —el prefijo ya no es texto editable— y de paso permite
 * teclear el numero como se dicta, sin el codigo delante.
 */
export function PhoneField({ label, value, onChangeText, country, onChangeCountry, hint, error, required }: PhoneFieldProps) {
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);

  return (
    <View style={styles.block}>
      <AtlasText variant="caption" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </AtlasText>

      <View style={[styles.control, styles.phoneControl, focused && styles.controlFocused, error ? styles.controlError : null]}>
        <Pressable
          onPress={() => setPicking(true)}
          style={styles.dial}
          accessibilityRole="button"
          accessibilityLabel={`Código de país: ${country.name} ${country.dial}. Tocar para cambiar`}
        >
          <AtlasText variant="body" style={styles.flag}>
            {country.flag}
          </AtlasText>
          <AtlasText variant="bodyStrong">{country.dial}</AtlasText>
          <Icon name="adelante" size={14} tint={color.text.tertiary} />
        </Pressable>

        <View style={styles.dialSeparator} />

        <TextInput
          value={value}
          // Solo digitos: pegar un numero con espacios o guiones no puede romper el formato.
          onChangeText={(next) => onChangeText(next.replace(/[^0-9]/g, ''))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="70000000"
          maxLength={15}
          accessibilityLabel={label}
          placeholderTextColor={color.text.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
      </View>

      <FieldFoot error={error} hint={hint} />

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <AtlasText variant="bodyStrong">Código de país</AtlasText>
            <Pressable onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel="Cerrar">
              <AtlasText variant="bodyStrong" style={{ color: color.action.primary }}>
                Listo
              </AtlasText>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList}>
            {COUNTRIES.map((item) => {
              const selected = item.code === country.code;
              return (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    onChangeCountry(item);
                    setPicking(false);
                  }}
                  style={[styles.countryRow, selected && styles.countryRowSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.name} ${item.dial}`}
                >
                  <AtlasText variant="body" style={styles.flag}>
                    {item.flag}
                  </AtlasText>
                  <AtlasText variant="body" style={styles.countryName}>
                    {item.name}
                  </AtlasText>
                  <AtlasText variant="body" tone="secondary">
                    {item.dial}
                  </AtlasText>
                  {selected ? <Icon name="check" size={18} tint={color.action.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ comun */

function FieldFoot({ error, hint }: { error?: string | null; hint?: string }) {
  if (error) {
    return (
      <AtlasText variant="caption" tone="danger">
        {error}
      </AtlasText>
    );
  }
  if (hint) {
    return (
      <AtlasText variant="caption" tone="tertiary">
        {hint}
      </AtlasText>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: CONTROL_HEIGHT,
    paddingHorizontal: space.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    // Hundido, no elevado: un campo es un hueco donde se escribe, no una tarjeta que se pulsa.
    backgroundColor: color.surface.sunken,
  },
  controlFocused: { borderColor: color.border.focus },
  controlError: { borderColor: color.feedback.danger },
  controlText: { flex: 1 },
  input: {
    flex: 1,
    padding: 0,
    color: color.text.primary,
    ...(type.body as object),
  },
  phoneControl: { paddingLeft: space.sm },
  dial: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingHorizontal: space.xs, minHeight: touch.minSize },
  dialSeparator: { width: 1, height: 24, backgroundColor: color.border.subtle },
  flag: { fontSize: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: color.surface.sheet,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingBottom: space.xl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.border.subtle,
  },
  sheetList: { maxHeight: 380 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: touch.minSize,
  },
  countryRowSelected: { backgroundColor: color.surface.raisedStrong },
  countryName: { flex: 1 },
});
