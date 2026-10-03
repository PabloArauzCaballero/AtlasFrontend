/**
 * Primitivas visuales de ATLAS.
 *
 * Cada una existe para que ninguna pantalla tenga que decidir un color, un radio o un area tactil
 * por su cuenta. Reglas que se aplican aqui una sola vez, y por eso valen en toda la app:
 *  - area tactil minima de 48 px;
 *  - estados `pressed`, `disabled` y `loading` siempre visibles;
 *  - etiquetas de accesibilidad obligatorias en controles sin texto;
 *  - ningun color literal fuera de `theme/tokens`.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, palette, press, radius, shadow, space, spring, stroke, touch, type } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { AnimatedPressable, PressSurface } from './motion';
import { webData } from '../web/estilo';
import { medirToque, useDisposicion } from '../features/bitacora/ganchos';

/* ------------------------------------------------------------------ texto */

type TypeVariant = keyof typeof type;
type TextTone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'success' | 'warning' | 'danger' | 'onBrand';

const TONE: Record<TextTone, string> = {
  primary: color.text.primary,
  secondary: color.text.secondary,
  tertiary: color.text.tertiary,
  brand: color.action.primary,
  success: color.feedback.success,
  warning: color.feedback.warning,
  danger: color.feedback.danger,
  onBrand: color.text.onBrand,
};

/**
 * Correccion de RENDERIZADO de Android, aplicada una vez y valida para toda la app.
 *
 * Android reserva, encima y debajo de cada linea de texto, el hueco que la FUENTE declara en sus
 * metricas (`ascent`/`descent`), no el que pide el `lineHeight` que se le da. Sora y Manrope
 * declaran metricas generosas —estan pensadas para tipografia de pantalla ancha—, asi que ese
 * relleno anade entre 2 y 5 px arriba y una cantidad DISTINTA abajo. Las consecuencias se ven en
 * todas partes y ninguna se sabe nombrar mirando una captura:
 *
 *  - la etiqueta de un boton se dibuja un pelo por encima del centro de la pildora;
 *  - el texto de una pastilla de estado no queda centrado en su fondo;
 *  - un titulo de dos lineas separa sus renglones mas de lo que dice `lineHeight`;
 *  - y lo peor: iOS NO hace nada de esto, asi que las dos plataformas dejan de coincidir y la
 *    version de Android se lee como una copia mal calcada de la de iPhone.
 *
 * Con el relleno apagado, la caja del texto pasa a medir exactamente `lineHeight` y el interlineado
 * calculado en `theme/tokens` es el que se dibuja. Es el ajuste que mas separa una app hecha con
 * cuidado de una app hecha con los valores por defecto.
 */
const render: TextStyle = Platform.OS === 'android' ? { includeFontPadding: false } : {};

/**
 * Tope de ampliacion del texto del sistema, POR ROL.
 *
 * El ajuste de «texto mas grande» del telefono llega hasta el 235 %. A ese factor, `Bs 12.480,50`
 * en `amountHero` mide mas que el ancho de la pantalla y se corta por la mitad: quien necesita el
 * texto grande acaba viendo MENOS de su saldo que quien no lo necesita. Por eso lo que ya es
 * grande —titulares e importes— se limita, y lo que se lee de verdad —cuerpo, apuntes, etiquetas,
 * que es donde la ampliacion de verdad sirve— se deja crecer sin tope.
 *
 * No es una excepcion de accesibilidad: es lo contrario. Un importe recortado no es accesible por
 * ser grande.
 */
const MAX_SCALE: Partial<Record<TypeVariant, number>> = {
  display: 1.3,
  hero: 1.3,
  h1: 1.4,
  h2: 1.5,
  amountHero: 1.3,
  amount: 1.4,
};

