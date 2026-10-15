/**
 * La celebración de un logro: la escena a pantalla completa al ganar una insignia o subir de nivel.
 *
 * Pablo (2026-10-07): «una animación ultra HD, mucho mejor que la que tenemos, al ganar cada insignia o logro; que
 * alimente la dopamina de la gente». Y el 2026-10-15: «se ven pobres; mejoremos la orquestación y los visuales». Cuándo
 * se lanza está en `features/celebraciones.ts`; aquí es sólo la escena.
 *
 * ## El ritmo, en cinco tiempos (≈ 2,8 s)
 *
 * 1. **Anticipación** (`motion.celebracion.carga`): el escenario se abre y el halo del metal se enciende y se recoge, con
 *    un toque leve. Es el «¿qué viene?»: sin él, el golpe llegaba sin aviso y se leía como un salto.
 * 2. **Impacto**: la medalla CAE y GOLPEA —se aplasta, rebasa y se asienta con `spring.logro`, el único muelle
 *    subamortiguado de la app—. Destello, ondas de choque, chispas y el tacto (pesado + éxito).
 * 3. **Recompensa**: el barrido de luz cruza el metal recortado a la silueta y, en los rangos altos, una cascada de
 *    golpecitos acompaña a las chispas. Los rayos sólo desde el oro.
 * 4. **Texto**, línea a línea y en orden de importancia: qué rango, el NOMBRE (lo más grande), la arenga, para qué
 *    sirve, la colección con sus casillas y LO PRÓXIMO con su barra (gradiente de meta: el logro cerrado empuja al
 *    siguiente, que ya está a medio camino).
 * 5. **Acción**: el botón entra el último, cuando ya se leyó lo que se ganó.
 *
 * ## Varias seguidas son UNA ceremonia
 *
 * Con `continua` el escenario ya está abierto: no se vuelve a fundir el fondo entre un logro y el siguiente, sólo se
 * releva la medalla (`motion.celebracion.relevo`). El contador dice «2 de 3» sobre el total de la ceremonia, el nivel
 * cierra siempre (lo ordena `celebraciones.ts`) y, mientras quede más de una, «Saltar todas» las cierra de una vez.
 *
 * ## Por qué no es un `Modal`
 *
 * Es una capa absoluta montada en el layout. Un `Modal` de React Native presentado en ráfaga colgó iOS (`ui/tour.tsx`),
 * y aquí pueden encadenarse varias seguidas.
 *
 * ## El escenario es opaco
 *
 * Antes era un velo al 96 % y la portada se seguía leyendo detrás: el rótulo «¡INSIGNIA DE ORO!» se montaba encima del
 * botón «Escanear QR». Ahora es el fondo del escenario entero, y el color del rango sale de `acentoDe`, que en claro usa
 * el tono profundo del metal (el brillo amarillo pálido no se leía sobre blanco).
 *
 * ## Movimiento reducido
 *
 * Sin caída, sin chispas, sin rayos: la misma información, ya puesta. El contenido nunca depende de la animación.
 */
import { useEffect, useMemo, useRef } from 'react';
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
import { color, easing, esquema, luz, marca, motion, radius, space, spring } from '../theme/tokens';
import { EscudoDeNivel } from './escudo-de-nivel';
import { caraDe } from './insignia';
import { AtlasText, Escenario, Button, ProgressBar } from './primitives';
import { Medalla, SILUETA_MEDALLA } from './medalla';
import { acentoDe, METAL, type Rango } from './trofeo';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const claro = esquema === 'claro';

/** Cuántas chispas suelta cada rango: la fiesta crece con la dificultad. */
export const PARTICULAS: Record<Rango, number> = { bronce: 14, plata: 20, oro: 28, platino: 38, diamante: 52 };
const CON_RAYOS: ReadonlySet<Rango> = new Set(['oro', 'platino', 'diamante']);

/** Lo que dice cada rango al ganar: distinto cada vez, para que no se lea como un cartel repetido. */
export const ARENGA: Record<Rango, string> = {
  bronce: '¡Buen comienzo!',
  plata: '¡Vas muy bien!',
  oro: '¡Esto ya es de campeón!',
  platino: '¡Casi nadie llega aquí!',
  diamante: `¡Eres leyenda en ${marca.nombre}!`,
};

