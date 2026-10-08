/**
 * La tarjeta Atlas: un objeto que se parece a una tarjeta de banco de verdad, con el acabado de su categoría.
 *
 * Los colores NO están escritos aquí: vienen del catálogo (`theme`), así que Atlas puede cambiar el aspecto de «Gold»
 * sin publicar la app. Lo que sí es de la app es el objeto y cómo responde:
 *  - **Material**: degradado del catálogo, metal cepillado y guilloché, chip EMV dorado, símbolo de pago sin contacto,
 *    el logotipo de Atlas y el nombre del titular en relieve. Todo vectorial: nítido en cualquier pantalla.
 *  - **Responde al dedo**: al tocarla se inclina en 3D hacia donde está el dedo, el reflejo se coloca bajo él y la
 *    sombra se desplaza al lado contrario; al soltar vuelve a su sitio con un muelle. Es la respuesta a «¿me hizo caso?».
 *  - **Fulgor, de menos a más** (Pablo, 2026-10-07): cada tarjeta brilla más que la anterior. El número (0-1) lo manda
 *    el backend en `theme.glow` y `fulgorDe` lo reparte: un halo del color de la tarjeta, más luz de ambiente, un
 *    barrido de luz que vuelve más seguido y destellos que titilan sobre el metal. La primera de la escalera queda
 *    sobria —barrido una sola vez, sin chispas— a propósito: es lo que hace que las de arriba se noten. Antes ninguna
 *    se movía sola; ahora el movimiento ES la diferencia entre una Normal y una Black, y por eso no es decoración.
 * Con «reducir movimiento» no hay inclinación, barrido ni chispas: la tarjeta queda quieta, con su halo, y completa.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { type GestureResponderEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { CardTier } from '../api/endpoints/credit-line';
import { etiquetaAccesible, fulgorDe } from '../features/tarjeta';
import { motion, radius, space, spring } from '../theme/tokens';
import { AtlasMark } from './brand';
import { Icon } from './icons';
import { PressSurface, suavidad } from './motion';
import { AtlasText } from './primitives';
import { Chispa, ChipEmv, ReflejoEspecular, SinContacto, TexturaMetal } from './tarjeta-atlas-piezas';

/** Proporción de una tarjeta de crédito (ISO/IEC 7810 ID-1: 85,60 × 53,98 mm). */
const PROPORCION = 1.586;
/** Cuánto se inclina como mucho, en grados. Más que esto deja de parecer una tarjeta en la mano y parece un error. */
const INCLINACION_MAX = 9;
/** Lo que tarda la banda de luz en cruzar la tarjeta. */
const BARRIDO_MS = motion.brandCut * 1.6;
/** Un ciclo de titilar de las chispas. Lento: se descubren al mirar, no reclaman la mirada. */
const TITILAR_MS = 3400;
/** Dónde titilan las chispas (fracción del ancho y del alto) y su tamaño relativo. Lejos del chip, del nombre y de la marca. */
const CHISPAS = [
  { x: 0.8, y: 0.24, tamano: 1 },
  { x: 0.36, y: 0.58, tamano: 0.7 },
  { x: 0.6, y: 0.4, tamano: 0.55 },
  { x: 0.9, y: 0.6, tamano: 0.8 },
] as const;

type Props = {
  tier: Pick<CardTier, 'label' | 'theme'>;
  /** `mini` es la miniatura de la escalera: sin relieve ni gestos, sólo el color, el logotipo y el nombre. */
  tamano?: 'grande' | 'mini';
  /** Desbloqueada = a color; si no, apagada con un candado. */
  bloqueada?: boolean;
  /** El nombre que va en relieve abajo a la izquierda, como en una tarjeta de banco. Sin él: «MIEMBRO ATLAS». */
  titular?: string | null;
  onPress?: () => void;
  testID?: string;
};

