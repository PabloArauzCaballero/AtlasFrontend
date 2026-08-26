/**
 * Barra de pestanas.
 *
 * Cinco destinos de primer nivel y recurrentes, que es para lo unico que sirven las pestanas.
 * Nada de pasos de un asistente, detalles ni acciones destructivas aqui dentro.
 *
 * «Avisos» es pestana y no una campanita en una esquina: lo que llega ahi son vencimientos, moras y
 * cambios en la linea de credito. Escondido tras un icono con un punto rojo, el aviso que dice «te
 * vence una cuota manana» compite con la notificacion del sistema y pierde.
 *
 * "Escanear" ocupa el centro porque es la accion que define el producto: comprar en un comercio.
 * Es la unica que lleva realce, y lo lleva siempre —tambien sin foco— porque su realce no dice
 * "estas aqui" sino "esto es lo que la app hace".
 */
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, radius, space, spring, touch, type } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';

/**
 * El icono de la pestana activa se asienta; no aparece ya colocado.
 *
 * El cambio de color al enfocar era instantaneo, y en una barra de cinco destinos eso hace que
 * cambiar de pestana se lea como un corte de camara: la pantalla nueva entra y, a la vez, un icono
 * de abajo se ha vuelto verde sin haber pasado por ningun sitio.
 *
 * El realce es deliberadamente pequeno —un 8 % de escala— porque la barra esta siempre en pantalla.
 * Lo que se busca no es que se note la animacion, sino que la mirada tenga a donde volver despues
 * de que el contenido haya cambiado entero.
 */
function TabIcon({ name, focused, highlighted }: { name: IconName; focused: boolean; highlighted?: boolean }) {
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
    <Animated.View
      style={[
        styles.icon,
        highlighted && styles.iconHighlighted,
        highlighted && focused && styles.iconHighlightedActive,
        animado,
      ]}
    >
      <Icon
        name={name}
        size={highlighted ? 20 : 22}
        tint={highlighted ? (focused ? color.text.onBrand : color.text.secondary) : focused ? color.action.primary : color.text.tertiary}
      />
    </Animated.View>
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
        name="avisos"
        options={{ title: 'Avisos', tabBarIcon: ({ focused }) => <TabIcon name="sobre" focused={focused} /> }}
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
    height: 72,
    paddingTop: space.md,
  },
  /*
    La etiqueta toma la familia del sistema de tipos, no un `fontWeight` suelto. Con `fontWeight`
    sobre la fuente por defecto, las cuatro etiquetas de la barra eran lo unico de la app que no se
    dibujaba en Manrope: bastaba eso para que la barra se viera prestada de otra aplicacion.

    El interletraje se sube de 0,2 a 0,4: a 11 px, cinco palabras cortas puestas en fila se leen
    apretadas contra sus vecinas, y es el unico sitio de la app donde cinco textos comparten renglon.
  */
  label: { ...type.micro, letterSpacing: 0.4, marginTop: space.xs, textTransform: 'none' },
  icon: { minWidth: touch.minSize / 2, alignItems: 'center', justifyContent: 'center' },
  /*
    La pastilla de «Escanear» se TINE y lleva contorno; enfocada se rellena.

    Sin contorno, el estado en reposo era un rectangulo blanco al 10 % que sobre la barra apenas se
    despega: la accion que define el producto se leia como un icono con una sombra rara detras. El
    filo la convierte en un objeto, y deja sitio para que el relleno pleno signifique algo cuando la
    pestana esta activa.
  */
  iconHighlighted: {
    width: 46,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: color.feedbackSoft.success,
    borderWidth: 1,
    borderColor: color.feedbackBorder.brand,
  },
  iconHighlightedActive: { backgroundColor: color.action.primary, borderColor: color.action.primary },
});
