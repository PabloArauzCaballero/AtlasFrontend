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
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, radius, space, spring, touch, type } from '../../../src/theme/tokens';
import { Icon, type IconName } from '../../../src/ui/icons';
import { ANCHO_CARRIL, useTramo } from '../../../src/ui/responsive';

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

/** Alto de la barra SIN contar el area segura. Lo fijan el icono (30 px) y su etiqueta. */
const BAR_HEIGHT = 72;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  /*
    El area segura de ABAJO, que la barra se estaba comiendo.

    `tabBarStyle` con un `height` literal SUSTITUYE al alto que React Navigation calcula, y ese
    calculo era el unico sitio donde se sumaba el hueco del indicador de inicio. Con `height: 72`
    fijo, la barra medía 72 px de borde a borde de pantalla: las etiquetas «Escanear» y «Pagos»
    quedaban debajo de la barra de gestos de Android y detras del indicador de iOS, medio tachadas
    por una pastilla blanca. Se ve en las dos capturas de evidencia, en las dos plataformas.

    El alto propio se mantiene —la barra tiene que medir lo mismo en todos los telefonos— y el area
    seg. se anade encima como relleno inferior, que es lo que hace que el contenido suba y el hueco
    del sistema quede vacio, que es justo para lo que existe.
  */
  const bar = [styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }];

  /*
    En escritorio la barra pasa a ser un CARRIL a la izquierda.

    Cinco pestañas repartidas a lo ancho de una ventana de 1.400 px quedan a treinta centímetros
    unas de otras y a medio metro del contenido, que está centrado: la mirada tiene que bajar y
    cruzar la pantalla para cambiar de sección. Pegadas en vertical junto a la columna, están donde
    el ojo ya está. Son los mismos cinco destinos con los mismos iconos; sólo cambia dónde viven.

    `tabBarPosition: 'left'` exige la variante `material` (lo comprueba la propia barra); con ella
    la etiqueta va debajo del icono, que es como se lee en la barra de abajo.
  */
  const escritorio = useTramo() === 'escritorio';
  const carril = [styles.carril, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.base }];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.action.primary,
        tabBarInactiveTintColor: color.text.tertiary,
        tabBarStyle: escritorio ? carril : bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: color.surface.primary },
        ...(escritorio ? { tabBarPosition: 'left' as const, tabBarVariant: 'material' as const } : null),
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
  /* El carril de escritorio: ancho fijo, filo a la derecha, mismo fondo que la barra. */
  carril: {
    width: ANCHO_CARRIL,
    // La barra lateral trae un ancho mínimo propio (~360 px) pensado para tabletas; aquí manda la columna.
    minWidth: ANCHO_CARRIL,
    backgroundColor: color.surface.secondary,
    borderRightColor: color.border.subtle,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
  },
  bar: {
    backgroundColor: color.surface.secondary,
    borderTopColor: color.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
  /*
    La etiqueta toma la familia del sistema de tipos, no un `fontWeight` suelto. Con `fontWeight`
    sobre la fuente por defecto, las cuatro etiquetas de la barra eran lo unico de la app que no se
    dibujaba en Manrope: bastaba eso para que la barra se viera prestada de otra aplicacion.

    El interletraje se sube de 0,2 a 0,4: a 11 px, cinco palabras cortas puestas en fila se leen
    apretadas contra sus vecinas, y es el unico sitio de la app donde cinco textos comparten renglon.
  */
  label: {
    ...type.micro,
    letterSpacing: 0.4,
    marginTop: space.xs,
    textTransform: 'none',
    /*
      Sin el relleno vertical de Android. Es el mismo ajuste que hace `render` en `ui/primitives`
      para el resto de la app, y aqui importa el doble: la etiqueta va pegada al borde inferior de
      la pantalla, asi que los 3 px que Android anade debajo de la palabra son 3 px que empujan las
      cinco etiquetas hacia la barra de gestos.
    */
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
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