export function TarjetaAtlas({ tier, tamano = 'grande', bloqueada = false, titular, onPress, testID }: Props) {
  const grande = tamano === 'grande';
  const { gradient, accent } = tier.theme;
  const colores = (gradient.length >= 2 ? gradient : [gradient[0] ?? accent, gradient[0] ?? accent]) as [string, string, ...string[]];

  if (!grande) return <TarjetaMini tier={tier} colores={colores} bloqueada={bloqueada} testID={testID} />;

  const tarjeta = (
    <TarjetaGrande tier={tier} colores={colores} bloqueada={bloqueada} titular={titular} testID={testID} />
  );
  if (!onPress) return tarjeta;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiquetaAccesible(tier)}. Toca para ver tus tarjetas.`}
      testID={testID ? `${testID}-boton` : undefined}
    >
      {tarjeta}
    </PressSurface>
  );
}

function TarjetaGrande({
  tier,
  colores,
  bloqueada,
  titular,
  testID,
}: {
  tier: Pick<CardTier, 'label' | 'theme'>;
  colores: [string, string, ...string[]];
  bloqueada: boolean;
  titular?: string | null;
  testID?: string;
}) {
  const { ink, accent } = tier.theme;
  const reducido = useReducedMotion();
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  // Dónde está el dedo, de -1 a 1 en cada eje (0 = centro), y si la tarjeta está tocada.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const tocada = useSharedValue(0);
  // El barrido de luz de entrada: 0 → 1 una sola vez.
  const barrido = useSharedValue(0);
  // El reloj de las chispas: 0 → 1 en línea recta, sin fin. Cada chispa lo lee con su propio desfase.
  const titilar = useSharedValue(0);
  const interactiva = !bloqueada && !reducido;
  // Una tarjeta bloqueada no brilla: el fulgor es de la que ya se tiene.
  const fulgor = fulgorDe(bloqueada ? {} : tier.theme);
  const pausa = fulgor.barrido.pausaMs;
  // Qué parte del ciclo ocupa el cruce de la banda; el resto es la pausa. Sin pausa (una sola vez) el ciclo ES el cruce.
  const tramo = pausa === null ? 1 : BARRIDO_MS / (BARRIDO_MS + pausa);

  useEffect(() => {
    if (!interactiva || caja.ancho === 0) return;
    barrido.value = 0;
    barrido.value =
      pausa === null
        ? withDelay(motion.base, withTiming(1, { duration: BARRIDO_MS, easing: Easing.linear }))
        : withDelay(motion.base, withRepeat(withTiming(1, { duration: BARRIDO_MS + pausa, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(barrido);
  }, [barrido, caja.ancho, interactiva, pausa]);

  useEffect(() => {
    if (!interactiva || fulgor.chispas === 0) return;
    titilar.value = 0;
    titilar.value = withRepeat(withTiming(1, { duration: TITILAR_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(titilar);
  }, [titilar, interactiva, fulgor.chispas]);

  const seguir = (evento: GestureResponderEvent, empieza: boolean) => {
    if (!interactiva || caja.ancho === 0) return;
    const { locationX, locationY } = evento.nativeEvent;
    const nx = Math.max(-1, Math.min(1, (locationX / caja.ancho) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (locationY / caja.alto) * 2 - 1));
    x.value = withSpring(nx, spring.press);
    y.value = withSpring(ny, spring.press);
    if (empieza) {
      tocada.value = withSpring(1, spring.press);
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  const soltar = () => {
    x.value = withSpring(0, spring.glide);
    y.value = withSpring(0, spring.glide);
    tocada.value = withSpring(0, spring.glide);
  };

  const inclinacion = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      // El borde que tocas se hunde: tocar a la derecha gira la tarjeta hacia la derecha, como al apretarla con un dedo.
      { rotateY: `${x.value * INCLINACION_MAX}deg` },
      { rotateX: `${-y.value * INCLINACION_MAX}deg` },
      { scale: 1 - tocada.value * 0.015 },
    ],
  }));
  // La sombra se va al lado contrario de la inclinación: es lo que le da el peso de un objeto que se levanta de la mesa.
  const sombra = useAnimatedStyle(() => ({
    shadowOffset: { width: -x.value * 10, height: 10 - y.value * 6 },
    shadowOpacity: 0.34 + tocada.value * 0.12,
  }));
  const diametro = caja.ancho * 1.25;
  const reflejo = useAnimatedStyle(() => ({
    opacity: 0.35 + tocada.value * 0.65,
    transform: [
      { translateX: ((x.value + 1) / 2) * caja.ancho - diametro / 2 },
      { translateY: ((y.value + 1) / 2) * caja.alto - diametro / 2 },
    ],
  }));
  const banda = caja.ancho * 0.55;
  const destello = useAnimatedStyle(() => {
    // El ciclo corre en línea recta; la curva del cruce (arranca y frena suave) se pone aquí, sobre su tramo.
    const p = Math.min(1, barrido.value / tramo);
    const cruce = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [{ translateX: -banda * 1.4 + cruce * (caja.ancho + banda * 2.8) }, { rotate: '20deg' }],
    };
  });
  const tamanoChispa = caja.ancho * 0.09;

  return (
    <View style={styles.aire}>
      <Animated.View style={[styles.sombra, { backgroundColor: colores[0] }, sombra, inclinacion]}>
        {/*
          El halo: la tarjeta como fuente de luz. Es una sombra del color de su filo, sin desplazar, por DEBAJO de la
          cara; cuanto más fulgor, más ancha y más opaca. Quieto a propósito: es materia, no animación.
        */}
        {fulgor.halo.opacidad > 0 ? (
          <View
            pointerEvents="none"
            testID="tarjeta-halo"
            style={[styles.halo, { backgroundColor: colores[0], shadowColor: accent, shadowOpacity: fulgor.halo.opacidad, shadowRadius: fulgor.halo.radio }]}
          />
        ) : null}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${etiquetaAccesible(tier)}${bloqueada ? ', todavía bloqueada' : ''}`}
          testID={testID}
          style={[styles.grande, bloqueada && styles.bloqueada]}
          onLayout={(e) => setCaja({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
          onTouchStart={(e) => seguir(e, true)}
          onTouchMove={(e) => seguir(e, false)}
          onTouchEnd={soltar}
          onTouchCancel={soltar}
        >
          <LinearGradient colors={colores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.cara, { borderColor: accent }]}>
            <TexturaMetal ancho={caja.ancho} alto={caja.alto} tinta={ink} />
            {/* Luz de ambiente fija arriba a la izquierda: da volumen aunque nadie toque la tarjeta. */}
            <LinearGradient
              pointerEvents="none"
              colors={[`rgba(255,255,255,${fulgor.ambiente})`, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
            {interactiva && caja.ancho > 0 ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="tarjeta-destello">
                <Animated.View style={[styles.reflejo, reflejo]}>
                  <ReflejoEspecular diametro={diametro} />
                </Animated.View>
                <Animated.View style={[styles.banda, { width: banda }, destello]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', `rgba(255,255,255,${fulgor.barrido.opacidad})`, 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                {CHISPAS.slice(0, fulgor.chispas).map((chispa, indice) => (
                  <ChispaViva
                    key={indice}
                    reloj={titilar}
                    desfase={indice / Math.max(1, fulgor.chispas)}
                    brillo={0.55 + fulgor.nivel * 0.45}
                    tamano={tamanoChispa * chispa.tamano}
                    izquierda={caja.ancho * chispa.x}
                    arriba={caja.alto * chispa.y}
                    color={accent}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.contenido} pointerEvents="none">
              <View style={styles.fila}>
                <View style={styles.marca}>
                  <AtlasMark size={caja.ancho * 0.085 || 26} />
                  <AtlasText variant="overline" style={[styles.palabra, { color: ink }]}>
                    ATLAS
                  </AtlasText>
                </View>
                {bloqueada ? <Icon name="candado" size={20} tint={ink} /> : <SinContacto alto={caja.ancho * 0.07 || 22} color={ink} />}
              </View>

              <View style={styles.chip}>
                <ChipEmv ancho={caja.ancho * 0.15 || 46} />
              </View>

              <AtlasText variant="title" style={[styles.numero, styles.relieve, { color: ink }]}>
                •••• •••• •••• ••••
              </AtlasText>

              <View style={styles.pie}>
                <View style={styles.titular}>
                  <AtlasText variant="micro" style={[styles.etiqueta, { color: ink }]}>
                    TITULAR
                  </AtlasText>
                  <AtlasText variant="caption" numberOfLines={1} style={[styles.nombre, styles.relieve, { color: ink }]}>
                    {(titular?.trim() || 'Miembro Atlas').toUpperCase()}
                  </AtlasText>
                </View>
                <AtlasText variant="h1" style={[styles.relieve, { color: ink }]}>
                  {tier.label}
                </AtlasText>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Una chispa que titila: aparece creciendo, brilla un instante y se apaga. Todas leen el mismo reloj con su desfase,
 * así que nunca parpadean a la vez. La curva se eleva al cubo para que pase casi todo el ciclo apagada: un destello
 * es breve, y uno que está siempre encendido es un adorno pegado.
 */
function ChispaViva({
  reloj,
  desfase,
  brillo,
  tamano,
  izquierda,
  arriba,
  color,
}: {
  reloj: SharedValue<number>;
  desfase: number;
  brillo: number;
  tamano: number;
  izquierda: number;
  arriba: number;
  color: string;
}) {
  const estilo = useAnimatedStyle(() => {
    const t = Math.pow(suavidad(reloj.value, desfase, 1), 3);
    return { opacity: t * brillo, transform: [{ scale: 0.35 + t * 0.65 }, { rotate: `${t * 45}deg` }] };
  });
  return (
    <Animated.View testID="tarjeta-chispa" style={[styles.chispa, { left: izquierda - tamano / 2, top: arriba - tamano / 2 }, estilo]}>
      <Chispa tamano={tamano} color={color} />
    </Animated.View>
  );
}

/** La miniatura de la escalera: quieta, con el logotipo y el nombre. Es una muestra, no el objeto. */
function TarjetaMini({
  tier,
  colores,
  bloqueada,
  testID,
}: {
  tier: Pick<CardTier, 'label' | 'theme'>;
  colores: [string, string, ...string[]];
  bloqueada: boolean;
  testID?: string;
}) {
  const { ink, accent } = tier.theme;
  // La miniatura no se mueve, pero su halo sí sigue la escalera: de un vistazo se ve cuál brilla más.
  const { halo } = fulgorDe(bloqueada ? {} : tier.theme);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${etiquetaAccesible(tier)}${bloqueada ? ', todavía bloqueada' : ''}`}
      testID={testID}
      style={[
        styles.mini,
        bloqueada && styles.bloqueada,
        halo.opacidad > 0 && { backgroundColor: colores[0], shadowColor: accent, shadowOpacity: halo.opacidad, shadowRadius: halo.radio / 3, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <LinearGradient colors={colores} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.caraMini, { borderColor: accent }]}>
        <View style={styles.contenidoMini}>
          <View style={styles.fila}>
            <AtlasMark size={14} />
            {bloqueada ? <Icon name="candado" size={14} tint={ink} /> : null}
          </View>
          <AtlasText variant="caption" style={{ color: ink }}>
            {tier.label}
          </AtlasText>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // La sombra y la inclinación necesitan aire: la tarjeta gira unos grados y su sombra se extiende; sin margen chocaría
  // con lo de arriba, lo de abajo y los bordes de la pantalla.
  aire: { paddingVertical: space.lg, paddingHorizontal: space.sm },
  sombra: { borderRadius: radius.xxl, shadowColor: '#000000', shadowRadius: 18, elevation: 10 },
  grande: { width: '100%', aspectRatio: PROPORCION, borderRadius: radius.xxl, overflow: 'hidden' },
  // Sin `overflow: hidden` aquí: lo recorta la cara de dentro, y así el halo puede salir por fuera.
  mini: { width: 86, aspectRatio: PROPORCION, borderRadius: radius.md },
  bloqueada: { opacity: 0.45 },
  cara: { borderRadius: radius.xxl, borderWidth: 1, overflow: 'hidden' },
  caraMini: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  contenido: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  contenidoMini: { flex: 1, padding: space.sm, justifyContent: 'space-between' },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  // El logotipo va abierto, con aire entre letras, como en la marca: no con el interletraje apretado de un titular.
  palabra: { letterSpacing: 4 },
  chip: { marginTop: -space.xs },
  numero: { letterSpacing: 2.5, fontVariant: ['tabular-nums'] },
  // Relieve: una sombra de un píxel abajo y a la derecha, como el número estampado de una tarjeta física.
  relieve: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0.6, height: 1 }, textShadowRadius: 0.8 },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  titular: { flexShrink: 1, gap: 1 },
  etiqueta: { opacity: 0.7, letterSpacing: 1.5 },
  nombre: { letterSpacing: 1.6 },
  // Mismo recorte que la cara, para que la luz salga del canto de la tarjeta y no de un rectángulo.
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.xxl, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  chispa: { position: 'absolute' },
  reflejo: { position: 'absolute', top: 0, left: 0 },
  banda: { position: 'absolute', top: -60, bottom: -60 },
});
