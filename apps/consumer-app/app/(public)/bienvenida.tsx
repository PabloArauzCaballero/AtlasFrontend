/**
 * Bienvenida.
 *
 * ## Que era y que es
 *
 * Era una pantalla con el logo arriba, un titular y tres vinetas numeradas, todo de golpe. Decia lo
 * correcto y no lo hacia sentir: quien la abria veia un folleto.
 *
 * Ahora es un recorrido. Abre con la marca sola en el centro y el eslogan, y de ahi se pagina por
 * las tres ideas del producto —una por pantalla, con su gesto—. La misma informacion, contada en el
 * orden en que se entiende.
 *
 * ## El acercamiento
 *
 * La marca entra escalada al 130% y se asienta al 100% mientras aparece. No es adorno: un elemento
 * que llega desde «demasiado cerca» a su sitio se lee como que la pantalla se acaba de abrir, y es
 * lo que hace que el primer segundo no parezca una imagen fija. Dura 900 ms —lo bastante para
 * verse, lo bastante poco para no estorbar a quien ya conoce la app.
 *
 * ## Se puede saltar siempre
 *
 * «Ya tengo cuenta» esta visible desde la primera pantalla y no obliga a pasar las tres. Un
 * recorrido que no se puede saltar deja de ser una bienvenida y pasa a ser un peaje.
 *
 * ## Movimiento reducido
 *
 * Todo respeta el ajuste del sistema via `useReducedMotion`: con el activo, los elementos aparecen
 * en su sitio sin escalar ni deslizarse.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, type ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtlasMark, BrandHalo } from '../../src/ui/brand';
import { useBrandCut } from '../../src/ui/brand-cut';
import { color, radius, space } from '../../src/theme/tokens';
import { Icon, type IconName } from '../../src/ui/icons';
import { AtlasText, Button } from '../../src/ui/primitives';

/**
 * El eslogan.
 *
 * «Compra hoy, paga despues» describe el mecanismo; no dice por que importa. Lo que hace distinto a
 * Atlas en Santa Cruz no es el plazo: es que da credito a quien ningun banco se lo da, sin tarjeta y
 * sin tramite. El eslogan tiene que decir ESO.
 */
const ESLOGAN = 'Tu primer crédito no debería depender de un banco.';

type Paso = { icon: IconName; titulo: string; cuerpo: string };

