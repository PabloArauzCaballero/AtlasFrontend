/**
 * La celebración de un logro: la escena a pantalla completa al ganar una insignia o subir de nivel.
 *
 * Pablo (2026-10-07): «una animación ultra HD, mucho mejor que la que tenemos, al ganar cada insignia o logro; que
 * alimente la dopamina de la gente». Cuándo se lanza está en `features/celebraciones.ts`; aquí es sólo la escena.
 *
 * ## Qué pasa, en orden (≈ 2,6 s)
 *
 * 1. La pantalla se oscurece y detrás aparece el halo del metal del rango (rayos giratorios desde el oro).
 * 2. El trofeo CAE desde arriba y GOLPEA: se aplasta, rebasa y se asienta (el muelle `spring.logro`, el único
 *    subamortiguado de la app). En ese instante: destello blanco, tres ondas de choque, ráfaga de confeti y el tacto
 *    (pesado + éxito + una cascada de golpecitos en los rangos altos).
 * 3. Un barrido de luz cruza el metal —recortado a la silueta, no a un rectángulo—.
 * 4. Entra el texto, línea a línea: qué ganaste, de qué colección, y LO SIGUIENTE más cercano. Esa última línea es
 *    deliberada: el logro cerrado empuja al siguiente, que ya está a medio camino (efecto de gradiente de meta).
 *
 * Más rango, más fiesta: 16 partículas en bronce, 64 en diamante; los rayos sólo desde el oro; el diamante suma
 * colores de prisma. Un bronce no debe sentirse igual que un diamante, o los difíciles dejan de serlo.
 *
 * ## Por qué no es un `Modal`
 *
 * Es una capa absoluta montada en el layout. Un `Modal` de React Native presentado en ráfaga colgó iOS (`ui/tour.tsx`),
 * y aquí pueden encadenarse varias seguidas.
 *
 * ## Movimiento reducido
 *
 * Sin caída, sin partículas, sin rayos: la misma información, ya puesta. El contenido nunca depende de la animación.
 */
import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOMBRE_COLECCION, type Logro } from '../features/celebraciones';
import { ICONO_DE_ESCALON } from '../features/nivel';
import { color, easing, luz, motion, space, spring, marca } from '../theme/tokens';
import { EscudoDeNivel } from './escudo-de-nivel';
import { caraDe } from './insignia';
import { AtlasText, Escenario, Button, ProgressBar } from './primitives';
import { Medalla, SILUETA_MEDALLA } from './medalla';
import { METAL, type Rango } from './trofeo';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Cuántas partículas suelta cada rango: la fiesta crece con la dificultad. */
export const PARTICULAS: Record<Rango, number> = { bronce: 16, plata: 24, oro: 34, platino: 46, diamante: 64 };
const CON_RAYOS: ReadonlySet<Rango> = new Set(['oro', 'platino', 'diamante']);

/** Lo que dice cada rango al ganar: distinto cada vez, para que no se lea como un cartel repetido. */
export const ARENGA: Record<Rango, string> = {
  bronce: '¡Buen comienzo!',
  plata: '¡Vas muy bien!',
  oro: '¡Esto ya es de campeón!',
  platino: '¡Casi nadie llega aquí!',
  diamante: `¡Eres leyenda en ${marca.nombre}!`,
};

