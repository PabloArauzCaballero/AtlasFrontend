/**
 * Estructura de pantalla: safe areas, teclado y cabecera.
 *
 * Ninguna pantalla maneja el notch, la barra de estado o el teclado por su cuenta. Si cada una lo
 * resolviera a su manera, la app terminaria con seis comportamientos distintos ante el mismo
 * teclado, que es exactamente como se siente una app portada desde escritorio.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, touch } from '../theme/tokens';
import { AtlasText } from './primitives';

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Accion fija al pie: se mantiene sobre el area segura, nunca bajo el indicador de inicio. */
  footer?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const body = padded ? [styles.content, contentStyle] : contentStyle;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[body, { paddingBottom: space.xxl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.action.primary} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{children}</View>
      )}

      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(space.base, insets.bottom) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

/**
 * Cabecera de pantalla con titulo, retroceso y una sola accion secundaria.
 *
 * Una accion, no seis: si hicieran falta mas, van a un menu de desbordamiento y no a la cabecera.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | 'auto';
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const handleBack = onBack === 'auto' ? () => (router.canGoBack() ? router.back() : router.replace('/')) : onBack;

  return (
    <View style={styles.header}>
      {handleBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <AtlasText variant="h3" tone="secondary">
            {'‹'}
          </AtlasText>
        </Pressable>
      ) : null}

      <View style={styles.headerText}>
        <AtlasText variant="h1">{title}</AtlasText>
        {subtitle ? (
          <AtlasText variant="body" tone="secondary">
            {subtitle}
          </AtlasText>
        ) : null}
      </View>

      {action}
    </View>
  );
}

/** Espaciador vertical explicito: mas legible que un `marginTop` suelto repartido por la pantalla. */
export function Gap({ size = 'base' }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.surface.primary },
  content: { paddingHorizontal: space.lg, paddingTop: space.base, gap: space.base },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm },
  headerText: { flex: 1, gap: space.xs },
  backButton: {
    width: touch.minSize,
    height: touch.minSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
    marginLeft: -space.sm,
  },
  pressed: { opacity: 0.7 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.surface.primary,
    borderTopWidth: 1,
    borderTopColor: color.border.subtle,
    gap: space.sm,
  },
});