const PASOS: Paso[] = [
  {
    icon: 'escanear',
    titulo: 'Escaneas y listo',
    cuerpo:
      'En la caja del comercio escaneas su QR y escribes el monto. Sin tarjeta, sin papeleo y sin esperar una respuesta que llega en tres días.',
  },
  {
    icon: 'billetera',
    titulo: 'Pagas 60% hoy',
    cuerpo:
      'El resto se divide en 3 cuotas cada 14 días. Antes de confirmar nada te mostramos cuánto pagas hoy y cómo quedan tus cuotas.',
  },
  {
    icon: 'tendencia',
    titulo: 'Construyes tu historial',
    cuerpo:
      'Cada cuota que pagas a tiempo sube tu puntaje Atlas y tu línea. El historial que ningún buró tiene todavía, lo empiezas aquí.',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  const reduced = useReducedMotion();
  const cortar = useBrandCut();

  /*
   * La entrada de la marca: escala 1.3 -> 1 y opacidad 0 -> 1.
   *
   * `withTiming` y no `withSpring`: un rebote en la primera impresion se lee como un juguete, y esto
   * es una app de credito. La curva `out(cubic)` frena al final, que es lo que hace que el elemento
   * parezca ASENTARSE en vez de detenerse de golpe.
   */
  const entrada = useSharedValue(reduced ? 1 : 0);
  const progreso = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      entrada.value = 1;
      return;
    }
    entrada.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [entrada, reduced]);

  const marcaStyle = useAnimatedStyle(() => ({
    opacity: entrada.value,
    transform: [{ scale: interpolate(entrada.value, [0, 1], [1.3, 1], Extrapolation.CLAMP) }],
  }));

  const esloganStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrada.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(entrada.value, [0.35, 1], [14, 0], Extrapolation.CLAMP) }],
  }));

  /*
    El progreso se calcula en el hilo de UI, no en el de JS.

    Con `onScroll` normal, cada fotograma del paralaje dependia de que el hilo de JS estuviera libre
    para leer el evento y escribir el valor compartido. En el arranque de la app —fuentes, sesion,
    primera peticion— no lo esta, y el deslizamiento se veia a tirones justo en la primera pantalla
    que ve un cliente. `useAnimatedScrollHandler` corre en el hilo de UI y el paralaje ya no depende
    de nada de eso.

    Lo unico que vuelve a JS es el numero de pagina, y solo cuando CAMBIA: es estado de React —de el
    dependen los botones del pie— y ahi si hace falta un re-render, pero uno cada pagina y no uno
    por fotograma.
  */
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      progreso.value = event.contentOffset.x / SCREEN_WIDTH;
      const next = Math.round(event.contentOffset.x / SCREEN_WIDTH);
      if (next !== pagina) runOnJS(setPagina)(next);
    },
  });

  const irA = (indice: number) => scroll.current?.scrollTo({ x: indice * SCREEN_WIDTH, animated: true });
  const ultima = pagina === PASOS.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/*
        El fondo: dos halos del color de marca, muy difusos.

        Un degradado plano se ve como un fondo; dos focos descentrados dan profundidad y hacen que el
        contenido parezca estar POR ENCIMA de algo. Es lo que separa una pantalla oscura de una
        pantalla con atmosfera.

        Son `BrandHalo` —degradado radial— y no vistas redondeadas: ver el porque en `ui/brand.tsx`.
        En corto: un circulo de color plano al 16 % sigue teniendo un borde, y aqui se veian los dos.
      */}
      <BrandHalo size={560} style={styles.haloTop} />
      <BrandHalo size={620} style={styles.haloBottom} />

      <Animated.ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flex}
      >
        {/* Pagina 0: la marca sola. Nada mas, a proposito. */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Animated.View style={[styles.marcaWrap, marcaStyle]}>
            <AtlasMark size={112} />
            <AtlasText variant="hero" style={styles.marcaTexto}>
              ATLAS
            </AtlasText>
          </Animated.View>
          <Animated.View style={esloganStyle}>
            <AtlasText variant="h2" style={styles.eslogan}>
              {ESLOGAN}
            </AtlasText>
            <AtlasText variant="body" tone="secondary" style={styles.esloganPie}>
              Crédito al instante en los comercios de Santa Cruz.
            </AtlasText>
          </Animated.View>
        </View>

        {PASOS.map((paso, indice) => (
          <PasoView key={paso.titulo} paso={paso} indice={indice} progreso={progreso} reduced={reduced} />
        ))}
      </Animated.ScrollView>

      {/* Los puntos: donde estoy y cuanto queda. Tocables, porque verlos invita a tocarlos. */}
      <View style={styles.dots}>
        {Array.from({ length: PASOS.length + 1 }, (_, indice) => (
          <Punto
            key={indice}
            indice={indice}
            total={PASOS.length + 1}
            progreso={progreso}
            reduced={reduced}
            activo={pagina === indice}
            onPress={() => irA(indice)}
          />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(space.lg, insets.bottom) }]}>
        {/*
          Salir de la bienvenida pasa por el corte de marca; pasar de pagina, no.

          «Siguiente» no sale de esta pantalla: mueve el carrusel. Atravesar la marca para volver a
          la misma pantalla contaria un viaje que no ocurrio, y ademas taparia el unico movimiento
          que ahi importa —el paralaje de la pagina que entra—. El corte marca un LIMITE, y usarlo
          en cada toque lo convertiria en un peaje de medio segundo repetido cuatro veces.
        */}
        {ultima ? (
          <Button label="Crear mi cuenta" onPress={() => cortar(() => router.push('/(onboarding)/registro'))} />
        ) : (
          <Button label="Siguiente" onPress={() => irA(pagina + 1)} />
        )}
        <Button
          label="Ya tengo cuenta"
          variant="ghost"
          onPress={() => cortar(() => router.push('/(auth)/ingresar'))}
        />
      </View>
    </View>
  );
}

/**
 * Una pagina del recorrido.
 *
 * El contenido se mueve MENOS que la pagina (`translateX` a 0.35 de la distancia): eso es paralaje,
 * y es lo que hace que pasar de pantalla se sienta como mover una capa sobre otra en vez de
 * arrastrar un bloque. El icono ademas escala al entrar, que le da el peso de «esto es lo nuevo».
 */
