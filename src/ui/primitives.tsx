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
import { color, radius, shadow, space, touch, type } from '../theme/tokens';

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
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  haptic?: 'none' | 'light' | 'success' | 'warning';
  icon?: React.ReactNode;
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

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      disabled={isBlocked}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'destructive' && styles.buttonDestructive,
        pressed && !isBlocked && styles.buttonPressed,
        isBlocked && styles.buttonDisabled,
        style,
      ]}
    >
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
}

/* ------------------------------------------------------------------ card */

export function Card({ style, children, ...rest }: ViewProps & { style?: ViewStyle }) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
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
        <View style={[styles.progressFill, { width: `${clamped}%` }]} />
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
  onPress,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <AtlasText variant="bodyStrong">{title}</AtlasText>
        {subtitle ? (
          <AtlasText variant="caption" tone="secondary">
            {subtitle}
          </AtlasText>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
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
  buttonPrimary: { backgroundColor: color.action.primary },
  buttonSecondary: { backgroundColor: color.action.secondary, borderWidth: 1, borderColor: color.border.subtle },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDestructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.feedback.danger },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  buttonDisabled: { backgroundColor: color.action.disabled },
  buttonLabelDisabled: { color: color.text.tertiary },

  card: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },

  divider: { height: 1, backgroundColor: color.border.subtle, marginVertical: space.md },

  badge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, alignSelf: 'flex-start' },

  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: color.surface.raisedStrong, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.action.primary },

  skeleton: { borderRadius: radius.md, backgroundColor: color.surface.raisedStrong },

  stateBox: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    padding: space.xl,
    gap: space.xs,
  },
  stateBoxError: { borderColor: 'rgba(255,138,138,0.35)' },
  stateDetail: { marginTop: space.xs },
  stateReference: { marginTop: space.sm },
  stateAction: { marginTop: space.base, alignSelf: 'flex-start' },

  row: {
    minHeight: touch.minSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: space.xxs },
  rowPressed: { opacity: 0.7 },
});