export function AtlasText({
  variant = 'body',
  tone = 'primary',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: TextTone; align?: TextStyle['textAlign'] }) {
  return (
    <Text
      {...rest}
      {...webData('texto', { variant })}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_SCALE[variant]}
      style={[type[variant] as TextStyle, render, { color: TONE[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}

/**
 * Antetitulo: la etiqueta en versalitas que dice de QUE es el bloque de debajo.
 *
 * La caja alta la pone ESTE componente con `textTransform`, no el literal del contenido. Escribir
 * «FINANCIADO» en el texto —que es como estaba repartido por media app— tiene tres costes que no se
 * ven en una captura: el lector de pantalla lo deletrea letra a letra, la traduccion hereda unas
 * mayusculas que en otro idioma pueden no corresponder, y el interletraje se queda sin corregir,
 * que es lo que hace que una versalita se lea apretada y sucia.
 *
 * El tono por defecto es `secondary`, no `tertiary`. A 11 px, `tertiary` sobre el navy se queda por
 * debajo del contraste que pide un texto normal, y un antetitulo no es decorativo: es lo que dice de
 * QUE es la cifra que tiene debajo. Lo que lo separa del titulo no puede ser que se lea peor, sino
 * que sea mas pequeno y vaya en versalitas.
 */
export function Overline({
  children,
  tone = 'secondary',
  style,
  ...rest
}: TextProps & { tone?: TextTone }) {
  return (
    <Text {...rest} {...webData('eyebrow')} style={[type.overline as TextStyle, render, styles.overline, { color: TONE[tone] }, style]}>
      {children}
    </Text>
  );
}

/* ----------------------------------------------------------------- boton */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const esPromesa = (valor: unknown): valor is Promise<unknown> =>
  typeof valor === 'object' && valor !== null && typeof (valor as { then?: unknown }).then === 'function';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  haptic = 'light',
  icon,
  blockedReason,
  bitacora,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  label: string;
  /**
   * Codigo del control en la bitacora del alta (`features/bitacora/tipos.ts`). Sin el, el boton no
   * anota nada: solo los botones del alta llevan codigo, y lo llevan a proposito.
   */
  bitacora?: string;
  variant?: ButtonVariant;
  loading?: boolean;
  haptic?: 'none' | 'light' | 'success' | 'warning';
  /**
   * Un nombre del set de iconos (`'camara'`) o un nodo propio. Con nombre, el icono toma el color de
   * la variante —el mismo que el texto— y no hay que pasar `tint` a mano.
   */
  icon?: IconName | React.ReactNode;
  /**
   * Por que el boton no responde.
   *
   * Un boton apagado sin explicacion convierte un formulario en un acertijo: el cliente ve la
   * pantalla llena —a menudo porque un placeholder se parece a un valor— y no tiene de donde tirar.
   * Cuando se bloquea por validacion, el motivo es obligatorio en la practica aunque el tipo lo deje
   * opcional: `disabled` sin motivo solo se justifica mientras hay una operacion en curso.
   */
  blockedReason?: string | null;
  style?: ViewStyle;
}) {
  /*
    «Cargando» tambien lo decide el propio boton.

    Si `onPress` devuelve una promesa —una funcion `async`, o `() => guardar()`— el boton se queda
    en el spinner hasta que acaba, aunque la pantalla no haya cableado `loading`. Sin esto, media app
    pulsaba un boton, esperaba la red sin ningun cambio visible y la persona concluia que no
    funcionaba y volvia a tocar. `loading` sigue mandando cuando la pantalla lo pasa.
  */
  const [pendiente, setPendiente] = React.useState(false);
  const montado = React.useRef(true);
  React.useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cargando = loading || pendiente;
  const isBlocked = disabled || cargando;
  const disposicion = useDisposicion();

  // Un doble toque en una accion financiera no puede producir dos operaciones. La clave de
  // idempotencia del cliente cubre el servidor; esto cubre la interfaz.
  const handlePress: PressableProps['onPress'] = (event) => {
    if (isBlocked) return;
    if (haptic !== 'none' && Platform.OS !== 'web') {
      const notification =
        haptic === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : haptic === 'warning'
            ? Haptics.NotificationFeedbackType.Warning
            : null;
      if (notification) void Haptics.notificationAsync(notification);
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const resultado = onPress?.(event) as unknown;
    if (esPromesa(resultado)) {
      setPendiente(true);
      const terminar = () => {
        if (montado.current) setPendiente(false);
      };
      // El rechazo se relanza: quitar el spinner no puede esconder un fallo que antes se veia.
      void resultado.then(terminar, (fallo: unknown) => {
        terminar();
        throw fallo;
      });
    }
  };

  const showReason = Boolean(blockedReason) && disabled && !cargando;

  /*
    La accion principal se pinta con el DEGRADADO de la marca y lleva halo, no un relleno plano.

    Es la firma visual de la identidad publicada, y es lo que separa un boton que parece una
    superficie iluminada de un rectangulo pintado de menta. El halo se reserva a esta variante: si
    dos elementos de la misma pantalla brillan, no brilla ninguno.

    Bloqueado NO lleva ninguna de las dos cosas. Un boton apagado que sigue brillando invita a
    pulsarlo, y ese es justo el malentendido que la pantalla trata de evitar.
  */
  const isLitPrimary = variant === 'primary' && !isBlocked;

  /*
    El hundimiento: escala y opacidad juntas, con muelle sobreamortiguado.

    Van juntas porque solas se leen mal. La escala sola, a 0.97, casi no se ve en un boton ancho
    —el desplazamiento del borde es de un pixel—; la opacidad sola parece que el boton se apaga en
    vez de recibir el toque. Combinadas, el boton se lee como una superficie que CEDE.
  */
  const reduced = useReducedMotion();
  const pressProgress = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressProgress.value * (1 - press.scale) }],
    opacity: 1 - pressProgress.value * 0.12,
  }));

  const setPressed = (down: boolean) => {
    if (reduced || isBlocked) return;
    pressProgress.value = withSpring(down ? 1 : 0, spring.press);
  };

  const pressable = (
    <AnimatedPressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityHint={showReason ? (blockedReason ?? undefined) : rest.accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: cargando }}
      disabled={isBlocked}
      onPress={handlePress}
      onLayout={(event) => {
        disposicion.onLayout(event);
        rest.onLayout?.(event);
      }}
      onPressIn={(event) => {
        setPressed(true);
        // El toque se anota aunque el boton este bloqueado: tocar un boton apagado es informacion.
        medirToque(bitacora, event, disposicion.actual);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        rest.onPressOut?.(event);
      }}
      {...webData('btn', { variant })}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'destructive' && styles.buttonDestructive,
        isLitPrimary && styles.buttonLit,
        isBlocked && styles.buttonDisabled,
        showReason ? undefined : style,
        pressStyle,
      ]}
    >
      {isLitPrimary ? (
        <LinearGradient
          colors={[palette.brand300, palette.brand400, palette.brand500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/*
        Cargando: el spinner SUSTITUYE al icono, no a todo el contenido. Antes el boton entero se
        quedaba en un circulo suelto y la persona perdia el rotulo de lo que acababa de pulsar.
      */}
      <View style={styles.buttonInner}>
          {cargando ? (
            <ActivityIndicator size="small" color={variant === 'primary' ? color.text.onBrand : color.text.primary} />
          ) : typeof icon === 'string' ? (
            <Icon
              name={icon as IconName}
              size={18}
              tint={variant === 'primary' ? color.text.onBrand : variant === 'destructive' ? color.feedback.danger : color.text.primary}
            />
          ) : (
            icon
          )}
          <AtlasText
            variant="bodyStrong"
            tone={variant === 'primary' ? 'onBrand' : variant === 'destructive' ? 'danger' : 'primary'}
            style={isBlocked ? styles.buttonLabelDisabled : undefined}
          >
            {label}
          </AtlasText>
        </View>
    </AnimatedPressable>
  );

  if (!showReason) return pressable;

  return (
    <View style={[styles.buttonBlock, style]}>
      {pressable}
      {/*
        El motivo va DEBAJO y no dentro: dentro obligaria a que la etiqueta cambiara de longitud y el
        boton diera un salto cada vez que se completa un campo. Debajo, el boton se queda quieto y el
        aviso aparece y desaparece sin mover nada de lo que hay encima.
      */}
      {/*
        GUIA, no alarma.

        Iba en ambar y con el triangulo de aviso, y como aparece en cuanto la pantalla se abre —un
        formulario vacio siempre tiene algo que falta— lo primero que veia cualquiera al entrar a
        «Ingresar» era una linea de alerta debajo del boton, sin haber tocado nada. Una advertencia
        que sale antes de que la persona pueda equivocarse deja de significar «revisa esto» y pasa a
        significar «esta app viene rota de fabrica», que es lo que se sentia.

        Lo que falta no es un error: es la instruccion siguiente. Va en el tono del texto secundario
        y con el simbolo de informacion. Cuando hay un error DE VERDAD se pinta donde corresponde
        —el campo en rojo y `ErrorState` arriba—, y entonces el ambar vuelve a querer decir algo.
      */}
      <View style={styles.buttonReason}>
        <Icon name="info" size={15} tint={color.text.secondary} />
        <AtlasText variant="caption" tone="secondary" style={styles.buttonReasonText}>
          {blockedReason}
        </AtlasText>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ card */

/**
 * Tono de una tarjeta: de que color es su contorno.
 *
 * Existe porque media app estaba declarando `{ borderColor: color.feedback.danger, borderWidth: 1 }`
 * en su propia hoja de estilos para pintar el aviso de mora, y cada pantalla elegia una opacidad
 * distinta para el borde. Un aviso que se ve de un color en Inicio y de otro en Pagos deja de leerse
 * como el MISMO aviso, que es justo lo que un aviso tiene que conseguir.
 */
export type CardTone = 'default' | 'danger' | 'warning' | 'success' | 'brand';

/** Cuanto aire lleva la tarjeta por dentro. `none` es para tarjetas que solo contienen filas. */
export type CardPadding = 'base' | 'tight' | 'none';

export function Card({
  tone = 'default',
  padding = 'base',
  style,
  children,
  ...rest
}: ViewProps & { tone?: CardTone; padding?: CardPadding; style?: ViewStyle }) {
  /*
    El filo superior es 1 px más claro que el resto del contorno.

    Es como se lee una superficie fisica: la luz viene de arriba y el canto la recoge. Sin el, una
    tarjeta oscura sobre un fondo oscuro es un rectangulo con borde, y toda la pantalla se aplana
    por mucha sombra que se le ponga debajo.

    Con tono, el filo se apaga: un contorno de aviso que ademas se ilumina por arriba pierde el
    color justo en el canto que mas se mira.
  */
  return (
    <View
      {...rest}
      {...webData('card')}
      style={[
        styles.card,
        padding === 'tight' && styles.cardTight,
        padding === 'none' && styles.cardFlush,
        tone !== 'default' && CARD_TONE[tone],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const CARD_TONE: Record<Exclude<CardTone, 'default'>, ViewStyle> = {
  danger: { borderColor: color.feedbackBorder.danger, borderTopColor: color.feedbackBorder.danger },
  warning: { borderColor: color.feedbackBorder.warning, borderTopColor: color.feedbackBorder.warning },
  success: { borderColor: color.feedbackBorder.success, borderTopColor: color.feedbackBorder.success },
  brand: { borderColor: color.feedbackBorder.brand, borderTopColor: color.feedbackBorder.brand },
};

/**
 * Chip de icono: el cuadrado redondeado que acompana a un titulo o a una fila.
 *
 * Estaba copiado en cinco pantallas con cinco medidas distintas —40x40 aqui, 36x36 alla, un radio
 * `md` en una y `lg` en otra—, y esa clase de deriva es exactamente lo que hace que dos pantallas
 * de la misma app parezcan de dos apps. Un icono suelto sobre el fondo, ademas, no tiene con que
 * alinearse verticalmente contra un titulo de dos lineas; el chip si.
 */
export function IconChip({
  name,
  tone = 'brand',
  size = 'md',
  style,
}: {
  name: IconName;
  tone?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}) {
  const box = size === 'sm' ? 32 : size === 'lg' ? 48 : 40;
  const glyph = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  const tint = tone === 'brand' ? color.action.primary : tone === 'neutral' ? color.text.secondary : color.feedback[tone];
  return (
    <View
      style={[
        styles.iconChip,
        { width: box, height: box, borderRadius: size === 'sm' ? radius.md : radius.lg },
        { backgroundColor: color.feedbackSoft[tone === 'brand' ? 'success' : tone] },
        style,
      ]}
    >
      <Icon name={name} size={glyph} tint={tint} />
    </View>
  );
}

/**
 * Cabecera de una tarjeta: chip opcional, titulo, apunte y UNA cosa a la derecha.
 *
 * Recoge el patron que estaba escrito a mano en casi todas las pantallas —una fila con
 * `justifyContent: 'space-between'`, un `h3` a la izquierda, un `Badge` a la derecha y un `Divider`
 * debajo—. Escrito a mano, cada pantalla elegia su propio hueco entre el titulo y la linea, y el
 * resultado era que ninguna tarjeta empezaba a la misma altura que su vecina.
 */
export function CardHeader({
  title,
  detail,
  eyebrow,
  icon,
  iconTone,
  trailing,
  divider = true,
}: {
  title: string;
  detail?: string;
  eyebrow?: string;
  icon?: IconName;
  iconTone?: React.ComponentProps<typeof IconChip>['tone'];
  trailing?: React.ReactNode;
  /** La linea de debajo. Se quita cuando la tarjeta no tiene cuerpo que separar. */
  divider?: boolean;
}) {
  return (
    <>
      <View style={styles.cardHeader}>
        {icon ? <IconChip name={icon} tone={iconTone} size="sm" /> : null}
        <View style={styles.cardHeaderText}>
          {eyebrow ? <Overline>{eyebrow}</Overline> : null}
          {/*
            Dos lineas como maximo. El titulo de una tarjeta suele ser un dato del servidor —el
            nombre de un comercio—, y «CPA Centro de Preparacion Academica» a 17 px ocupa TRES
            renglones: la cabecera crece hasta triplicar su alto, la pastilla de estado que va a su
            derecha queda flotando junto al primero de los tres, y la tarjeta deja de empezar a la
            misma altura que las de arriba y abajo. Se ve en la captura de «Tus pagos».
          */}
          <AtlasText variant="h3" numberOfLines={2}>
            {title}
          </AtlasText>
          {detail ? (
            <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
              {detail}
            </AtlasText>
          ) : null}
        </View>
        {/*
          Lo de la derecha no se encoge. Sin esto, un titulo largo le roba ancho a la pastilla hasta
          partirle la palabra —«EN / MORA»—, que es peor que recortar el titulo: el estado es UNA
          palabra corta y es lo que se lee de reojo.
        */}
        {trailing ? <View style={styles.cardHeaderTrailing}>{trailing}</View> : null}
      </View>
      {divider ? <Divider /> : null}
    </>
  );
}

/**
 * Titulo de una SECCION de la pantalla: lo que va entre tarjetas, no dentro de una.
 *
 * Antes esto era un `AtlasText variant="h3"` suelto en mitad del desplazamiento —«Tus compras»,
 * «Tus pagos»—, con el mismo estilo exacto que el titulo que llevaban las tarjetas de debajo. Dos
 * niveles distintos de la jerarquia dibujados igual no son jerarquia: son ruido con el que el ojo
 * no sabe si esta empezando un bloque o leyendo uno.
 */
export function SectionHeader({
  title,
  eyebrow,
  detail,
  action,
  style,
}: {
  title: string;
  eyebrow?: string;
  detail?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionHeader, style]} {...webData('seccion')}>
      <View style={styles.sectionHeaderText}>
        {eyebrow ? <Overline>{eyebrow}</Overline> : null}
        <AtlasText variant="h2" numberOfLines={2}>
          {title}
        </AtlasText>
        {detail ? (
          <AtlasText variant="caption" tone="secondary">
            {detail}
          </AtlasText>
        ) : null}
      </View>
      {action ? <View style={styles.sectionHeaderAction}>{action}</View> : null}
    </View>
  );
}

/**
 * Una cifra con su etiqueta. La unidad minima de un tablero.
 *
 * La etiqueta va ARRIBA y en versalitas, y el dato debajo en la familia de titulares. Al reves
 * —etiqueta grande, dato pequeno— es como se leia la app: el ojo aterrizaba en la palabra
 * «financiado» y tenia que buscar el numero, que es lo unico que se habia venido a mirar.
 */
export function Stat({
  label,
  value,
  tone = 'primary',
  hint,
  size = 'md',
  style,
}: {
  label: string;
  value: string;
  tone?: TextTone;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.stat, style]}>
      <Overline>{label}</Overline>
      <AtlasText variant={size === 'lg' ? 'amount' : size === 'sm' ? 'amountMicro' : 'amountSmall'} tone={tone}>
        {value}
      </AtlasText>
      {hint ? (
        <AtlasText variant="caption" tone="tertiary">
          {hint}
        </AtlasText>
      ) : null}
    </View>
  );
}

/**
 * Varias cifras en una fila, separadas por un filo vertical.
 *
 * El filo no es adorno: dos cifras separadas solo por un hueco se leen como una sola magnitud
 * partida en dos, sobre todo cuando comparten formato de moneda. La linea dice que son dos
 * respuestas a dos preguntas distintas.
 */
export function StatRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.statRow, style]}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={styles.statRule} /> : null}
          <View style={styles.statCell}>{child}</View>
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Etiqueta a la izquierda, valor a la derecha. La fila de un detalle.
 *
 * El valor va en la familia de titulares cuando es una cifra (`numeric`) para que una columna de
 * datos se pueda recorrer de arriba abajo sin que las cifras bailen. El texto corriente se queda en
 * Manrope: un nombre propio en versalitas de titular se lee como un grito.
 */