/** Cuántos golpecitos acompañan a las chispas en cada rango: el «ding ding ding» de las monedas. */
export const CASCADA: Record<Rango, number> = { bronce: 0, plata: 0, oro: 3, platino: 5, diamante: 8 };

/** Aleatorio determinista por partícula: la misma ráfaga siempre, y pruebas que no dependen del azar. */
export function azar(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Una chispa. Dos de cada tres son destellos de cuatro puntas y el resto motas redondas: el «confeti» de papelitos
 * rectangulares de antes se leía como una plantilla de fiesta, no como metal que suelta brillo.
 */
type Trazo = { angulo: number; velocidad: number; tam: number; color: string; forma: 0 | 1; giro: number; retardo: number; titila: number };

export function trazoDe(i: number, rango: Rango, escala: number): Trazo {
  const colores = METAL[rango].chispas;
  return {
    angulo: azar(i, 1) * Math.PI * 2,
    velocidad: (120 + azar(i, 2) * 230) * escala,
    tam: 4 + azar(i, 3) * 6,
    color: colores[Math.floor(azar(i, 4) * colores.length)]!,
    forma: i % 3 === 2 ? 1 : 0,
    giro: (azar(i, 5) - 0.5) * 540,
    retardo: azar(i, 7) * 0.12,
    titila: 8 + azar(i, 6) * 10,
  };
}

function Particula({ i, rafaga, rango, escala }: { i: number; rafaga: SharedValue<number>; rango: Rango; escala: number }) {
  const t = useMemo(() => trazoDe(i, rango, escala), [i, rango, escala]);
  const gravedad = 140 * escala;
  const estilo = useAnimatedStyle(() => {
    const u = Math.min(1, Math.max(0, (rafaga.value - t.retardo) / (1 - t.retardo)));
    const e = 1 - Math.pow(1 - u, 3);
    // Titilan mientras caen: el brillo sube y baja, que es lo que distingue una chispa de un papelito.
    const brillo = 0.55 + 0.45 * Math.abs(Math.cos(u * t.titila));
    return {
      opacity: u <= 0 ? 0 : (u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45)) * brillo,
      transform: [
        { translateX: Math.cos(t.angulo) * t.velocidad * e },
        { translateY: Math.sin(t.angulo) * t.velocidad * e + gravedad * u * u },
        { rotate: `${t.giro * u}deg` },
        { scale: 1 - 0.5 * u },
      ],
    };
  });
  if (t.forma === 0)
    return (
      <Animated.View style={[styles.particula, estilo]} pointerEvents="none">
        <Svg width={t.tam * 2} height={t.tam * 2} viewBox="0 0 24 24">
          <Path d="M12 0 13.6 10.4 24 12 13.6 13.6 12 24 10.4 13.6 0 12 10.4 10.4Z" fill={t.color} />
        </Svg>
      </Animated.View>
    );
  return <Animated.View style={[styles.particula, estilo, { width: t.tam * 0.7, height: t.tam * 0.7, borderRadius: t.tam, backgroundColor: t.color }]} pointerEvents="none" />;
}

/** Una onda de choque: un anillo fino que sale de la medalla y se desvanece. */
function Onda({ progreso, rango, lado }: { progreso: SharedValue<number>; rango: Rango; lado: number }) {
  const estilo = useAnimatedStyle(() => ({ opacity: (1 - progreso.value) * 0.6, transform: [{ scale: 0.4 + progreso.value * 2.2 }] }));
  return <Animated.View style={[styles.onda, { width: lado, height: lado, borderRadius: lado / 2, borderColor: claro ? METAL[rango].medio : METAL[rango].luz }, estilo]} pointerEvents="none" />;
}

