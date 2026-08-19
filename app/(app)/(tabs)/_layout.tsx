/**
 * Barra de pestanas.
 *
 * Cuatro destinos de primer nivel y recurrentes, que es para lo unico que sirven las pestanas.
 * Nada de pasos de un asistente, detalles ni acciones destructivas aqui dentro.
 *
 * "Escanear" ocupa el centro porque es la accion que define el producto: comprar en un comercio.
 */
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { color, radius, space, touch } from '../../../src/theme/tokens';
import { AtlasText } from '../../../src/ui/primitives';

function TabIcon({ glyph, focused, highlighted }: { glyph: string; focused: boolean; highlighted?: boolean }) {
  return (
    <View style={[styles.icon, highlighted && styles.iconHighlighted, highlighted && focused && styles.iconHighlightedActive]}>
      <AtlasText variant="h3" tone={highlighted ? 'onBrand' : focused ? 'brand' : 'tertiary'}>
        {glyph}
      </AtlasText>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.action.primary,
        tabBarInactiveTintColor: color.text.tertiary,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: color.surface.primary },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: ({ focused }) => <TabIcon glyph="◈" focused={focused} /> }}
      />
      <Tabs.Screen
        name="escanear"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⌗" focused={focused} highlighted />,
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{ title: 'Pagos', tabBarIcon: ({ focused }) => <TabIcon glyph="≡" focused={focused} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon glyph="◐" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.surface.secondary,
    borderTopColor: color.border.subtle,
    borderTopWidth: 1,
    height: 68,
    paddingTop: space.sm,
  },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  icon: { minWidth: touch.minSize / 2, alignItems: 'center', justifyContent: 'center' },
  iconHighlighted: {
    width: 38,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: color.action.disabled,
  },
  iconHighlightedActive: { backgroundColor: color.action.primary },
});
