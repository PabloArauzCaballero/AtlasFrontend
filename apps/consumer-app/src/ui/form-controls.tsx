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
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { forwardRef, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { color, press, radius, shadow, space, touch, type } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { PressSurface } from './motion';
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
      <FieldLabel label={label} required={required} />

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
   * `onValueChange` + `onDismiss`, no `onChange`.
   *
   * `onChange` esta deprecado en esta version del selector y lo avisa por consola en cada apertura
   * —se veia en la corrida del simulador—. No es solo el aviso: `onChange` mezclaba dos sucesos
   * distintos en una firma, «eligio una fecha» y «cerro sin elegir», y obligaba a mirar
   * `event.type` para saber cual habia ocurrido. Separados, cada uno hace una cosa.
   *
   * En Android el dialogo es del sistema y se cierra solo; en iOS el selector se queda montado y
   * necesita su propia hoja con un boton de cierre. Se distingue aqui y no en la pantalla porque es
   * un detalle del control, no del formulario.
   */
  const handleValueChange = (_event: DateTimePickerChangeEvent, picked: Date) => {
    if (Platform.OS !== 'ios') setOpen(false);
    if (!picked) return;
    onChange(toIsoDate(picked));
  };

  const handleDismiss = () => setOpen(false);

  return (
    <View style={styles.block}>
      <FieldLabel label={label} required={required} />

      <PressSurface
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${readableDate(value)}. Tocar para cambiar` : `${label}. Tocar para elegir`}
        style={[styles.control, error ? styles.controlError : null]}
        scaleTo={press.scaleSubtle}
      >
        <Icon name="pagos" size={20} tint={color.text.tertiary} />
        <AtlasText variant="body" style={[styles.controlText, !value && { color: color.text.placeholder }]}>
          {value ? readableDate(value) : placeholder}
        </AtlasText>
        <Icon name="adelante" size={16} tint={color.text.tertiary} />
      </PressSurface>

      <FieldFoot error={error} hint={hint} />

      {open && Platform.OS !== 'ios' ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="spinner"
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <AtlasText variant="h3">{label}</AtlasText>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Listo" hitSlop={12}>
                <AtlasText variant="bodyStrong" tone="brand">
                  Listo
                </AtlasText>
              </Pressable>
            </View>
            <DateTimePicker
              value={current}
              mode="date"
              display="spinner"
              onValueChange={handleValueChange}
              onDismiss={handleDismiss}
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
/* ------------------------------------------------------------- seleccion */

/**
 * `detalle` es la linea de apoyo de una opcion —«A tu numero registrado.»—. Vive en la hoja, bajo
 * la etiqueta, y se repite bajo el control cuando esa opcion queda elegida: si el matiz solo se ve
 * mientras la hoja esta abierta, se pierde justo cuando hay que decidir si la eleccion fue la
 * correcta.
 */
export type OpcionSelect<T extends string = string> = { valor: T; etiqueta: string; detalle?: string };

/**
 * Elegir UNO de una lista larga, en una hoja.
 *
 * ## Por que no es `OptionGroup`
 *
 * `OptionGroup` pinta todas las opciones como filas tocables, y eso funciona hasta cuatro o cinco:
 * a partir de ahi la pantalla se convierte en una lista donde el formulario desaparece. Nueve
 * departamentos —o las diez ciudades de Santa Cruz— pertenecen a una hoja que se abre, se elige y
 * se cierra.
 *
 * ## Por que no es un campo de texto
 *
 * Porque lo que se escribe a mano no se puede agrupar despues. «Santa Cruz de la Sierra», «santa
 * cruz» y «SCZ» son la misma ciudad para una persona y tres para una consulta, y una cartera de
 * credito que no puede contar por ciudad no puede decidir donde abrir el siguiente comercio.
 *
 * ## El estado vacio importa
 *
 * `deshabilitadoPorque` existe para la ciudad: sin departamento elegido no hay lista que ofrecer, y
 * un control que no responde sin decir por que se lee como roto. Dice lo que falta, en su sitio.
 */
/** Sin tildes y en minúsculas: quien busca «Cochabamba» escribe «cochabamba», y quien busca
 *  «Aroma» no debería fallar por escribir «aroma» con o sin acento. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function SelectField<T extends string = string>({
  label,
  value,
  opciones,
  onChange,
  placeholder = 'Elige una opción',
  hint,
  error,
  required,
  deshabilitadoPorque,
  buscable,
}: {
  label: string;
  value: T | null;
  opciones: OpcionSelect<T>[];
  onChange: (valor: T) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  deshabilitadoPorque?: string | null;
  /** Fuerza o suprime el buscador. Sin pasarlo, aparece cuando hay más de ocho opciones. */
  buscable?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const elegida = opciones.find((opcion) => opcion.valor === value) ?? null;
  const bloqueado = Boolean(deshabilitadoPorque);

  /*
    El buscador aparece solo cuando la lista deja de caber de un vistazo.

    Con seis opciones, un campo de texto encima es una barrera antes de una lista que ya se lee
    entera; con cuarenta rubros o las zonas de una ciudad, sin buscador la hoja obliga a arrastrar a
    ciegas. El umbral es el de la propia hoja: `maxHeight` deja ver unas ocho filas.
  */
  const conBuscador = buscable ?? opciones.length > 8;

  const visibles = useMemo(() => {
    const aguja = normalizar(busqueda);
    if (!aguja) return opciones;
    return opciones.filter(
      (opcion) => normalizar(opcion.etiqueta).includes(aguja) || normalizar(opcion.detalle ?? '').includes(aguja),
    );
  }, [opciones, busqueda]);

  const cerrar = () => {
    setAbierto(false);
    // La búsqueda se descarta al cerrar: reabrir y encontrar el filtro anterior puesto se lee como
    // que faltan opciones, y el motivo —tres letras escritas hace un minuto— no está a la vista.
    setBusqueda('');
  };

  return (
    <View style={styles.block}>
      <FieldLabel label={label} required={required} />

      <PressSurface
        onPress={() => setAbierto(true)}
        disabled={bloqueado}
        accessibilityRole="button"
        accessibilityState={{ disabled: bloqueado }}
        accessibilityLabel={
          bloqueado
            ? `${label}. ${deshabilitadoPorque}`
            : elegida
              ? `${label}: ${elegida.etiqueta}. Tocar para cambiar`
              : `${label}. Tocar para elegir`
        }
        style={[styles.control, error ? styles.controlError : null, bloqueado ? styles.controlBloqueado : null]}
        scaleTo={press.scaleSubtle}
      >
        <Icon name="lista" size={20} tint={color.text.tertiary} />
        <AtlasText variant="body" style={[styles.controlText, !elegida && { color: color.text.placeholder }]}>
          {elegida?.etiqueta ?? placeholder}
        </AtlasText>
        <Icon name="adelante" size={16} tint={color.text.tertiary} />
      </PressSurface>

      <FieldFoot
        error={error}
        hint={bloqueado ? (deshabilitadoPorque ?? undefined) : (hint ?? elegida?.detalle)}
      />

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={cerrar}>
        <Pressable style={styles.backdrop} onPress={cerrar} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <AtlasText variant="h3">{label}</AtlasText>
            <Pressable onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={12}>
              <AtlasText variant="bodyStrong" tone="brand">
                Listo
              </AtlasText>
            </Pressable>
          </View>

          {conBuscador ? (
            <View style={styles.buscador}>
              <Icon name="lista" size={18} tint={color.text.tertiary} />
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar"
                placeholderTextColor={color.text.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel={`Buscar en ${label}`}
                style={styles.buscadorInput}
              />
              {busqueda ? (
                <Pressable onPress={() => setBusqueda('')} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
                  <AtlasText variant="caption" tone="secondary">
                    Borrar
                  </AtlasText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {/*
              Sin resultados se DICE, no se deja la hoja en blanco: una lista vacía y sin explicación
              se lee como que el catálogo no cargó.
            */}
            {visibles.length === 0 ? (
              <View style={styles.sinResultados}>
                <AtlasText variant="body" tone="secondary">
                  Nada coincide con «{busqueda}».
                </AtlasText>
              </View>
            ) : null}
            {visibles.map((opcion) => {
              const seleccionada = opcion.valor === value;
              return (
                <PressSurface
                  key={opcion.valor}
                  onPress={() => {
                    onChange(opcion.valor);
                    cerrar();
                  }}
                  style={[styles.countryRow, seleccionada && styles.countryRowSelected]}
                  scaleTo={press.scaleSubtle}
                  accessibilityRole="button"
                  accessibilityState={{ selected: seleccionada }}
                  accessibilityLabel={opcion.etiqueta}
                >
                  <View style={styles.countryName}>
                    <AtlasText variant="body">{opcion.etiqueta}</AtlasText>
                    {opcion.detalle ? (
                      <AtlasText variant="caption" tone="tertiary">
                        {opcion.detalle}
                      </AtlasText>
                    ) : null}
                  </View>
                  {seleccionada ? <Icon name="check" size={18} tint={color.action.primary} /> : null}
                </PressSurface>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------- telefono */

export function PhoneField({ label, value, onChangeText, country, onChangeCountry, hint, error, required }: PhoneFieldProps) {
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);

  return (
    <View style={styles.block}>
      <FieldLabel label={label} required={required} />

      <View style={[styles.control, styles.phoneControl, focused && styles.controlFocused, error ? styles.controlError : null]}>
        <PressSurface
          onPress={() => setPicking(true)}
          style={styles.dial}
          accessibilityRole="button"
          accessibilityLabel={`Código de país: ${country.name} ${country.dial}. Tocar para cambiar`}
        >
          <AtlasText variant="body" style={styles.flag}>
            {country.flag}
          </AtlasText>
          <AtlasText variant="title">{country.dial}</AtlasText>
          <Icon name="adelante" size={14} tint={color.text.tertiary} />
        </PressSurface>

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
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <AtlasText variant="h3">Código de país</AtlasText>
            <Pressable onPress={() => setPicking(false)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={12}>
              <AtlasText variant="bodyStrong" tone="brand">
                Listo
              </AtlasText>
            </Pressable>
          </View>
          <ScrollView style={styles.sheetList}>
            {COUNTRIES.map((item) => {
              const selected = item.code === country.code;
              return (
                <PressSurface
                  key={item.code}
                  onPress={() => {
                    onChangeCountry(item);
                    setPicking(false);
                  }}
                  style={[styles.countryRow, selected && styles.countryRowSelected]}
                  scaleTo={press.scaleSubtle}
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
                </PressSurface>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ comun */

/**
 * La etiqueta de un control.
 *
 * Estaba escrita cuatro veces, identica, en los cuatro controles de este archivo, y las cuatro con
 * `variant="caption"`: el mismo estilo exacto que el texto de ayuda de DEBAJO del campo. Un
 * formulario donde el nombre del dato y su explicacion se dibujan igual se lee como tres renglones
 * de texto con un rectangulo en medio.
 *
 * El asterisco va aparte y en color de marca, con su propia etiqueta accesible: gris y pegado al
 * final de la palabra no se ve, y sin nombre no significa nada para un lector de pantalla.
 */
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <AtlasText variant="label" tone="secondary">
      {label}
      {required ? (
        <AtlasText variant="label" tone="brand" accessibilityLabel="obligatorio">
          {' *'}
        </AtlasText>
      ) : null}
    </AtlasText>
  );
}

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
  // El mismo grosor de foco que `fields.tsx`: con un solo pixel de color, en una pantalla oscura,
  // no se distingue cual de seis campos tiene el cursor.
  controlFocused: { borderColor: color.border.focus, borderWidth: 1.5 },
  // Bloqueado: se apaga, no se esconde. Un control que desaparece hasta que rellenas otro campo
  // hace que la pantalla cambie de forma mientras la lees.
  controlBloqueado: { opacity: 0.5 },
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
  // El mismo velo que el recorrido guiado (`color.overlay.scrim`): negro puro al 55 % era un
  // segundo oscurecedor, mas claro y sin el tinte navy, en una app que ya tenia el suyo.
  backdrop: { flex: 1, backgroundColor: color.overlay.scrim },
  sheet: {
    backgroundColor: color.surface.sheet,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingBottom: space.xl,
    ...shadow.sheet,
  },
  /*
    El tirador. No se arrastra —la hoja se cierra tocando fuera o con «Listo»— y aun asi vale la
    pena: es la senal con la que ambos sistemas operativos dicen «esto es una hoja que cubre lo de
    debajo, no una pantalla nueva». Sin el, la hoja aparecia como un bloque que sube desde el borde
    y no quedaba claro si volver era retroceder o cerrar.
  */
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.border.strong,
    alignSelf: 'center',
    marginTop: space.md,
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
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.surface.sunken,
  },
  buscadorInput: { flex: 1, color: color.text.primary, ...type.body },
  sinResultados: { paddingHorizontal: space.lg, paddingVertical: space.lg },
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