export function KeyValue({
  label,
  value,
  numeric = false,
  tone = 'primary',
  children,
}: {
  label: string;
  value?: string;
  numeric?: boolean;
  tone?: TextTone;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.keyValue}>
      <AtlasText variant="caption" tone="secondary" style={styles.keyValueLabel}>
        {label}
      </AtlasText>
      {children ?? (
        <AtlasText variant={numeric ? 'amountMicro' : 'captionStrong'} tone={tone} align="right" style={styles.keyValueValue}>
          {value}
        </AtlasText>
      )}
    </View>
  );
}

/**
 * Panel de marca: la unica superficie de la app que lleva el degradado de ATLAS.
 *
 * ## Por que existe, y por que solo una
 *
 * El degradado azul -> teal -> menta es la firma de la identidad. Repetirlo en cada tarjeta lo
 * convertiria en papel pintado: cuando todo destaca, no destaca nada. Se gasta entero en la
 * superficie que responde la pregunta con la que se abre la app —cuanto puedo gastar— y el resto
 * de la pantalla se mantiene en el navy plano para que esa sea la que el ojo encuentra primero.
 *
 * ## Por que un lavado y no un plano saturado
 *
 * Sobre el degradado vivo el texto claro pierde contraste en el extremo menta, y el oscuro lo
 * pierde en el navy: no hay un solo color de texto que aguante todo el recorrido. Se usa el
 * lavado tenue de la identidad (`--g-soft` en la web), que tine la superficie sin mover el
 * contraste, y el degradado pleno se reserva para el filo.
 *
 * ## El filo
 *
 * React Native no tiene bordes con degradado. El truco es un degradado de 1 px de grosor con la
 * superficie encima: lo que asoma por el contorno ES el borde. Se hace aqui una vez para que
 * ninguna pantalla tenga que conocerlo.
 */
