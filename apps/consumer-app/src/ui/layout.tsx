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
import { Icon } from './icons';
import { Appear } from './motion';
import { AtlasText } from './primitives';

export function Screen({
  children,
  scroll = true,
  padded = true,
  animate = true,
  footer,
  onRefresh,
  refreshing = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /**
   * Entrada escalonada de los bloques de la pantalla.
   *
   * Por defecto si: es lo que hace que una pantalla se lea en el orden en que esta escrita en vez de
   * aparecer entera de golpe. Se apaga donde el contenido ocupa la pantalla completa y no tiene
   * bloques que escalonar —la camara, el escaner—, porque ahi el desplazamiento inicial se ve como
   * un salto del visor.
   *
   * Con «movimiento reducido» activo no hace nada: ver `ui/motion.tsx`.
   */
  animate?: boolean;
  /** Accion fija al pie: se mantiene sobre el area segura, nunca bajo el indicador de inicio. */
  footer?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const body = padded ? [styles.content, contentStyle] : contentStyle;

  /*
    Se envuelve cada hijo por separado, no el conjunto: escalonar exige que cada bloque tenga su
    propio retardo.

    Los huecos (`null`, `false`) se dejan pasar tal cual. Envolverlos crearia una vista vacia que el
    `gap` del contenedor separaria igual que a un bloque real, y las pantallas con avisos
    condicionales —casi todas— acabarian con agujeros donde no hay nada que mostrar.
  */
  const bodyChildren = animate
    ? React.Children.map(children, (child, index) =>
        child === null || child === undefined || typeof child === 'boolean' ? child : <Appear index={index}>{child}</Appear>,
      )
    : children;

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
          {bodyChildren}
        </ScrollView>
      ) : (
        <View style={[styles.flex, body]}>{bodyChildren}</View>
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
  leading,
}: {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | 'auto';
  action?: React.ReactNode;
  /**
   * Un adorno propio de la pantalla ANTES del titulo: el icono del rubro, el avatar del comercio.
   *
   * Existe para que las pantallas que ya tenian su cabecera hecha a mano puedan usar esta sin
   * perder ese icono. Tres de ellas —comercio, credito y politica de mora— se habian escrito con
   * su propio encabezado justo por eso, y el precio fue quedarse SIN boton de volver: se entraba y
   * solo salia quien conociera el gesto del sistema.
   */
  leading?: React.ReactNode;
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
          <Icon name="atras" size={22} />
        </Pressable>
      ) : null}

      {leading}

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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
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