/** Los rayos: cuñas finas que giran despacio detrás de la medalla, más tenues en claro (sobre blanco se comían la escena). */
function Rayos({ rango, lado }: { rango: Rango; lado: number }) {
  const m = METAL[rango];
  const cuñas = Array.from({ length: 16 }, (_, k) => {
    const a0 = (k * 22.5 * Math.PI) / 180;
    const a1 = ((k * 22.5 + 7) * Math.PI) / 180;
    return `M100 100 L${100 + 100 * Math.cos(a0)} ${100 + 100 * Math.sin(a0)} L${100 + 100 * Math.cos(a1)} ${100 + 100 * Math.sin(a1)} Z`;
  });
  return (
    <Svg width={lado} height={lado} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id={`rayos-${rango}`} cx="100" cy="100" r="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0.12" stopColor={m.halo} stopOpacity={claro ? 0.35 : 0.5} />
          <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {cuñas.map((d, k) => (
        <Path key={k} d={d} fill={`url(#rayos-${rango})`} />
      ))}
    </Svg>
  );
}

/** Una línea de texto que entra con retardo: sube 12 px y aparece. */
function useEntrada(retardo: number, activo: boolean) {
  const v = useSharedValue(activo ? 0 : 1);
  useEffect(() => {
    if (activo) v.value = withDelay(retardo, withTiming(1, { duration: motion.base + 80, easing: Easing.bezier(...easing.decelerate) }));
    else v.value = 1;
  }, [activo, retardo, v]);
  return useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 12 }] }));
}

/** Las casillas de la colección: una por insignia, llenas las ganadas. Se ve de un vistazo cuánto falta para cerrarla. */
function Casillas({ ganadas, total, tinta }: { ganadas: number; total: number; tinta: string }) {
  if (total > 12) return null;
  return (
    <View style={styles.casillas} accessible={false}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.casilla, i < ganadas ? { backgroundColor: tinta, borderColor: tinta } : null]} />
      ))}
    </View>
  );
}