export function BrandPanel({ style, children, ...rest }: ViewProps & { style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={[palette.brand500, palette.brand400, palette.brand700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.55, 1]}
      style={[styles.brandPanelEdge, style]}
    >
      {/*
        La superficie es OPACA antes de recibir el tinte. El lavado se define con alfa, y sin una
        base opaca debajo lo que se ve por transparencia es el degradado del filo: la tarjeta se
        convierte en un plano menta saturado y el texto secundario deja de leerse encima. La base
        navy es lo que mantiene el contraste mientras el tinte solo insinua la marca.
      */}
      <View style={styles.brandPanelSurface}>
        <LinearGradient
          colors={[color.brandWash.from, color.brandWash.to]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View {...rest} style={styles.brandPanelContent}>
          {children}
        </View>
      </View>
    </LinearGradient>
  );
}

export function Divider({ inset = false, style }: { inset?: boolean; style?: ViewStyle }) {
  /*
    `inset` alinea la linea con el TEXTO de la fila, no con el borde de la tarjeta.

    Es la convencion de las listas del sistema en ambas plataformas, y dice algo cierto: una linea
    que empieza donde empieza el texto separa dos filas de la misma lista; una que va de borde a
    borde separa dos bloques distintos. Usar la misma para las dos cosas obliga a leer el contenido
    para saber cual de las dos separaciones se esta mirando.
  */
  return <View style={[styles.divider, inset && styles.dividerInset, style]} />;
}

/* ----------------------------------------------------------------- badge */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  /**
   * El punto de color delante del texto.
   *
   * Sirve para lo que cambia de estado —una cuota que pasa de «al dia» a «vencida»—: el color del
   * fondo de una pastilla al 14 % de opacidad es demasiado tenue para que el cambio se note de
   * reojo, y subirlo obligaria a repintar el texto. Un punto pleno de 6 px si se ve.
   */
  dot?: boolean;
  style?: ViewStyle;
}) {
  const background = color.feedbackSoft[tone];
  const foreground =
    tone === 'neutral'
      ? color.text.secondary
      : tone === 'info'
        ? color.feedback.info
        : color.feedback[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: foreground }]} /> : null}
      {/*
        La caja alta la pone `textTransform`, no el literal. Con el texto ya en mayusculas, el
        lector de pantalla anuncia «V-E-N-C-I-D-A» deletreado; asi anuncia la palabra.
      */}
      <Text
        style={[type.micro as TextStyle, render, styles.badgeLabel, { color: foreground }]}
        /*
          La pastilla no crece con el texto del sistema: su alto lo fijan el radio de pildora y el
          relleno, y a partir de ~1,3x la palabra se sale por los lados en vez de ensancharla.
        */
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------ desplegable */

