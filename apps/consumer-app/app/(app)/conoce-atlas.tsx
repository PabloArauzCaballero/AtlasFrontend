/**
 * «Conoce Atlas»: las pantallas de presentación, a mano desde Inicio con el botón de la marca (Pablo, 2026-10-08).
 *
 * Segunda versión (Pablo, 2026-10-08: «necesito que sea una orquestación ultra HD y avanzada; así está muy básica»).
 * Todo corre en el hilo de UI (Reanimated) y está atado al dedo:
 *
 *  - PARALAJE: al deslizar, la ilustración se mueve más despacio que el texto y crece al centrarse; la que sale se
 *    encoge y se apaga. Es lo que da profundidad: dos planos a distinta distancia.
 *  - ESCENARIO VIVO: dos órbitas que giran en sentidos opuestos con partículas de luz que las recorren, y un
 *    resplandor que respira. Movimiento lento y continuo: se siente vivo sin pedir atención.
 *  - ENTRADA ESCALONADA: al llegar a un paso entran en orden el número, el título y el texto (120 ms entre cada uno).
 *  - INDICADOR LÍQUIDO: los puntos se estiran siguiendo el dedo, no a saltos.
 *
 * Con movimiento reducido no gira ni flota nada y no hay paralaje: los pasos se leen igual, quietos.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as contentApi from '../../src/api/endpoints/app-content';
import { PASOS_POR_DEFECTO, pasosDesdeContenido, type Paso } from '../../src/features/bienvenida-pasos';
import { alpha, color, radius, space } from '../../src/theme/tokens';
import { BrandHalo } from '../../src/ui/brand';
import { Ilustracion } from '../../src/ui/ilustraciones-bienvenida';
import { Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Button } from '../../src/ui/primitives';

const ESCENA_ALTO = 380;
const PARTICULAS = 6;

export default function ConoceAtlas() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const ancho = width - space.lg * 2;
  const reducido = useReducedMotion();
  const [pasos, setPasos] = useState<Paso[]>(PASOS_POR_DEFECTO);
  const [pagina, setPagina] = useState(0);
  const scroll = useRef<Animated.ScrollView>(null);
  const x = useSharedValue(0);
  const giro = useSharedValue(0);
  const respiro = useSharedValue(0);

  useEffect(() => {
    let vivo = true;
    contentApi
      .getContent('onboarding')
      .then((entradas) => {
        const desdePortal = pasosDesdeContenido(entradas);
        if (vivo && desdePortal.length > 0) setPasos(desdePortal);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (reducido) return;
    giro.value = withRepeat(withTiming(1, { duration: 24_000, easing: Easing.linear }), -1, false);
    respiro.value = withRepeat(withTiming(1, { duration: 3_200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reducido, giro, respiro]);

  const alDesplazar = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  const ultima = pagina >= pasos.length - 1;
  const siguiente = () => (ultima ? router.back() : scroll.current?.scrollTo({ x: (pagina + 1) * ancho, animated: true }));

  return (
    <Screen>
      <ScreenHeader title="Conoce Atlas" onBack="auto" />

      <View style={[styles.escenario, { height: ESCENA_ALTO }]}>
        <LinearGradient colors={[color.heroWash, color.surface.primary]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <Resplandor respiro={respiro} ancho={ancho} />
        <Orbita giro={giro} diametro={ancho * 0.9} sentido={1} />
        <Orbita giro={giro} diametro={ancho * 0.62} sentido={-1.6} />
        <Animated.ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={alDesplazar}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setPagina(Math.round(e.nativeEvent.contentOffset.x / ancho))}
          testID="conoce-atlas-paginas"
        >
          {pasos.map((paso, i) => (
            <Escena key={paso.clave} paso={paso} indice={i} ancho={ancho} x={x} reducido={reducido} />
          ))}
        </Animated.ScrollView>
      </View>

      {/* El texto se vuelve a montar con cada paso: así su entrada escalonada corre cada vez que se llega. */}
      <View key={pasos[pagina]?.clave ?? pagina} style={styles.texto} accessibilityLiveRegion="polite">
        <Animated.View entering={reducido ? undefined : FadeInDown.duration(380)} style={styles.paso}>
          <AtlasText variant="captionStrong" tone="brand">
            {`PASO ${pagina + 1} DE ${pasos.length}`}
          </AtlasText>
        </Animated.View>
        <Animated.View entering={reducido ? undefined : FadeInDown.delay(120).duration(420)}>
          <AtlasText variant="h1">{pasos[pagina]?.titulo ?? ''}</AtlasText>
        </Animated.View>
        <Animated.View entering={reducido ? undefined : FadeInDown.delay(240).duration(460)}>
          <AtlasText variant="body" tone="secondary">
            {pasos[pagina]?.cuerpo ?? ''}
          </AtlasText>
        </Animated.View>
      </View>

      <View style={styles.puntos} accessibilityRole="tablist">
        {pasos.map((paso, i) => (
          <Punto key={paso.clave} indice={i} ancho={ancho} x={x} />
        ))}
      </View>
      <Button label={ultima ? 'Entendido' : 'Siguiente'} icon={ultima ? 'check' : 'adelante'} onPress={siguiente} testID="conoce-atlas-siguiente" />
    </Screen>
  );
}

