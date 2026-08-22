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
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, touch } from '../theme/tokens';
import { Icon } from './icons';
import { Appear, PressSurface } from './motion';
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
  scrollRef,
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
  /**
   * Acceso al desplazamiento de la pantalla, para poder LLEVAR la vista a algun sitio.
   *
   * Existe por un caso concreto y feo: el fallo de envio. Las pantallas del alta pintan el error del
   * servidor arriba del todo —que es donde debe estar, porque es el estado de la pantalla entera— y
   * el boton que lo provoca esta al final de un formulario de mil pixeles. Sin esto, el servidor
   * rechaza el alta, la pantalla lo dice, y la persona ve que no pasa nada: el boton parece roto.
   */
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const insets = useSafeAreaInsets();
  /*
    El area segura de ARRIBA, que faltaba.

    `Screen` respetaba el borde inferior —el pie se levanta sobre el indicador de inicio— y no el
    superior. En Android no se notaba porque la barra de estado no es translucida y la ventana ya
    empieza por debajo; en iOS el contenido va de borde a borde, asi que en las veinte pantallas que
    usan `Screen` el titulo se dibujaba ENCIMA del reloj y el boton de volver quedaba cortado por la
    isla dinamica. Se vio en la primera captura del simulador de iOS: hasta ahora toda la evidencia
    se habia tomado en Android.

    Solo cuando `padded`: una pantalla a sangre —la camara del escaner— coloca sus propios controles
    y meterle un hueco arriba le partiria el visor.
  */
  const body = padded ? [styles.content, { paddingTop: insets.top + space.base }, contentStyle] : contentStyle;

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
      /*
        Cero, no `insets.top`.

        `keyboardVerticalOffset` es la distancia entre el borde superior de la PANTALLA y el de esta
        vista. Esta vista es la pantalla entera —empieza en 0—, asi que declarar el area segura como
        desfase hacia que el hueco reservado al teclado fuera 59 px mas alto que el teclado, y con el
        teclado abierto quedaba una franja negra entre el pie y las teclas. El area segura de arriba
        se paga con el `paddingTop` del contenido, que es donde corresponde.
      */
      keyboardVerticalOffset={0}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
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
 * Lleva la pantalla arriba cuando aparece un error.
 *
 * Se usa junto a `Screen scrollRef`. Salta solo en el flanco —de «sin error» a «con error»—: si se
 * disparara con cada render, un error persistente devolveria la vista al principio cada vez que la
 * persona intenta desplazarse para leer otra cosa, y eso es peor que no moverla.
 *
 * `animated` a proposito: un salto instantaneo al principio de un formulario largo no se lee como
 * «mira arriba», se lee como que la pantalla se ha reiniciado y ha perdido lo escrito.
 */
export function useScrollToError(error: unknown, scrollRef: React.RefObject<ScrollView | null>) {
  const habia = React.useRef(false);
  React.useEffect(() => {
    const hay = Boolean(error);
    if (hay && !habia.current) scrollRef.current?.scrollTo({ y: 0, animated: true });
    habia.current = hay;
  }, [error, scrollRef]);
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
        /*
          El mismo hundimiento que cualquier otra superficie tocable de la app.

          Antes era un salto de opacidad a 0.7 con el `pressed` de `Pressable`: instantaneo, sin
          fotogramas intermedios y con un temperamento distinto al de los botones y las filas que
          tiene al lado. Es un control que aparece en veinte pantallas, asi que era la
          inconsistencia de movimiento mas repetida de la app.
        */
        <PressSurface
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={handleBack}
          hitSlop={12}
          style={styles.backButton}
        >
          <Icon name="atras" size={22} />
        </PressSurface>
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
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.surface.primary,
    borderTopWidth: 1,
    borderTopColor: color.border.subtle,
    gap: space.sm,
  },
});
