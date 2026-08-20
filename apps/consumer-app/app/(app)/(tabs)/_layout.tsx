/**
 * Barra de pestanas.
 *
 * Cuatro destinos de primer nivel y recurrentes, que es para lo unico que sirven las pestanas.
 * Nada de pasos de un asistente, detalles ni acciones destructivas aqui dentro.
 *
 * "Escanear" ocupa el centro porque es la accion que define el producto: comprar en un comercio.
 * Es la unica que lleva realce, y lo lleva siempre —tambien sin foco— porque su realce no dice
 * "estas aqui" sino "esto es lo que la app hace".
 */
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { color, radius, space, touch, type } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';

function TabIcon({ name, focused, highlighted }: { name: IconName; focused: boolean; highlighted?: boolean }) {
  return (
    <View style={[styles.icon, highlighted && styles.iconHighlighted, highlighted && focused && styles.iconHighlightedActive]}>
      <Icon
        name={name}
        size={highlighted ? 20 : 22}
        tint={highlighted ? (focused ? color.text.onBrand : color.text.secondary) : focused ? color.action.primary : color.text.tertiary}
      />
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
        options={{ title: 'Inicio', tabBarIcon: ({ focused }) => <TabIcon name="inicio" focused={focused} /> }}
      />
      <Tabs.Screen
        name="escanear"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ focused }) => <TabIcon name="escanear" focused={focused} highlighted />,
        }}
      />
      <Tabs.Screen
        name="pagos"
        options={{ title: 'Pagos', tabBarIcon: ({ focused }) => <TabIcon name="pagos" focused={focused} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon name="perfil" focused={focused} /> }}
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
  // La etiqueta toma la familia del sistema de tipos, no un `fontWeight` suelto. Con `fontWeight`
  // sobre la fuente por defecto, las cuatro etiquetas de la barra eran lo unico de la app que no se
  // dibujaba en Manrope: bastaba eso para que la barra se viera prestada de otra aplicacion.
  label: { ...type.micro, letterSpacing: 0.2, marginTop: 2, textTransform: 'none' },
  icon: { minWidth: touch.minSize / 2, alignItems: 'center', justifyContent: 'center' },
  iconHighlighted: {
    width: 42,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: color.action.disabled,
  },
  iconHighlightedActive: { backgroundColor: color.action.primary },
});