/** Una página: la ilustración en paralaje, que crece al centrarse y se apaga al salir. */
function Escena({ paso, indice, ancho, x, reducido }: { paso: Paso; indice: number; ancho: number; x: SharedValue<number>; reducido: boolean }) {
  const estilo = useAnimatedStyle(() => {
    const d = (x.value - indice * ancho) / ancho;
    if (reducido) return {};
    return {
      opacity: interpolate(Math.abs(d), [0, 0.7], [1, 0.15], Extrapolation.CLAMP),
      transform: [
        // Paralaje: el dibujo se queda atrás respecto de la página (se mueve al 55 % del dedo).
        { translateX: d * ancho * 0.45 },
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.78], Extrapolation.CLAMP) },
        { rotateZ: `${d * -6}deg` },
      ],
    };
  });
  return (
    <View style={[styles.pagina, { width: ancho, height: ESCENA_ALTO }]} accessibilityLabel={`${paso.titulo}. ${paso.cuerpo}`}>
      <Animated.View style={estilo}>
        <Ilustracion nombre={paso.ilustracion} ancho={Math.min(ancho * 0.9, 360)} decorativa />
      </Animated.View>
    </View>
  );
}

/** Un anillo que gira despacio con partículas de luz repartidas sobre él. */
function Orbita({ giro, diametro, sentido }: { giro: SharedValue<number>; diametro: number; sentido: number }) {
  const estilo = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${giro.value * 360 * sentido}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.orbita, { width: diametro, height: diametro, borderRadius: diametro / 2 }, estilo]}>
      {Array.from({ length: PARTICULAS }, (_, i) => {
        const angulo = (i / PARTICULAS) * Math.PI * 2;
        const lado = i % 2 === 0 ? 6 : 4;
        return (
          <View
            key={i}
            style={[
              styles.particula,
              {
                width: lado,
                height: lado,
                borderRadius: lado / 2,
                left: diametro / 2 + Math.cos(angulo) * (diametro / 2) - lado / 2,
                top: diametro / 2 + Math.sin(angulo) * (diametro / 2) - lado / 2,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

/** El resplandor de marca detrás de todo, respirando. */
function Resplandor({ respiro, ancho }: { respiro: SharedValue<number>; ancho: number }) {
  const estilo = useAnimatedStyle(() => ({ opacity: 0.55 + respiro.value * 0.45, transform: [{ scale: 1 + respiro.value * 0.08 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.centrado, estilo]}>
      <BrandHalo size={ancho * 1.2} />
    </Animated.View>
  );
}

/** El punto del indicador: se estira y se ilumina siguiendo al dedo. */
function Punto({ indice, ancho, x }: { indice: number; ancho: number; x: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => {
    const cerca = 1 - Math.min(1, Math.abs(x.value / ancho - indice));
    return { width: 8 + cerca * 18, opacity: 0.35 + cerca * 0.65 };
  });
  return <Animated.View style={[styles.punto, estilo]} />;
}

const styles = StyleSheet.create({
  escenario: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.feedbackBorder.brand,
  },
  centrado: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  orbita: { position: 'absolute', borderWidth: 1, borderColor: alpha(color.brand.b400, 0.22) },
  particula: {
    position: 'absolute',
    backgroundColor: color.brand.b300,
    shadowColor: color.brand.b300,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  pagina: { alignItems: 'center', justifyContent: 'center' },
  texto: { gap: space.sm, marginTop: space.lg, minHeight: 170 },
  paso: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.feedbackSoft.success,
  },
  puntos: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  punto: { height: 8, borderRadius: 4, backgroundColor: color.action.primary },
});
