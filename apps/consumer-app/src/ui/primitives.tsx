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
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { color, palette, press, radius, shadow, space, touch, type } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { PressSurface } from './motion';

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

export function AtlasText({
  variant = 'body',
  tone = 'primary',
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: TextTone }) {
  return <Text {...rest} style={[type[variant] as TextStyle, { color: TONE[tone] }, style]} />;
}

/* ----------------------------------------------------------------- boton */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  haptic = 'light',
  icon,
  blockedReason,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  haptic?: 'none' | 'light' | 'success' | 'warning';
  icon?: React.ReactNode;
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
  const isBlocked = disabled || loading;

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
    onPress?.(event);
  };

  const showReason = Boolean(blockedReason) && disabled && !loading;

  /*
    La accion principal se pinta con el DEGRADADO de la marca y lleva halo, no un relleno plano.

    Es la firma visual de la identidad publicada, y es lo que separa un boton que parece una
    superficie iluminada de un rectangulo pintado de menta. El halo se reserva a esta variante: si
    dos elementos de la misma pantalla brillan, no brilla ninguno.

    Bloqueado NO lleva ninguna de las dos cosas. Un boton apagado que sigue brillando invita a
    pulsarlo, y ese es justo el malentendido que la pantalla trata de evitar.
  */
  const isLitPrimary = variant === 'primary' && !isBlocked;

  const pressable = (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityHint={showReason ? (blockedReason ?? undefined) : rest.accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      disabled={isBlocked}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'destructive' && styles.buttonDestructive,
        isLitPrimary && styles.buttonLit,
        pressed && !isBlocked && styles.buttonPressed,
        isBlocked && styles.buttonDisabled,
        showReason ? undefined : style,
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
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.text.onBrand : color.text.primary} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <AtlasText
            variant="bodyStrong"
            tone={variant === 'primary' ? 'onBrand' : variant === 'destructive' ? 'danger' : 'primary'}
            style={isBlocked ? styles.buttonLabelDisabled : undefined}
          >
            {label}
          </AtlasText>
        </View>
      )}
    </Pressable>
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
      <View style={styles.buttonReason}>
        <Icon name="alerta" size={15} tint={color.feedback.warning} />
        <AtlasText variant="caption" tone="warning" style={styles.buttonReasonText}>
          {blockedReason}
        </AtlasText>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ card */

export function Card({ style, children, ...rest }: ViewProps & { style?: ViewStyle }) {
  /*
    El filo superior es 1 px más claro que el resto del contorno.

    Es como se lee una superficie fisica: la luz viene de arriba y el canto la recoge. Sin el, una
    tarjeta oscura sobre un fondo oscuro es un rectangulo con borde, y toda la pantalla se aplana
    por mucha sombra que se le ponga debajo.
  */
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
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

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

/* ----------------------------------------------------------------- badge */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ label, tone = 'neutral', style }: { label: string; tone?: BadgeTone; style?: ViewStyle }) {
  const background = color.feedbackSoft[tone];
  const foreground =
    tone === 'neutral'
      ? color.text.secondary
      : tone === 'info'
        ? color.feedback.info
        : color.feedback[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <Text style={[type.micro as TextStyle, { color: foreground }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- progreso */

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
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
  const pulse = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return <Animated.View style={[styles.skeleton, { height, width, opacity: pulse }, style]} />;
}

/* ------------------------------------------------------------- estados */

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <View style={styles.stateBox}>
      <AtlasText variant="h3">{title}</AtlasText>
      <AtlasText variant="body" tone="secondary" style={styles.stateDetail}>
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
}: {
  title: string;
  detail: string;
  reference?: string | null;
  onRetry?: () => void;
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
          <Button label="Reintentar" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
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
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon name={icon} size={20} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AtlasText variant="bodyStrong">{title}</AtlasText>
        {subtitle ? (
          <AtlasText variant="caption" tone="secondary">
            {subtitle}
          </AtlasText>
        ) : null}
      </View>
      {right}
      {/* La punta de flecha solo aparece si la fila lleva a algun sitio: es la unica senal fiable de
          que se puede tocar cuando no hay ninguna otra affordance. */}
      {onPress && !right ? <Icon name="adelante" size={18} tint={color.text.tertiary} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressSurface
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
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  buttonDisabled: { backgroundColor: color.action.disabled },
  buttonLabelDisabled: { color: color.text.tertiary },

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
  divider: { height: 1, backgroundColor: color.border.subtle, marginVertical: space.sm },

  badge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, alignSelf: 'flex-start' },

  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.action.primary },

  skeleton: { borderRadius: radius.md, backgroundColor: color.surface.raisedStrong },

  stateBox: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    backgroundColor: color.surface.raised,
    padding: space.xl,
    gap: space.xs,
    ...shadow.card,
  },
  stateBoxError: { borderColor: color.feedbackBorder.danger },
  stateDetail: { marginTop: space.xs },
  stateReference: { marginTop: space.sm },
  stateAction: { marginTop: space.base, alignSelf: 'flex-start' },

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
  rowIcon: { width: 28, alignItems: 'flex-start' },
  rowText: { flex: 1, gap: space.xxs },
});