/**
 * Pregunta que se abre para dar su respuesta.
 *
 * ## Por que la ayuda no puede ser seis respuestas apiladas
 *
 * Porque quien entra en «Ayuda» ya tiene UNA pregunta, no seis. Con las seis respuestas abiertas,
 * encontrar la propia obliga a recorrer varias pantallas de texto leyendo cinco que no importan —y
 * cuanto mejor escritas esten las otras, mas cuesta—. Plegadas, la lista de preguntas cabe de un
 * vistazo y es un indice: el gesto de elegir sustituye al de buscar.
 *
 * ## Lo que se mueve, y lo que no
 *
 * La flecha gira; el contenido aparece y desaparece. NO se anima la altura: animar altura en React
 * Native obliga a medir el contenido y a redibujar en cada fotograma desde el hilo de JS, y en una
 * pantalla que ademas esta cargando texto del servidor eso se ve como un tiron. Un giro de 90° es
 * suficiente para que el gesto se lea como abrir y cerrar, y corre en el hilo de UI.
 */
export function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const reduced = useReducedMotion();
  const progress = useSharedValue(defaultOpen ? 1 : 0);

  React.useEffect(() => {
    progress.value = reduced ? (open ? 1 : 0) : withSpring(open ? 1 : 0, spring.settle);
  }, [open, reduced, progress]);

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 90}deg` }] }));

  return (
    <View>
      <PressSurface
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((current) => !current)}
        scaleTo={press.scaleSubtle}
        style={styles.accordionHeader}
      >
        <AtlasText variant="h3" style={styles.accordionTitle}>
          {title}
        </AtlasText>
        <Reanimated.View style={chevron}>
          <Icon name="adelante" size={18} tint={color.text.tertiary} />
        </Reanimated.View>
      </PressSurface>
      {open ? (
        <View style={styles.accordionBody}>
          <Divider />
          {children}
        </View>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- avatar */

/**
 * Las iniciales de quien esta usando la app.
 *
 * No es decoracion: es la unica pieza de Perfil que dice «esta es TU cuenta» sin tener que leer.
 * Se dibujan las iniciales y no una foto porque la app no pide ninguna —y un icono de persona
 * generico dice exactamente lo mismo para todo el mundo, que es lo contrario de lo que hace falta
 * aqui—.
 *
 * El degradado es el de la marca a la inversa del boton principal: el circulo pesa poco y no
 * compite con la accion, pero pertenece al mismo sistema.
 */
export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <LinearGradient
      colors={[palette.brand500, palette.brand700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text
        // Decorativo para el lector de pantalla: el nombre completo esta escrito al lado, y
        // deletrear «V M» antes de leerlo solo estorba.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[type.h2 as TextStyle, { color: color.text.primary, fontSize: size * 0.34, lineHeight: size * 0.42 }]}
      >
        {initials || '·'}
      </Text>
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ chips */

/**
 * Chip de filtro. Se TINE al elegirse; no se rellena.
 *
 * Es la misma regla que ya gobierna las opciones de un formulario en esta app, y estaba sin aplicar
 * justo donde mas se nota: rellenos de menta plena, los cuatro filtros de Pagos ponian en pantalla
 * cuatro bloques del color de la accion principal, y el boton que de verdad manda —«Ver que debo
 * regularizar»— dejaba de destacar. Cuando dos elementos gritan igual, pierde el que tenia que
 * mandar.
 *
 * El area tactil es lo otro que estaba mal: 4 px de relleno vertical dejaban el chip en 27 px de
 * alto, muy por debajo del minimo de 48 que la app declara en `touch.minSize`. Se paga con
 * `hitSlop` y no con relleno para que la fila de filtros no crezca hasta parecer una barra de
 * pestanas.
 */
export function Chip({
  label,
  icon,
  selected = false,
  count,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  /** Cuantos hay detras del filtro. Un filtro que lleva a cero deja de ser una sorpresa. */
  count?: number;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const tint = selected ? color.action.primary : color.text.secondary;
  return (
    <PressSurface
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      hitSlop={{ top: space.sm, bottom: space.sm, left: space.xs, right: space.xs }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      scaleTo={press.scale}
    >
      {icon ? <Icon name={icon} size={15} tint={tint} /> : null}
      <Text style={[type.micro as TextStyle, render, { color: tint }]} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text
          style={[type.micro as TextStyle, render, { color: selected ? color.action.primary : color.text.tertiary }]}
          maxFontSizeMultiplier={1.3}
        >
          {count}
        </Text>
      ) : null}
    </PressSurface>
  );
}

/** La fila donde viven los chips. Existe para que ninguna pantalla vuelva a elegir su propio hueco. */
export function ChipBar({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.chipBar, style]}>{children}</View>;
}

/* -------------------------------------------------------------- progreso */

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={label ?? `Avance ${clamped}%`}
    >
      <View style={styles.progressTrack}>
        {/*
          El relleno lleva el degradado de la marca, no un menta plano. Es el único elemento que el
          cliente vuelve a ver entre paso y paso del registro, así que es donde el avance se siente
          como avance y no como una barra de sistema.
        */}
        <LinearGradient
          colors={[palette.brand500, palette.brand400, palette.brand300]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${clamped}%` }]}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- skeletons */

