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
import { Platform, Pressable, type ScrollView, StyleSheet, View } from 'react-native';
import { HeroBienvenida } from '../../src/web/HeroBienvenida';
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
import { toqueWeb } from '../../src/ui/hit-slop';
import { useAnchoDeColumna, useTramo } from '../../src/ui/responsive';
import { color, radius, space } from '../../src/theme/tokens';
import * as contentApi from '../../src/api/endpoints/app-content';
import { Icon, ICON_NAMES, type IconName } from '../../src/ui/icons';
import { AtlasText, Button } from '../../src/ui/primitives';
import { bitacora } from '../../src/features/bitacora';

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

/*
  El ancho de cada página del carrusel se lee en cada render y no una vez al cargar el módulo.

  `Dimensions.get('window')` al cargar valía para un teléfono, donde la ventana no cambia. En el
  navegador la misma app se abre a 1.400 px, se redimensiona y se gira; con un ancho fijo el
  carrusel medía la ventana entera y la página desbordaba la columna de lectura hacia la derecha.
  Ahora cada página mide la columna (o la ventana si es más estrecha), y el carrusel entero se
  centra con ese mismo ancho: ver `ui/responsive.ts`.
*/

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const SCREEN_WIDTH = useAnchoDeColumna();
  const tramo = useTramo();
  const scroll = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);
  const reduced = useReducedMotion();
  const cortar = useBrandCut();

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
  const ultima = pagina === pasos.length;

  /*
    En el navegador, desde 1024 px, la bienvenida es el hero de la landing con la app dentro de un
    telefono (ver `web/HeroBienvenida.tsx`). Por debajo —y dentro de ese telefono, que mide 390—
    es esta misma pantalla. Va despues de todos los hooks para no alterar su orden.
  */
  if (Platform.OS === 'web' && tramo === 'escritorio') return <HeroBienvenida pasos={pasos} />;

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
        contentContainerStyle={{ width: SCREEN_WIDTH * (pasos.length + 1) }}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={[styles.flex, { width: SCREEN_WIDTH, alignSelf: 'center' }]}
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
            <AtlasText variant="h1" style={styles.eslogan}>
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
      </Animated.ScrollView>

      {/* Los puntos: donde estoy y cuanto queda. Tocables, porque verlos invita a tocarlos. */}
      <View style={styles.dots}>
        {/*
          Las dos cosas a la vez: el punto animado —se estira con el dedo en vez de saltar al
          soltar— y la lista de pasos que ahora llega del servidor. `pasos.length` y no `PASOS`:
          el numero de paginas ya no lo decide el bundle.
        */}
        {Array.from({ length: pasos.length + 1 }, (_, indice) => (
          <Punto
            key={indice}
            indice={indice}
            total={pasos.length + 1}
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
          <Button
            label="Crear mi cuenta"
            bitacora="crear_cuenta"
            onPress={() => {
              // AQUI arranca el cronometro del alta: en el primer toque, antes de que exista cuenta.
              void bitacora.arrancar('crear_cuenta');
              cortar(() => router.push('/(onboarding)/registro'));
            }}
          />
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
  const SCREEN_WIDTH = useAnchoDeColumna();
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
      {...toqueWeb(10)}
      accessibilityRole="button"
      accessibilityLabel={`Ir a la pantalla ${indice + 1} de ${total}`}
    >
      <Animated.View style={[styles.dot, reduced && activo && styles.dotActive, animado]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
    `overflow: hidden` en la raiz: los dos halos salen 200 px por la derecha y por la izquierda a
    proposito, y en el telefono la pantalla los recorta sola. En el navegador el documento no
    recorta nada: crecia 200 px y aparecia una barra horizontal en todos los anchos hasta 1.023 px.
  */
  root: { flex: 1, backgroundColor: color.surface.primary, overflow: 'hidden' },
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
  /*
    El icono del paso va en un CIRCULO tenido de marca, no en un cuadrado gris.

    Era un cuadrado de 92 px del color de una tarjeta, es decir, la misma superficie que usa
    cualquier bloque de datos de la app: el simbolo que abre cada pagina del recorrido se leia como
    una tarjeta vacia con un dibujo dentro. Redondo y tenido, se lee como un simbolo; y el contorno
    de marca lo ata a la identidad en la unica pantalla que existe para presentarla.
  */
  pasoIcono: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.feedbackSoft.success,
    borderWidth: 1,
    borderColor: color.feedbackBorder.brand,
    marginBottom: space.md,
  },
  pasoTitulo: { textAlign: 'center' },
  pasoCuerpo: { textAlign: 'center' },

  dots: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', paddingVertical: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.border.subtle },
  dotActive: { width: 22, backgroundColor: color.action.primary },

  // El mismo ancho maximo que el resto de la app (`ui/layout.tsx`): en una tableta, dos botones
  // estirados a 1.000 px dejan de leerse como botones.
  footer: { paddingHorizontal: space.lg, gap: space.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