/** Aleatorio determinista por partícula: la misma ráfaga siempre, y pruebas que no dependen del azar. */
export function azar(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Trazo = { angulo: number; velocidad: number; tam: number; color: string; forma: 0 | 1 | 2; giro: number; voltea: number; retardo: number };

export function trazoDe(i: number, rango: Rango, escala: number): Trazo {
  const colores = METAL[rango].chispas;
  return {
    angulo: azar(i, 1) * Math.PI * 2,
    velocidad: (110 + azar(i, 2) * 260) * escala,
    tam: 5 + azar(i, 3) * 7,
    color: colores[Math.floor(azar(i, 4) * colores.length)]!,
    forma: (i % 3) as 0 | 1 | 2,
    giro: (azar(i, 5) - 0.5) * 1080,
    voltea: 6 + azar(i, 6) * 14,
    retardo: azar(i, 7) * 0.12,
  };
}

function Particula({ i, rafaga, rango, escala }: { i: number; rafaga: SharedValue<number>; rango: Rango; escala: number }) {
  const t = useMemo(() => trazoDe(i, rango, escala), [i, rango, escala]);
  const gravedad = 300 * escala;
  const estilo = useAnimatedStyle(() => {
    const u = Math.min(1, Math.max(0, (rafaga.value - t.retardo) / (1 - t.retardo)));
    const e = 1 - Math.pow(1 - u, 3);
    return {
      opacity: u <= 0 ? 0 : u < 0.62 ? 1 : Math.max(0, 1 - (u - 0.62) / 0.38),
      transform: [
        { translateX: Math.cos(t.angulo) * t.velocidad * e },
        { translateY: Math.sin(t.angulo) * t.velocidad * e + gravedad * u * u },
        { rotate: `${t.giro * u}deg` },
        // Mientras vuela, el confeti se voltea: de canto casi desaparece, de cara brilla.
        { scaleY: Math.cos(u * t.voltea) },
      ],
    };
  });
  const base = { position: 'absolute' as const, backgroundColor: t.color };
  if (t.forma === 2)
    return (
      <Animated.View style={[styles.particula, estilo]} pointerEvents="none">
        <Svg width={t.tam * 2} height={t.tam * 2} viewBox="0 0 24 24">
          <Path d="M12 1 14.6 9.4 23 12 14.6 14.6 12 23 9.4 14.6 1 12 9.4 9.4Z" fill={t.color} />
        </Svg>
      </Animated.View>
    );
  return (
    <Animated.View
      style={[styles.particula, estilo, base, t.forma === 1 ? { width: t.tam, height: t.tam, borderRadius: t.tam / 2 } : { width: t.tam, height: t.tam * 0.5, borderRadius: 1.5 }]}
      pointerEvents="none"
    />
  );
}

/** Una onda de choque: un anillo que sale del trofeo y se desvanece. */
function Onda({ progreso, rango, lado }: { progreso: SharedValue<number>; rango: Rango; lado: number }) {
  const estilo = useAnimatedStyle(() => ({ opacity: (1 - progreso.value) * 0.75, transform: [{ scale: 0.3 + progreso.value * 2.6 }] }));
  return <Animated.View style={[styles.onda, { width: lado, height: lado, borderRadius: lado / 2, borderColor: METAL[rango].luz }, estilo]} pointerEvents="none" />;
}

/** Los rayos: cuñas que giran despacio detrás del trofeo. */
function Rayos({ rango, lado }: { rango: Rango; lado: number }) {
  const m = METAL[rango];
  const cuñas = Array.from({ length: 12 }, (_, k) => {
    const a0 = (k * 30 * Math.PI) / 180;
    const a1 = ((k * 30 + 12) * Math.PI) / 180;
    return `M100 100 L${100 + 100 * Math.cos(a0)} ${100 + 100 * Math.sin(a0)} L${100 + 100 * Math.cos(a1)} ${100 + 100 * Math.sin(a1)} Z`;
  });
  return (
    <Svg width={lado} height={lado} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`rayos-${rango}`} cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={m.halo} stopOpacity={0.55} />
          <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {cuñas.map((d, k) => (
        <Path key={k} d={d} fill={`url(#rayos-${rango})`} />
      ))}
    </Svg>
  );
}

/** Una línea de texto que entra con retardo: sube 14 px y aparece. */
function useEntrada(retardo: number, activo: boolean) {
  const v = useSharedValue(activo ? 0 : 1);
  useEffect(() => {
    if (activo) v.value = withDelay(retardo, withTiming(1, { duration: motion.base + 80, easing: Easing.bezier(...easing.decelerate) }));
    else v.value = 1;
  }, [activo, retardo, v]);
  return useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 14 }] }));
}

