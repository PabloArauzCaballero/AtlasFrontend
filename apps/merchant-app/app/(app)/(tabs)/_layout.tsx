/**
 * Barra de pestañas del comercio.
 *
 * Dos destinos, los mismos dos que pinta el menú del portal web (`PORTAL_COMERCIO_MENU`): Gestión POS
 * (el hogar) y Cartera (con Consumo y facturación detrás de su selector). Mi empresa, Soporte y el
 * asistente son botones flotantes abajo a la derecha, como en la app del cliente (Pablo, 2026-10-10);
 * ver `src/ui/botones-flotantes.tsx`.
 *
 * El dibujo es el de la barra de la app del cliente (`consumer-app/app/(app)/(tabs)/_layout.tsx`):
 * mismo alto, misma área segura, mismo icono que se asienta con un muelle al enfocarse.
 */
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, space, spring, touch, type } from '@cliente/theme/tokens';
import { Icon, type IconName } from '@cliente/ui/icons';
import { BotonesFlotantes } from '@/ui/botones-flotantes';

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const reduced = useReducedMotion();
  const activo = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      activo.value = focused ? 1 : 0;
      return;
    }
    activo.value = withSpring(focused ? 1 : 0, spring.settle);
  }, [focused, reduced, activo]);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: 1 + activo.value * 0.08 }] }));

  return (
    <Animated.View style={[styles.icon, animado]}>
      <Icon name={name} size={22} duo={focused} vivo={focused} tint={focused ? color.action.primary : color.text.tertiary} />
    </Animated.View>
  );
}

const BAR_HEIGHT = 72;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bar = [styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }];

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.action.primary,
        tabBarInactiveTintColor: color.text.tertiary,
        tabBarStyle: bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: color.surface.primary },
      }}
    >
      <Tabs.Screen
        name="gestion-pos"
        options={{ title: 'Gestión POS', tabBarIcon: ({ focused }) => <TabIcon name="lista" focused={focused} /> }}
      />
      <Tabs.Screen
        name="cartera"
        options={{ title: 'Cartera', tabBarIcon: ({ focused }) => <TabIcon name="billetera" focused={focused} /> }}
      />
    </Tabs>
    <BotonesFlotantes />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.surface.secondary,
    borderTopColor: color.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
  label: {
    ...type.micro,
    letterSpacing: 0.4,
    marginTop: space.xs,
    textTransform: 'none',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  icon: { minWidth: touch.minSize / 2, alignItems: 'center', justifyContent: 'center' },
});