export function CelebracionDeLogro({
  logro,
  posicion,
  masSinMostrar = 0,
  continua = false,
  onCerrar,
  onSaltarTodas,
}: {
  logro: Logro;
  /** «2 de 3» sobre el total de la ceremonia, cuando hay varias seguidas. */
  posicion: { actual: number; total: number };
  masSinMostrar?: number;
  /** Viene detrás de otro logro de la misma ceremonia: el escenario ya está abierto y no se vuelve a fundir. */
  continua?: boolean;
  onCerrar: () => void;
  /** Cierra la ceremonia entera. Sólo se ofrece mientras quede más de un logro. */
  onSaltarTodas?: () => void;
}) {
  const reducido = useReducedMotion();
  const animar = !reducido;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rango = logro.rango;
  const m = METAL[rango];
  const acento = acentoDe(rango);
  // La escena no puede pasar del 34 % del alto: en un teléfono bajo el texto y el botón tienen que caber sin desplazar.
  const lado = Math.round(Math.min(230, width * 0.58, height * 0.3));
  const escala = lado / 230;
  const esNivel = logro.tipo === 'nivel';
  const cara = logro.tipo === 'insignia' ? caraDe(logro.insignia) : null;
  const titulo = logro.tipo === 'insignia' ? logro.insignia.label : logro.nivel.label;
  const clave = logro.tipo === 'insignia' ? logro.insignia.code : `nivel-${logro.nivel.id}`;
  const n = Math.round(PARTICULAS[rango] * (esNivel ? 1.25 : 1));

  const fondo = useSharedValue(animar && !continua ? 0 : 1);
  const carga = useSharedValue(0);
  const caida = useSharedValue(animar ? 0 : 1);
  const golpe = useSharedValue(0);
  const brillo = useSharedValue(animar ? 0 : 1);
  const destello = useSharedValue(0);
  const rafaga = useSharedValue(0);
  const barrido = useSharedValue(0);
  const rayos = useSharedValue(0);
  const salida = useSharedValue(0);
  const ondas = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const cerrando = useRef(false);

  // Con la ceremonia ya abierta, la anticipación es más corta: el halo ya está a la vista.
  const anticipacion = continua ? motion.celebracion.relevo : motion.celebracion.carga;
  const impacto = anticipacion + motion.celebracion.caida;
  /** Cuándo entra cada línea de texto: tras el golpe, en orden de importancia. */
  const tras = (ms: number) => (animar ? impacto + ms : 0);

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${esNivel ? 'Subiste de nivel' : 'Ganaste una insignia'}: ${titulo}.`);
    if (!animar) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const toque = (ms: number, estilo: Haptics.ImpactFeedbackStyle) => en(ms, () => void Haptics.impactAsync(estilo).catch(() => {}));

    // 1. Anticipación: el escenario se abre y el halo se carga.
    if (!continua) fondo.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.quad) });
    carga.value = withSequence(withTiming(1, { duration: anticipacion * 0.7, easing: Easing.out(Easing.quad) }), withTiming(0.6, { duration: anticipacion * 0.3 }));
    toque(anticipacion * 0.4, Haptics.ImpactFeedbackStyle.Light);
    // 2. La caída: acelera hacia el golpe.
    caida.value = withDelay(anticipacion, withTiming(1, { duration: motion.celebracion.caida, easing: Easing.in(Easing.quad) }));
    en(impacto, () => {
      golpe.value = withSequence(withTiming(-0.1, { duration: 70 }), withSpring(0, spring.logro));
      destello.value = withSequence(withTiming(claro ? 0.35 : 0.5, { duration: 60 }), withTiming(0, { duration: 420 }));
      brillo.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      carga.value = withTiming(0, { duration: 500 });
      rafaga.value = withTiming(1, { duration: motion.celebracion.rafaga, easing: Easing.linear });
      ondas.forEach((o, k) => {
        o.value = withDelay(k * 140, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
      });
      // 3. La recompensa: la luz cruza el metal.
      barrido.value = withDelay(140, withTiming(1, { duration: motion.celebracion.barrido, easing: Easing.inOut(Easing.quad) }));
      if (CON_RAYOS.has(rango)) rayos.value = withTiming(1, { duration: 900 });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      en(110, () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}));
    });
    for (let k = 0; k < CASCADA[rango]; k += 1) toque(impacto + 420 + k * 95, Haptics.ImpactFeedbackStyle.Light);
    // Un segundo barrido, ya con el texto leído: el metal se vuelve a ver.
    en(impacto + 1900, () => {
      barrido.value = 0;
      barrido.value = withTiming(1, { duration: motion.celebracion.barrido, easing: Easing.inOut(Easing.quad) });
    });
    return () => {
      timers.forEach(clearTimeout);
      [fondo, carga, caida, golpe, brillo, destello, rafaga, barrido, rayos, salida, ...ondas].forEach((v) => cancelAnimation(v));
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

  /**
   * Salir: la medalla se eleva y se desvanece en `relevo` antes de avisar. Si viene otro logro, el fondo se queda
   * (`final` falso) y el siguiente entra sobre el mismo escenario; si era el último, se funde también el fondo.
   */
  const salir = (final: boolean, despues: () => void) => {
    if (cerrando.current) return;
    cerrando.current = true;
    if (!animar) return despues();
    salida.value = withTiming(1, { duration: motion.celebracion.relevo, easing: Easing.in(Easing.quad) });
    if (final) fondo.value = withTiming(0, { duration: motion.celebracion.relevo });
    setTimeout(despues, motion.celebracion.relevo);
  };

  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));
  const estiloCarga = useAnimatedStyle(() => ({ opacity: carga.value * 0.9, transform: [{ scale: 0.55 + 0.25 * carga.value }] }));
  const estiloHeroe = useAnimatedStyle(() => ({
    opacity: Math.min(1, caida.value * 3) * (1 - salida.value),
    transform: [
      { translateY: (1 - caida.value) * -height * 0.5 - salida.value * 40 },
      { scale: (0.55 + 0.45 * caida.value) * (1 + golpe.value) * (1 + 0.08 * salida.value) },
    ],
  }));
  const estiloBrillo = useAnimatedStyle(() => ({ opacity: brillo.value * (1 - salida.value), transform: [{ scale: 0.5 + brillo.value * 0.5 }] }));
  const estiloRayos = useAnimatedStyle(() => ({ opacity: rayos.value * (claro ? 0.7 : 0.9) * (1 - salida.value), transform: [{ rotate: `${giroRayos.value}deg` }] }));
  const estiloDestello = useAnimatedStyle(() => ({ opacity: destello.value }));
  const estiloTexto = useAnimatedStyle(() => ({ opacity: 1 - salida.value }));
  const propsBarrido = useAnimatedProps(() => ({ x: -30 + barrido.value * 140 }));

  const eRango = useEntrada(tras(80), animar);
  const eTitulo = useEntrada(tras(180), animar);
  const eDetalle = useEntrada(tras(320), animar);
  const eSiguiente = useEntrada(tras(500), animar);
  const eBoton = useEntrada(tras(720), animar);

  const barridoLuz = (
    <>
      <Defs>
        <ClipPath id={`clip-${clave}`}>
          <Path d={SILUETA_MEDALLA} />
        </ClipPath>
        <LinearGradient id={`luz-${clave}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={luz.blanco} stopOpacity={0} />
          <Stop offset="0.5" stopColor={luz.blanco} stopOpacity={0.8} />
          <Stop offset="1" stopColor={luz.blanco} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#clip-${clave})`}>
        <AnimatedRect animatedProps={propsBarrido} y={0} width={22} height={96} fill={`url(#luz-${clave})`} transform="skewX(-18)" />
      </G>
    </>
  );

  const ultimo = posicion.actual >= posicion.total;
  const quedan = posicion.total - posicion.actual;
  const coleccion = logro.tipo === 'insignia' ? logro.coleccion : null;
  const sig = logro.tipo === 'insignia' ? logro.siguiente : null;
  const porcentajeSig = sig && sig.target > 0 ? Math.round((sig.current / sig.target) * 100) : 0;
  const puntosSig = logro.tipo === 'nivel' ? logro.siguiente : null;

  return (
    <Escenario>
      <View
        style={[StyleSheet.absoluteFill, styles.escenario]}
        accessibilityViewIsModal
        importantForAccessibility="yes"
        testID="celebracion-logro"
        accessibilityLabel={`${esNivel ? 'Subiste de nivel' : 'Insignia ganada'}: ${titulo}`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, estiloFondo]} pointerEvents="none" />

        <View style={[styles.centro, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <View style={[styles.escena, { width: Math.min(lado * 2, width), height: lado * 1.3 }]} pointerEvents="none">
            {CON_RAYOS.has(rango) && animar ? (
              <Animated.View style={[styles.capa, estiloRayos]}>
                <Rayos rango={rango} lado={Math.min(width * 1.6, 520)} />
              </Animated.View>
            ) : null}
            <Animated.View style={[styles.capa, estiloBrillo]}>
              <Svg width={lado * 2} height={lado * 2} viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id={`halo-${clave}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={m.halo} stopOpacity={claro ? 0.4 : 0.55} />
                    <Stop offset="0.55" stopColor={m.halo} stopOpacity={claro ? 0.1 : 0.16} />
                    <Stop offset="1" stopColor={m.halo} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width={100} height={100} fill={`url(#halo-${clave})`} />
              </Svg>
            </Animated.View>
            {animar ? (
              <Animated.View style={[styles.capa, styles.carga, { width: lado, height: lado, borderRadius: lado / 2, backgroundColor: m.halo }, estiloCarga]} />
            ) : null}
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

            {animar ? Array.from({ length: n }, (_, i) => <Particula key={i} i={i} rafaga={rafaga} rango={rango} escala={escala} />) : null}
          </View>

          <Animated.View style={[styles.texto, estiloTexto]}>
            <Animated.View style={[styles.cabecera, eRango]}>
              <AtlasText variant="overline" align="center" style={{ color: acento }}>
                {esNivel ? '¡SUBISTE DE NIVEL!' : `¡INSIGNIA DE ${m.nombre.toUpperCase()}!`}
              </AtlasText>
              {posicion.total > 1 ? (
                <AtlasText variant="micro" tone="tertiary" align="center">
                  {`LOGRO ${posicion.actual} DE ${posicion.total}`}
                </AtlasText>
              ) : null}
            </Animated.View>
            <Animated.View style={[styles.bloque, eTitulo]}>
              <AtlasText variant="hero" align="center" numberOfLines={2} accessibilityRole="header">
                {titulo}
              </AtlasText>
              <AtlasText variant="bodyStrong" align="center" style={{ color: acento }}>
                {ARENGA[rango]}
              </AtlasText>
            </Animated.View>
            <Animated.View style={[styles.bloque, eDetalle]}>
              <AtlasText variant="body" tone="secondary" align="center">
                {esNivel ? `Nivel ${logro.nivel.index} de ${logro.nivel.of}. Tus compras con ${marca.nombre} te trajeron hasta aquí.` : (cara?.detail ?? '')}
              </AtlasText>
              {coleccion ? (
                <View style={styles.coleccion}>
                  <Casillas ganadas={coleccion.ganadas} total={coleccion.total} tinta={acento} />
                  <AtlasText variant="captionStrong" tone="secondary" align="center">
                    {`Colección «${NOMBRE_COLECCION[logro.tipo === 'insignia' ? (logro.insignia.category ?? 'pagos') : 'pagos']}»: ${coleccion.ganadas} de ${coleccion.total}`}
                  </AtlasText>
                </View>
              ) : null}
            </Animated.View>
            {sig || puntosSig ? (
              <Animated.View style={[styles.siguiente, eSiguiente]}>
                <AtlasText variant="caption" tone="secondary">
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
            <Animated.View style={[styles.botones, eBoton]}>
              <Button
                label={ultimo ? '¡Genial!' : `Siguiente (${posicion.actual} de ${posicion.total})`}
                onPress={() => salir(ultimo, onCerrar)}
                haptic="light"
                testID="celebracion-cerrar"
              />
              {!ultimo && onSaltarTodas ? (
                <Button label={`Saltar todas (${quedan + 1})`} variant="ghost" onPress={() => salir(true, onSaltarTodas)} testID="celebracion-saltar-todas" />
              ) : null}
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[StyleSheet.absoluteFill, styles.destello, estiloDestello]} pointerEvents="none" />
        {/* Tocar fuera del botón no cierra: un toque suelto al ganar no debe llevarse el premio sin leerlo. */}
      </View>
    </Escenario>
  );
}

const styles = StyleSheet.create({
  /*
    El escenario es la pantalla entera y RECORTA lo que la decora. Los rayos (hasta 520 px), el halo y las chispas en vuelo
    son más grandes que la ventana a propósito; en la web, lo que sobresale de una capa absoluta ensancha el documento
    (medido a 390 px: `scrollWidth` 1.129 en el golpe y 421 en reposo) y el navegador lo desplazaba 31-41 px a la
    izquierda: botones y panel pegados al borde y una franja vacía a la derecha. Además, la caja de la escena medía dos
    medallas de ancho (452 px) y ahora no pasa de la ventana. En iOS y Android no se veía porque una capa absoluta sin
    `ScrollView` no desplaza nada y Yoga centra lo que desborda por igual a los dos lados; el recorte también es correcto ahí.
  */
  escenario: { overflow: 'hidden' },
  fondo: { backgroundColor: color.stage.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  escena: { alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  carga: { opacity: 0 },
  particula: { position: 'absolute' },
  onda: { position: 'absolute', borderWidth: 1.5 },
  texto: { alignItems: 'center', gap: space.md, alignSelf: 'stretch', maxWidth: 420, marginTop: space.sm },
  cabecera: { alignItems: 'center', gap: space.xxs },
  bloque: { gap: space.xs, alignItems: 'center' },
  coleccion: { alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  casillas: { flexDirection: 'row', gap: space.xs },
  casilla: { width: 14, height: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border.strong, backgroundColor: color.surface.raisedStrong },
  siguiente: {
    alignSelf: 'stretch',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.stage.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stage.line,
  },
  botones: { alignSelf: 'stretch', gap: space.xs, marginTop: space.xs },
  destello: { backgroundColor: luz.blanco },
});