export function CelebracionDeLogro({
  logro,
  posicion,
  masSinMostrar = 0,
  onCerrar,
}: {
  logro: Logro;
  /** «2 de 3» cuando hay varias seguidas. */
  posicion: { actual: number; total: number };
  masSinMostrar?: number;
  onCerrar: () => void;
}) {
  const reducido = useReducedMotion();
  const animar = !reducido;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rango = logro.rango;
  const m = METAL[rango];
  const lado = Math.round(Math.min(250, width * 0.62));
  const escala = lado / 250;
  const esNivel = logro.tipo === 'nivel';
  const cara = logro.tipo === 'insignia' ? caraDe(logro.insignia) : null;
  const titulo = logro.tipo === 'insignia' ? logro.insignia.label : logro.nivel.label;
  const clave = logro.tipo === 'insignia' ? logro.insignia.code : `nivel-${logro.nivel.id}`;
  const n = PARTICULAS[rango] * (esNivel ? 1.25 : 1);

  const fondo = useSharedValue(animar ? 0 : 1);
  const caida = useSharedValue(animar ? 0 : 1);
  const golpe = useSharedValue(0);
  const brillo = useSharedValue(animar ? 0 : 1);
  const destello = useSharedValue(0);
  const rafaga = useSharedValue(0);
  const barrido = useSharedValue(0);
  const rayos = useSharedValue(0);
  const ondas = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${esNivel ? 'Subiste de nivel' : 'Ganaste una insignia'}: ${titulo}.`);
    if (!animar) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const golpecito = (ms: number, estilo: Haptics.ImpactFeedbackStyle) => en(ms, () => void Haptics.impactAsync(estilo).catch(() => {}));

    fondo.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.quad) });
    caida.value = withDelay(120, withTiming(1, { duration: motion.celebracion.caida, easing: Easing.in(Easing.quad) }));
    const impacto = 120 + motion.celebracion.caida;
    en(impacto, () => {
      golpe.value = withSequence(withTiming(-0.1, { duration: 70 }), withSpring(0, spring.logro));
      destello.value = withSequence(withTiming(0.55, { duration: 60 }), withTiming(0, { duration: 420 }));
      brillo.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      rafaga.value = withTiming(1, { duration: motion.celebracion.rafaga, easing: Easing.linear });
      ondas.forEach((o, k) => {
        o.value = withDelay(k * 150, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
      });
      barrido.value = withDelay(120, withTiming(1, { duration: motion.celebracion.barrido, easing: Easing.inOut(Easing.quad) }));
      if (CON_RAYOS.has(rango)) {
        rayos.value = withTiming(1, { duration: 900 });
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      en(110, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}));
    });
    // Rangos altos: una cascada de golpecitos mientras el confeti cae. Es el «ding ding ding» de las monedas.
    const cascada = rango === 'oro' ? 3 : rango === 'platino' ? 5 : rango === 'diamante' ? 8 : 0;
    for (let k = 0; k < cascada; k += 1) golpecito(impacto + 420 + k * 95, Haptics.ImpactFeedbackStyle.Light);
    // Un segundo barrido de luz, ya con el texto puesto: el metal se vuelve a ver.
    en(impacto + 1700, () => {
      barrido.value = 0;
      barrido.value = withTiming(1, { duration: motion.celebracion.barrido, easing: Easing.inOut(Easing.quad) });
    });
    return () => {
      timers.forEach(clearTimeout);
      [fondo, caida, golpe, brillo, destello, rafaga, barrido, rayos, ...ondas].forEach((v) => cancelAnimation(v));
    };
    // Una sola vez por logro: `clave` cambia al pasar al siguiente de la cola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, animar]);

  const giroRayos = useSharedValue(0);
  useEffect(() => {
    if (!animar || !CON_RAYOS.has(rango)) return;
    giroRayos.value = 0;
    giroRayos.value = withRepeat(withTiming(360, { duration: motion.celebracion.rayos, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(giroRayos);
  }, [animar, clave, rango, giroRayos]);

  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));
  const estiloHeroe = useAnimatedStyle(() => ({
    opacity: Math.min(1, caida.value * 3),
    transform: [{ translateY: (1 - caida.value) * -height * 0.55 }, { scale: (0.5 + 0.5 * caida.value) * (1 + golpe.value) }],
  }));
  const estiloBrillo = useAnimatedStyle(() => ({ opacity: brillo.value, transform: [{ scale: 0.5 + brillo.value * 0.5 }] }));
  const estiloRayos = useAnimatedStyle(() => ({ opacity: rayos.value * 0.9, transform: [{ rotate: `${giroRayos.value}deg` }] }));
  const estiloDestello = useAnimatedStyle(() => ({ opacity: destello.value }));
  const propsBarrido = useAnimatedProps(() => ({ x: -30 + barrido.value * 140 }));

  const eArenga = useEntrada(animar ? 780 : 0, animar);
  const eTitulo = useEntrada(animar ? 880 : 0, animar);
  const eDetalle = useEntrada(animar ? 1000 : 0, animar);
  const eSiguiente = useEntrada(animar ? 1180 : 0, animar);
  const eBoton = useEntrada(animar ? 1400 : 0, animar);

  const barridoLuz = (
    <>
      <Defs>
        <ClipPath id={`clip-${clave}`}>
          <Path d={SILUETA_MEDALLA} />
        </ClipPath>
        <LinearGradient id={`luz-${clave}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={luz.blanco} stopOpacity={0} />
          <Stop offset="0.5" stopColor={luz.blanco} stopOpacity={0.85} />
          <Stop offset="1" stopColor={luz.blanco} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#clip-${clave})`}>
        <AnimatedRect animatedProps={propsBarrido} y={0} width={26} height={96} fill={`url(#luz-${clave})`} transform="skewX(-18)" />
      </G>
    </>
  );

  const ultimo = posicion.actual >= posicion.total;
  const coleccion = logro.tipo === 'insignia' ? logro.coleccion : null;
  const sig = logro.tipo === 'insignia' ? logro.siguiente : null;
  const porcentajeSig = sig && sig.target > 0 ? Math.round((sig.current / sig.target) * 100) : 0;
  const puntosSig = logro.tipo === 'nivel' ? logro.siguiente : null;

  return (
    <Escenario>
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      testID="celebracion-logro"
      accessibilityLabel={`${esNivel ? 'Subiste de nivel' : 'Insignia ganada'}: ${titulo}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, estiloFondo]} pointerEvents="none" />

      <View style={[styles.centro, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        <View style={[styles.escena, { width: lado * 2, height: lado * 1.35 }]} pointerEvents="none">
          {CON_RAYOS.has(rango) && animar ? (
            <Animated.View style={[styles.capa, estiloRayos]}>
              <Rayos rango={rango} lado={Math.min(width * 1.7, 560)} />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.capa, estiloBrillo]}>
            <Svg width={lado * 2} height={lado * 2} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id={`halo-${clave}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={m.halo} stopOpacity={0.6} />
                  <Stop offset="0.55" stopColor={m.halo} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={100} height={100} fill={`url(#halo-${clave})`} />
            </Svg>
          </Animated.View>
          {animar ? ondas.map((o, k) => <Onda key={k} progreso={o} rango={rango} lado={lado * 0.7} />) : null}

          <Animated.View style={[styles.capa, estiloHeroe]}>
            {logro.tipo === 'insignia' ? (
              <Medalla codigo={clave} rango={rango} icono={cara?.icon ?? 'estrella'} ganado lado={lado}>
                {animar ? barridoLuz : null}
              </Medalla>
            ) : (
              <EscudoDeNivel rango={rango} icono={ICONO_DE_ESCALON[logro.nivel.id] ?? 'estrella'} numero={logro.nivel.index} de={logro.nivel.of} lado={lado} />
            )}
          </Animated.View>

          {animar ? Array.from({ length: Math.round(n) }, (_, i) => <Particula key={i} i={i} rafaga={rafaga} rango={rango} escala={escala} />) : null}
        </View>

        <View style={styles.texto}>
          <Animated.View style={eArenga}>
            <AtlasText variant="overline" align="center" style={{ color: m.luz }}>
              {esNivel ? '¡SUBISTE DE NIVEL!' : `¡INSIGNIA DE ${m.nombre.toUpperCase()}!`}
            </AtlasText>
          </Animated.View>
          <Animated.View style={eTitulo}>
            <AtlasText variant="hero" align="center" numberOfLines={2} accessibilityRole="header">
              {titulo}
            </AtlasText>
            <AtlasText variant="bodyStrong" align="center" style={{ color: m.medio }}>
              {ARENGA[rango]}
            </AtlasText>
          </Animated.View>
          <Animated.View style={[styles.bloque, eDetalle]}>
            <AtlasText variant="body" tone="secondary" align="center">
              {esNivel ? `Nivel ${logro.nivel.index} de ${logro.nivel.of}. Tus compras con ${marca.nombre} te trajeron hasta aquí.` : (cara?.detail ?? '')}
            </AtlasText>
            {coleccion ? (
              <AtlasText variant="captionStrong" align="center" style={{ color: m.luz }}>
                {`Colección «${NOMBRE_COLECCION[logro.tipo === 'insignia' ? (logro.insignia.category ?? 'pagos') : 'pagos']}»: ${coleccion.ganadas} de ${coleccion.total}`}
              </AtlasText>
            ) : null}
          </Animated.View>
          {sig || puntosSig ? (
            <Animated.View style={[styles.siguiente, eSiguiente]}>
              <AtlasText variant="caption" tone="secondary" align="center">
                {sig
                  ? `Lo próximo: «${sig.label}» · ${sig.current.toLocaleString('es-BO')} de ${sig.target.toLocaleString('es-BO')}`
                  : `Lo próximo: «${puntosSig!.label}» · te faltan ${puntosSig!.pointsMissing.toLocaleString('es-BO')} puntos`}
              </AtlasText>
              <ProgressBar value={sig ? porcentajeSig : (puntosSig?.porcentaje ?? 0)} label="Avance hacia lo próximo" />
            </Animated.View>
          ) : null}
          {ultimo && masSinMostrar > 0 ? (
            <AtlasText variant="caption" tone="tertiary" align="center">
              {`Y ${masSinMostrar} ${masSinMostrar === 1 ? 'logro más' : 'logros más'} te esperan en tu vitrina.`}
            </AtlasText>
          ) : null}
          <Animated.View style={[styles.boton, eBoton]}>
            <Button
              label={ultimo ? '¡Genial!' : `Siguiente (${posicion.actual} de ${posicion.total})`}
              onPress={onCerrar}
              haptic="light"
              testID="celebracion-cerrar"
            />
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.destello, estiloDestello]} pointerEvents="none" />
      {/* Tocar fuera del botón no cierra: un toque suelto al ganar no debe llevarse el premio sin leerlo. */}
    </View>
    </Escenario>
  );
}

const styles = StyleSheet.create({
  fondo: { backgroundColor: color.stage.scrim },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  escena: { alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  particula: { position: 'absolute' },
  onda: { position: 'absolute', borderWidth: 3 },
  texto: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch', maxWidth: 420, marginTop: space.md },
  bloque: { gap: space.xs, alignItems: 'center' },
  siguiente: { alignSelf: 'stretch', gap: space.xs, paddingTop: space.xs },
  boton: { alignSelf: 'stretch', marginTop: space.md },
  destello: { backgroundColor: luz.blanco },
});
