/**
 * Estructura de pantalla: safe areas, teclado y cabecera.
 *
 * Ninguna pantalla maneja el notch, la barra de estado o el teclado por su cuenta. Si cada una lo
 * resolviera a su manera, la app terminaria con seis comportamientos distintos ante el mismo
 * teclado, que es exactamente como se siente una app portada desde escritorio.
 */
import { LinearGradient } from 'expo-linear-gradient';
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
import { color, radius, space, stroke, touch } from '../theme/tokens';
import { Icon, type IconName } from './icons';
import { Appear, PressSurface } from './motion';
import { AtlasText, Overline } from './primitives';

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

      {/*
        El desvanecido de ARRIBA: donde el contenido se mete bajo el reloj.

        `Screen` reserva el area segura como relleno, asi que en reposo nada invade la barra de
        estado. Pero en cuanto la pantalla se desplaza —y el alta mide varios miles de pixeles— el
        texto pasa POR DEBAJO del reloj, del wifi y de la isla dinamica, y las dos cosas se leen
        superpuestas: se ve en la captura del registro, con «9:21» encima de «Correo electronico».

        Recortar el contenido no sirve: dejaria un filo duro atravesando la pantalla. Lo que hace
        falta es que el texto se DISUELVA en el papel justo antes de llegar ahi, que es lo que hacen
        los sistemas operativos con sus propias barras. El degradado no intercepta toques.
      */}
      {scroll && padded ? (
        <LinearGradient
          colors={[color.paperFade.from, color.paperFade.from, color.paperFade.to]}
          /*
            Opaco hasta el borde del area segura y desvanecido SOLO despues.

            Con un degradado lineal de arriba abajo, a la altura del reloj el papel va ya por la
            mitad de su opacidad y el texto de debajo se sigue leyendo a traves: se cambia una
            colision por una transparencia, que es igual de sucia. Con la parada intermedia, la zona
            del reloj queda cubierta del todo y el desvanecido gasta sus veinte pixeles justo por
            debajo, que es donde sirve para algo.
          */
          locations={[0, insets.top / (insets.top + space.lg), 1]}
          style={[styles.fadeTop, { height: insets.top + space.lg }]}
          pointerEvents="none"
        />
      ) : null}

      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(space.base, insets.bottom) }]}>
          {/*
            El mismo desvanecido, del reves, justo encima de la accion fija. El pie es opaco: sin
            esto la ultima linea visible del contenido se corta a media altura contra su borde.
          */}
          <LinearGradient
            colors={[color.paperFade.to, color.paperFade.from]}
            style={styles.fadeFooter}
            pointerEvents="none"
          />
          {footer}
        </View>
      ) : null}
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
  eyebrow,
  onBack,
  action,
  leading,
}: {
  title: string;
  subtitle?: string;
  /**
   * De DONDE viene esta pantalla, en versalitas y encima del titulo.
   *
   * Las pantallas de detalle —una cuota, una compra, un comercio— titulan la cosa que se esta
   * mirando («Cuota 3 de 6») y se guardaban el contexto para el subtitulo, mezclado con la
   * explicacion. El antetitulo separa las dos cosas: arriba a que pertenece, en el centro que es,
   * debajo que hacer con ello. Es lo que evita tener que leer el subtitulo entero para saber si se
   * ha entrado donde se queria.
   */
  eyebrow?: string;
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
        {eyebrow ? <Overline>{eyebrow}</Overline> : null}
        {/*
          Dos lineas como tope, igual que en las cabeceras de tarjeta y de seccion. Un titulo de
          pantalla que crece a tres renglones empuja la accion de la derecha fuera de su fila y deja
          la cabecera con dos alturas distintas segun la pantalla en la que se esta.
        */}
        <AtlasText variant="h1" numberOfLines={2}>
          {title}
        </AtlasText>
        {subtitle ? (
          <AtlasText variant="body" tone="secondary">
            {subtitle}
          </AtlasText>
        ) : null}
      </View>

      {/* La accion de la cabecera es un boton de 48 px: no cede ancho al titulo. */}
      {action ? <View style={styles.headerActionSlot}>{action}</View> : null}
    </View>
  );
}

/**
 * Accion en icono de una cabecera: el engranaje de Avisos, el cambio de vista de Pagos.
 *
 * Estaba copiada en cuatro pantallas como un cuadrado de 40 px sin contorno, y sin contorno sobre
 * un fondo del mismo valor no se lee como un boton sino como una mancha. Ahora comparte forma,
 * medida y filo con el boton de volver que tiene al otro lado de la misma fila, que es lo que hace
 * que los dos se lean como controles de la cabecera y no como dos adornos distintos.
 */
export function HeaderAction({
  icon,
  label,
  onPress,
  tone = 'neutral',
}: {
  icon: IconName;
  /** Obligatoria: un boton sin texto necesita nombre para el lector de pantalla. */
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'brand';
}) {
  return (
    <PressSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.headerAction}
    >
      <Icon name={icon} size={20} tint={tone === 'brand' ? color.action.primary : color.text.primary} />
    </PressSurface>
  );
}

/** Espaciador vertical explicito: mas legible que un `marginTop` suelto repartido por la pantalla. */
export function Gap({ size = 'base' }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.surface.primary },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.base,
    gap: space.base,
    /*
      Ancho maximo de lectura, centrado.

      En una tableta o un plegable abierto, una pantalla pensada para 390 px se estira hasta 1.000 y
      cada tarjeta se convierte en una franja con dos palabras en el centro y medio metro de vacio a
      los lados. Ademas la linea de texto pasa de las ~70 letras que se leen comodas a mas del
      doble, y el ojo pierde el renglon al volver. 560 es el ancho al que la app sigue siendo la
      misma app en cualquier pantalla, en vez de una version deformada de si misma.
    */
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  // `flex-start`, no `center`: en cuanto el titulo pasa a dos lineas —«Preferencias de avisos»— con
  // `center` el boton de volver baja al medio del bloque y deja de estar donde el pulgar lo busca,
  // que es arriba a la izquierda.
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  /*
    Va FUERA del pie, hacia arriba: `bottom: '100%'` lo cuelga justo encima de su borde superior.
    Treinta y dos pixeles es un renglon y medio: lo justo para que una linea de texto se apague
    entera en vez de cortarse, y no tanto como para empezar a esconder contenido que todavia hay
    que poder leer.
  */
  fadeFooter: { position: 'absolute', bottom: '100%', left: 0, right: 0, height: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm },
  headerText: { flex: 1, gap: space.xxs, paddingTop: space.xs },
  headerActionSlot: { flexShrink: 0 },
  backButton: {
    width: touch.minSize,
    height: touch.minSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
    // El filo. Un circulo relleno sin contorno sobre un fondo casi del mismo valor no se lee como
    // un boton: se lee como una mancha mas clara. Es el mismo recurso que usa la tarjeta.
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
    marginLeft: -space.sm,
  },
  headerAction: {
    width: touch.minSize,
    height: touch.minSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.surface.primary,
    borderTopWidth: stroke.hairline,
    borderTopColor: color.border.hairline,
    gap: space.sm,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