/**
 * Placeholder con la geometria aproximada del contenido final.
 *
 * No es un spinner generico a proposito: un esqueleto que se parece a lo que viene reduce el salto
 * visual cuando llegan los datos.
 */
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  // Reanimated y no `Animated`: corre en el hilo de UI, así que el pulso no se entrecorta mientras la
  // pantalla parsea la respuesta que justamente se está esperando. Con movimiento reducido no pulsa.
  const reduced = useReducedMotion();
  const pulse = useSharedValue(reduced ? 0.6 : 0.4);

  React.useEffect(() => {
    if (reduced) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Reanimated.View accessibilityElementsHidden importantForAccessibility="no" style={[styles.skeleton, { height, width }, style, animated]} />;
}

/** Varias filas de esqueleto: la forma de una lista que todavía no llegó. */
export function SkeletonLista({ filas = 3, alto = 56 }: { filas?: number; alto?: number }) {
  return (
    <View style={{ gap: space.sm }}>
      {Array.from({ length: filas }, (_, indice) => (
        <Skeleton key={indice} height={alto} />
      ))}
    </View>
  );
}

/**
 * El círculo de «cargando».
 *
 * Para las esperas que no tienen forma de lista —abrir una conversación, pedir un QR, subir una
 * foto—. Un esqueleto sin nada que imitar es ruido; un círculo con una frase dice QUÉ se espera.
 * Es lo que evita que una espera se lea como un fallo: antes se veía el texto de «vacío» o de
 * «error» mientras la respuesta aún venía en camino.
 */
export function Cargando({ texto, bloque = false }: { texto?: string; bloque?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={texto ?? 'Cargando'}
      accessibilityState={{ busy: true }}
      style={bloque ? styles.cargandoBloque : styles.cargandoFila}
    >
      <ActivityIndicator size={bloque ? 'large' : 'small'} color={color.action.primary} />
      {texto ? (
        <AtlasText variant="body" tone="secondary" align={bloque ? 'center' : undefined}>
          {texto}
        </AtlasText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- estados */

export function EmptyState({
  title,
  detail,
  icon,
  action,
}: {
  title: string;
  detail: string;
  /**
   * El dibujo de lo que todavia no hay.
   *
   * Un hueco vacio con dos parrafos dentro se lee como un error de carga. Con el icono del concepto
   * que falta —una compra, un aviso— se lee como lo que es: un sitio que aun no se ha llenado.
   */
  icon?: IconName;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.stateBox}>
      {icon ? <IconChip name={icon} tone="neutral" size="lg" style={styles.stateIcon} /> : null}
      <AtlasText variant="h3" align="center">
        {title}
      </AtlasText>
      <AtlasText variant="body" tone="secondary" align="center" style={styles.stateDetail}>
        {detail}
      </AtlasText>
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({
  title,
  detail,
  reference,
  onRetry,
  actions,
}: {
  title: string;
  detail: string;
  reference?: string | null;
  onRetry?: () => void;
  /**
   * La salida, cuando el error tiene una.
   *
   * «Reintentar» solo sirve si el problema es pasajero. Hay errores que NO se arreglan repitiendo
   * —ya tienes cuenta, estas bloqueado hasta las 21:14— y para esos el boton correcto es otro. Sin
   * este hueco, esos errores se quedaban en un texto rojo y un callejon.
   */
  actions?: React.ReactNode;
}) {
  return (
    <View style={[styles.stateBox, styles.stateBoxError]}>
      <AtlasText variant="h3" tone="danger">
        {title}
      </AtlasText>
      <AtlasText variant="body" tone="secondary" style={styles.stateDetail}>
        {detail}
      </AtlasText>
      {reference ? (
        <AtlasText variant="caption" tone="tertiary" style={styles.stateReference}>
          Referencia: {reference}
        </AtlasText>
      ) : null}
      {onRetry ? (
        <View style={styles.stateAction}>
          <Button label="Reintentar" icon="refrescar" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
      {actions ? <View style={styles.stateAction}>{actions}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ fila */

export function ListRow({
  title,
  subtitle,
  right,
  icon,
  onPress,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  /**
   * Icono a la izquierda. Opcional a proposito: una lista donde cada fila lleva icono obliga a
   * inventar uno para conceptos que no lo tienen, y un icono inventado se lee como ruido. Se pone
   * donde ayuda a encontrar la fila de un vistazo, y se omite donde no.
   */
  icon?: IconName;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const content = (
    <View style={styles.row}>
      {/*
        El icono va en su chip, como en cualquier otra fila de la app. Suelto sobre el fondo no
        tiene con que alinearse contra un titulo de dos lineas y la lista se descuadra en cuanto un
        nombre de comercio no cabe.
      */}
      {icon ? <IconChip name={icon} tone="neutral" size="sm" /> : null}
      <View style={styles.rowText}>
        <AtlasText variant="title" numberOfLines={2}>
          {title}
        </AtlasText>
        {subtitle ? (
          <AtlasText variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AtlasText>
        ) : null}
      </View>
      {/* Lo de la derecha de una fila es casi siempre un importe: no se parte ni se encoge. */}
      {right ? <View style={styles.rowTrailing}>{right}</View> : null}
      {/* La punta de flecha solo aparece si la fila lleva a algun sitio: es la unica senal fiable de
          que se puede tocar cuando no hay ninguna otra affordance. */}
      {onPress && !right ? <Icon name="adelante" size={18} tint={color.text.tertiary} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressSurface
      {...webData('fila')}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      scaleTo={press.scaleSubtle}
    >
      {content}
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touch.minSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonSecondary: { backgroundColor: color.action.secondary, borderWidth: 1, borderColor: color.border.subtle },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDestructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.feedback.danger },
  // `overflow: hidden` recorta el degradado al radio de la pildora; sin el, asoma por las esquinas.
  buttonLit: { backgroundColor: color.action.primary, overflow: 'hidden', ...shadow.brandGlow },
  buttonDisabled: { backgroundColor: color.action.disabled },
  /*
    La etiqueta de un boton apagado es texto que HAY que poder leer: dice que accion espera ahi
    cuando se desbloquee. En `tertiary` sobre el relleno del deshabilitado medía 3,0:1 —por debajo
    de AA— y el boton se leia como una mancha gris sin palabra dentro, que es como se veia el
    «Ingresar» del acceso antes de escribir nada. En `secondary` mide 5,8:1 y sigue estando
    claramente apagado respecto del activo, que es lo unico que tiene que comunicar.
  */
  buttonLabelDisabled: { color: color.text.secondary },

  buttonBlock: { gap: space.sm },
  buttonReason: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  buttonReasonText: { flex: 1 },
  card: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  cardTight: { padding: space.base, gap: space.sm },
  cardFlush: { padding: 0, gap: 0, overflow: 'hidden' },

  // El filo: 1 px de degradado que asoma por el contorno de la superficie.
  brandPanelEdge: { borderRadius: radius.xxl, padding: 1 },
  brandPanelSurface: { borderRadius: radius.xxl - 1, overflow: 'hidden', backgroundColor: color.surface.secondary },
  brandPanelContent: { padding: space.lg, gap: space.md },
  /*
    El divisor va al ras de la tarjeta y con MENOS aire del que tenia.

    Con `marginVertical: space.md` a cada lado, cada fila quedaba flotando en su propio bloque y la
    tarjeta se leia como un menu de ajustes del sistema. Lo que agrupa una lista es la proximidad;
    la línea solo tiene que separar, no abrir un hueco.
  */
  /*
    El aire de la linea se cuenta DOS veces, y por eso mide la mitad.

    Casi todos los divisores viven dentro de una tarjeta, y una tarjeta ya separa a sus hijos con
    `gap: space.md`. Con `marginVertical: space.sm` encima, entre el titulo y la linea quedaban 20 px
    y otros 20 hasta el contenido: cuarenta de aire alrededor de un pixel. Eso es lo que hacia que
    una tarjeta con cabecera se leyera como tres bloques sueltos con una raya en medio en vez de como
    un bloque con su titulo.
  */
  divider: { height: stroke.hairline, backgroundColor: color.border.hairline, marginVertical: space.xs },
  // 32 + 12: el ancho del chip de icono pequeno mas el hueco de la fila. La linea arranca justo
  // debajo de la primera letra del titulo.
  dividerInset: { marginLeft: 32 + space.md },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 6, height: 6, borderRadius: radius.pill },
  badgeLabel: { textTransform: 'uppercase' },

  overline: { textTransform: 'uppercase' },

  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: touch.minSize },
  accordionTitle: { flex: 1 },
  accordionBody: { gap: space.md, paddingBottom: space.xs },

  avatar: { alignItems: 'center', justifyContent: 'center' },

  chipBar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
  },
  chipSelected: { borderColor: color.border.focus, backgroundColor: color.feedbackSoft.success },

  iconChip: { alignItems: 'center', justifyContent: 'center' },

  /*
    La cabecera de tarjeta se alinea por ARRIBA, no al centro.

    Con `center`, un titulo que pasa a dos lineas empuja el chip y la pastilla de estado hacia el
    medio del bloque, y la fila deja de tener una linea base comun con el resto de la tarjeta. Con
    `flex-start` los tres elementos comparten el borde superior pase lo que pase con el texto.
  */
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardHeaderText: { flex: 1, gap: space.xxs },
  cardHeaderTrailing: { flexShrink: 0 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
    // Se pega al bloque que titula y se despega del que deja atras: la proximidad es lo que dice a
    // cual de los dos pertenece. Sin esto, un titulo a medio camino entre dos tarjetas parece el
    // pie de la de arriba.
    marginTop: space.sm,
    marginBottom: -space.xs,
  },
  sectionHeaderText: { flex: 1, gap: space.xxs },
  sectionHeaderAction: { flexShrink: 0 },

  stat: { gap: space.xxs },
  statRow: { flexDirection: 'row', alignItems: 'stretch' },
  statCell: { flex: 1 },
  // El filo entre dos cifras. `alignSelf: 'stretch'` para que mida lo que mida la mas alta de las
  // dos y no haya que darle una altura fija que se quede corta en cuanto una lleve apunte.
  statRule: { width: stroke.hairline, alignSelf: 'stretch', backgroundColor: color.border.hairline, marginHorizontal: space.base },

  keyValue: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.base, minHeight: 24 },
  // La etiqueta cede el ancho antes que el valor: en un detalle de credito, lo que no puede partirse
  // en dos lineas es la cifra.
  keyValueLabel: { flexShrink: 1 },
  keyValueValue: { flexShrink: 0 },

  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.action.primary },

  cargandoFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cargandoBloque: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xl },
  skeleton: { borderRadius: radius.md, backgroundColor: color.surface.raisedStrong },

  stateBox: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    backgroundColor: color.surface.raised,
    padding: space.xl,
    gap: space.xs,
    // Centrado: un estado vacio no es un parrafo, es un cartel. Alineado a la izquierda dentro de
    // una tarjeta ancha se lee como si le faltara el contenido de la derecha.
    alignItems: 'center',
    ...shadow.card,
  },
  stateIcon: { marginBottom: space.sm },
  stateBoxError: { borderColor: color.feedbackBorder.danger, borderTopColor: color.feedbackBorder.danger, alignItems: 'stretch' },
  stateDetail: { marginTop: space.xs },
  stateReference: { marginTop: space.sm },
  stateAction: { marginTop: space.base, alignSelf: 'stretch', gap: space.sm },

  row: {
    minHeight: touch.minSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    // Menos aire vertical: la altura minima tactil ya garantiza que la fila se pueda tocar, y el
    // relleno de mas solo separaba cada fila de sus vecinas hasta deshacer la lista.
    paddingVertical: space.sm,
  },
  rowText: { flex: 1, gap: space.xxs },
  rowTrailing: { flexShrink: 0, alignItems: 'flex-end' },
});
