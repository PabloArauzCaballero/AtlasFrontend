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
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtlasMark } from '../../src/ui/brand';
import { color, radius, space } from '../../src/theme/tokens';
import * as contentApi from '../../src/api/endpoints/app-content';
import { Icon, ICON_NAMES, type IconName } from '../../src/ui/icons';
import { AtlasText, Button } from '../../src/ui/primitives';

/**
 * El eslogan y los pasos, POR DEFECTO.
 *
 * ## Por que sigue habiendo texto aqui
 *
 * Porque esta es la primerisima pantalla y se abre sin sesion, a veces sin red y siempre antes de
 * que nadie haya cargado nada. Una bienvenida en blanco mientras se espera al servidor es la peor
 * primera impresion posible, y una que falla porque el servidor no contesto es todavia peor.
 *
 * Esto es el suelo, no la fuente. Lo que se ensena cuando hay respuesta viene del catalogo de
 * contenidos del servidor (`surface: 'onboarding'`), donde negocio lo edita sin publicar una version
 * de la app. Si el catalogo trae algo, gana el catalogo.
 *
 * ## Sobre el eslogan
 *
 * «Compra hoy, paga despues» describe el mecanismo; no dice por que importa. Lo que hace distinto a
 * Atlas en Santa Cruz no es el plazo: es que da credito a quien ningun banco se lo da, sin tarjeta y
 * sin tramite. El eslogan tiene que decir ESO.
 */
const ESLOGAN = 'Tu primer crédito no debería depender de un banco.';
const ESLOGAN_PIE = 'Crédito al instante en los comercios de Santa Cruz.';

type Paso = { icon: IconName; titulo: string; cuerpo: string };

const PASOS_POR_DEFECTO: Paso[] = [
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

/**
 * Convierte una pieza del catalogo en un paso pintable.
 *
 * El cuerpo sale del subtitulo, del cuerpo largo o de los bullets unidos, en ese orden: quien edita
 * desde el portal no tiene por que saber cual de los tres campos lee esta pantalla en concreto, y
 * dejar el paso vacio porque escribio en el campo «equivocado» seria culparle de nuestra estructura.
 */
function pasoDesdeContenido(entry: contentApi.ContentEntry, indice: number): Paso {
  const cuerpo = entry.subtitle ?? entry.body ?? entry.bullets.map((bullet) => bullet.text).join(' ');
  const icono = entry.bullets.find((bullet) => bullet.icon)?.icon ?? null;
  return {
    icon: icono && (ICON_NAMES as readonly string[]).includes(icono) ? (icono as IconName) : (PASOS_POR_DEFECTO[indice]?.icon ?? 'chispa'),
    titulo: entry.title ?? '',
    cuerpo,
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  const reduced = useReducedMotion();

  /*
   * El contenido del servidor SUSTITUYE al de por defecto cuando llega, y no antes. Arrancar en
   * blanco a la espera de la red convertiria la primera impresion en una pantalla vacia; y como la
   * carga es casi siempre mas rapida que la animacion de entrada, en la practica no se ve el cambio.
   */
  const [eslogan, setEslogan] = useState({ titulo: ESLOGAN, pie: ESLOGAN_PIE });
  const [pasos, setPasos] = useState<Paso[]>(PASOS_POR_DEFECTO);

  useEffect(() => {
    let cancelled = false;
    void contentApi.getContent('onboarding').then((entries) => {
      if (cancelled || entries.length === 0) return;
      const cabecera = entries.find((entry) => entry.contentKey === 'eslogan');
      if (cabecera?.subtitle) setEslogan({ titulo: cabecera.subtitle, pie: cabecera.body ?? ESLOGAN_PIE });

      const publicados = entries.filter((entry) => entry.contentKey !== 'eslogan').map(pasoDesdeContenido);
      // Un paso sin titulo o sin cuerpo se descarta: media tarjeta en el recorrido de bienvenida se
      // lee como un fallo de la app, no como contenido pendiente de escribir.
      const utiles = publicados.filter((paso) => paso.titulo && paso.cuerpo);
      if (utiles.length > 0) setPasos(utiles);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    progreso.value = x / SCREEN_WIDTH;
    const next = Math.round(x / SCREEN_WIDTH);
    if (next !== pagina) setPagina(next);
  };

  const irA = (indice: number) => scroll.current?.scrollTo({ x: indice * SCREEN_WIDTH, animated: true });
  const ultima = pagina === pasos.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/*
        El fondo: dos halos del color de marca, muy difusos.

        Un degradado plano se ve como un fondo; dos focos descentrados dan profundidad y hacen que el
        contenido parezca estar POR ENCIMA de algo. Es lo que separa una pantalla oscura de una
        pantalla con atmosfera.
      */}
      <View pointerEvents="none" style={[styles.halo, styles.haloTop]} />
      <View pointerEvents="none" style={[styles.halo, styles.haloBottom]} />

      <ScrollView
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
              {eslogan.titulo}
            </AtlasText>
            <AtlasText variant="body" tone="secondary" style={styles.esloganPie}>
              {eslogan.pie}
            </AtlasText>
          </Animated.View>
        </View>

        {pasos.map((paso, indice) => (
          <PasoView key={paso.titulo} paso={paso} indice={indice} progreso={progreso} reduced={reduced} />
        ))}
      </ScrollView>

      {/* Los puntos: donde estoy y cuanto queda. Tocables, porque verlos invita a tocarlos. */}
      <View style={styles.dots}>
        {Array.from({ length: pasos.length + 1 }, (_, indice) => (
          <Pressable
            key={indice}
            onPress={() => irA(indice)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Ir a la pantalla ${indice + 1} de ${pasos.length + 1}`}
          >
            <View style={[styles.dot, pagina === indice && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(space.lg, insets.bottom) }]}>
        {ultima ? (
          <Button label="Crear mi cuenta" onPress={() => router.push('/(onboarding)/registro')} />
        ) : (
          <Button label="Siguiente" onPress={() => irA(pagina + 1)} />
        )}
        <Button label="Ya tengo cuenta" variant="ghost" onPress={() => router.push('/(auth)/ingresar')} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surface.primary },
  flex: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.lg },

  halo: { position: 'absolute', width: 460, height: 460, borderRadius: 230, opacity: 0.16 },
  haloTop: { top: -190, right: -150, backgroundColor: color.action.primary },
  haloBottom: { bottom: -220, left: -170, backgroundColor: color.action.primary, opacity: 0.1 },

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