function PasoView({
  paso,
  indice,
  progreso,
  reduced,
}: {
  paso: Paso;
  indice: number;
  progreso: SharedValue<number>;
  reduced: boolean;
}) {
  const pagina = indice + 1;

  const contenidoStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const distancia = progreso.value - pagina;
    return {
      opacity: interpolate(Math.abs(distancia), [0, 1], [1, 0.2], Extrapolation.CLAMP),
      transform: [{ translateX: distancia * SCREEN_WIDTH * 0.35 }],
    };
  });

  const iconoStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const distancia = Math.abs(progreso.value - pagina);
    return { transform: [{ scale: interpolate(distancia, [0, 1], [1, 0.7], Extrapolation.CLAMP) }] };
  });

  return (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[styles.pasoContenido, contenidoStyle]}>
        <Animated.View style={[styles.pasoIcono, iconoStyle]}>
          <Icon name={paso.icon} size={40} tint={color.action.primary} />
        </Animated.View>
        <AtlasText variant="hero" style={styles.pasoTitulo}>
          {paso.titulo}
        </AtlasText>
        <AtlasText variant="body" tone="secondary" style={styles.pasoCuerpo}>
          {paso.cuerpo}
        </AtlasText>
      </Animated.View>
    </View>
  );
}

/**
 * Un punto del indicador.
 *
 * ## Por que se estira con el dedo y no al llegar
 *
 * El punto activo mide 22 px y los demas 8. Cuando ese cambio ocurria al soltar —cuando `pagina` ya
 * habia cambiado— el indicador iba un paso por detras del contenido: la pagina nueva ya estaba a
 * medio entrar y abajo seguia marcado el punto de la anterior, hasta que de golpe saltaba. Es el
 * detalle que hace que un carrusel se sienta «de plantilla».
 *
 * Atado a `progreso`, el punto que se deja se encoge y el que llega se alarga **a la vez que el
 * dedo**, y a mitad de camino los dos estan a medias. Ademas eso informa de algo que el salto no
 * decia: que el gesto se puede cancelar volviendo atras.
 *
 * Con movimiento reducido no se interpola nada: el punto activo se pinta ancho y ya.
 */
function Punto({
  indice,
  total,
  progreso,
  reduced,
  activo,
  onPress,
}: {
  indice: number;
  total: number;
  progreso: SharedValue<number>;
  reduced: boolean;
  activo: boolean;
  onPress: () => void;
}) {
  const animado = useAnimatedStyle(() => {
    if (reduced) return {};
    const cercania = interpolate(Math.abs(progreso.value - indice), [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      width: interpolate(cercania, [0, 1], [8, 22]),
      // `interpolateColor` y no un umbral: con `cercania > 0.5` el ancho viajaba y el color saltaba
      // en mitad del recorrido, que es peor que si saltaran los dos a la vez.
      backgroundColor: interpolateColor(cercania, [0, 1], [color.border.subtle, color.action.primary]),
    };
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Ir a la pantalla ${indice + 1} de ${total}`}
    >
      <Animated.View style={[styles.dot, reduced && activo && styles.dotActive, animado]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface.primary },
  flex: { flex: 1 },
  /*
    `overflow: hidden` recorta cada pagina a su propio ancho.

    Sin el, el paralaje del contenido —que se desplaza 0.35 del recorrido— sacaba el titular y el
    cuerpo de la pagina vecina FUERA de su pagina, y se leian a media opacidad sobre la que estaba
    en pantalla. En la bienvenida se veia el «Escaneas y listo» de la pagina 2 flotando junto al
    logotipo. El paralaje solo funciona si cada capa esta contenida en su marco: lo que le da el
    efecto de profundidad es que asome menos, no que se salga.
  */
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.lg,
    overflow: 'hidden',
  },

  haloTop: { position: 'absolute', top: -240, right: -200 },
  haloBottom: { position: 'absolute', bottom: -280, left: -220, opacity: 0.7 },

  marcaWrap: { alignItems: 'center', gap: space.md },
  marcaTexto: { letterSpacing: 6, textAlign: 'center' },
  eslogan: { textAlign: 'center', marginTop: space.xl },
  esloganPie: { textAlign: 'center', marginTop: space.sm },

  pasoContenido: { alignItems: 'center', gap: space.base },
  pasoIcono: {
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
    marginBottom: space.md,
  },
  pasoTitulo: { textAlign: 'center' },
  pasoCuerpo: { textAlign: 'center' },

  dots: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', paddingVertical: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.border.subtle },
  dotActive: { width: 22, backgroundColor: color.action.primary },

  footer: { paddingHorizontal: space.lg, gap: space.sm },
});
