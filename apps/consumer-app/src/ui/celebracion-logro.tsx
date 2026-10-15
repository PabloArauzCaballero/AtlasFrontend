/**
 * La celebración de un logro: la escena a pantalla completa al ganar una insignia o subir de nivel.
 *
 * Cuándo se lanza está en `features/celebraciones.ts`; aquí es sólo la escena.
 *
 * ## Ceremonia, no fiesta (2026-10-15)
 *
 * Pablo: «está bien, pero se puede ver mejor: más PREMIUM, más SERIO, y con el MISMO estilo de colores» que la app. La
 * versión anterior celebraba como un juego —rayos girando, chispas, ondas de choque, destello blanco, un muelle que
 * rebotaba y una cascada de golpecitos—, y en una app de dinero eso se lee como un premio de feria. Ahora es una entrega:
 *
 * 1. **El escenario se abre** y un único halo de marca, contenido, aparece detrás (`color.accent.base`, muy tenue).
 * 2. **La insignia entra limpia**: sube unos puntos y se asienta con `spring.settle` —sobreamortiguado, sin rebote—.
 *    Al asentarse, UN aviso háptico de éxito. Nada más.
 * 3. **Un único barrido de luz** cruza el esmalte, recortado a la silueta: el brillo de un objeto bien acabado.
 * 4. **El texto**, línea a línea y en orden de importancia: el tipo de logro y su rango (escrito, no pintado), el NOMBRE,
 *    una frase sobria, para qué sirve, la colección con sus casillas y LO PRÓXIMO con su barra.
 * 5. **La acción** entra la última, cuando ya se leyó lo que se ganó.
 *
 * Todo en la paleta de la marca: la insignia es de esmalte (`theme/esmalte.ts`) y el texto usa las tintas del tema y el
 * acento. Nada de colores por rango.
 *
 * ## Varias seguidas son UNA ceremonia
 *
 * Con `continua` el escenario ya está abierto: no se vuelve a fundir el fondo entre un logro y el siguiente, sólo se
 * releva la insignia (`motion.celebracion.relevo`). El contador dice «2 de 3» sobre el total de la ceremonia, el nivel
 * cierra siempre (lo ordena `celebraciones.ts`) y, mientras quede más de una, «Saltar todas» las cierra de una vez.
 *
 * ## Por qué no es un `Modal`, y por qué recorta
 *
 * Es una capa absoluta montada en el layout: un `Modal` presentado en ráfaga colgó iOS (`ui/tour.tsx`). La capa es la
 * pantalla entera y RECORTA lo que la decora: en la web, lo que sobresale de una capa absoluta ensancha el documento y el
 * navegador la desplazaba de lado (2026-10-15, #136).
 *
 * ## Movimiento reducido
 *
 * Sin entrada ni barrido: la misma información, ya puesta. El contenido nunca depende de la animación.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
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
import { RANGO, type Rango } from './trofeo';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const claro = esquema === 'claro';

/** Lo que dice cada rango al ganar: una frase sobria, distinta por rango, sin signos de exclamación. */
export const ARENGA: Record<Rango, string> = {
  bronce: 'Un primer paso bien dado.',
  plata: 'La constancia se nota.',
  oro: 'Un logro de pocos.',
  platino: 'Muy pocas personas llegan aquí.',
  diamante: `Lo más alto de ${marca.nombre}.`,
};

/** Una línea de texto que entra con retardo: sube 8 px y aparece. */
function useEntrada(retardo: number, activo: boolean) {
  const v = useSharedValue(activo ? 0 : 1);
  useEffect(() => {
    if (activo) v.value = withDelay(retardo, withTiming(1, { duration: motion.base + 60, easing: Easing.bezier(...easing.decelerate) }));
    else v.value = 1;
  }, [activo, retardo, v]);
  return useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 8 }] }));
}

/** Las casillas de la colección: una por insignia, llenas las ganadas. Se ve de un vistazo cuánto falta para cerrarla. */
function Casillas({ ganadas, total }: { ganadas: number; total: number }) {
  if (total > 12) return null;
  return (
    <View style={styles.casillas} accessible={false}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.casilla, i < ganadas ? styles.casillaLlena : null]} />
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
  // La escena no pasa del 28 % del alto: en un teléfono bajo el texto y el botón tienen que caber sin desplazar.
  const lado = Math.round(Math.min(200, width * 0.5, height * 0.28));
  const esNivel = logro.tipo === 'nivel';
  const cara = logro.tipo === 'insignia' ? caraDe(logro.insignia) : null;
  const titulo = logro.tipo === 'insignia' ? logro.insignia.label : logro.nivel.label;
  const clave = logro.tipo === 'insignia' ? logro.insignia.code : `nivel-${logro.nivel.id}`;

  const fondo = useSharedValue(animar && !continua ? 0 : 1);
  const entrada = useSharedValue(animar ? 0 : 1);
  const halo = useSharedValue(animar ? 0 : 1);
  const barrido = useSharedValue(0);
  const salida = useSharedValue(0);
  const cerrando = useRef(false);

  // Con la ceremonia ya abierta, la insignia entra antes: el escenario ya está a la vista.
  const inicio = continua ? motion.celebracion.relevo : motion.celebracion.carga;
  /** Cuándo entra cada línea de texto, tras asentarse la insignia. */
  const tras = (ms: number) => (animar ? inicio + motion.slow + ms : 0);

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${esNivel ? 'Subiste de nivel' : 'Ganaste una insignia'}: ${titulo}.`);
    if (!animar) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!continua) fondo.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.quad) });
    halo.value = withDelay(inicio * 0.5, withTiming(1, { duration: motion.slow * 2, easing: Easing.out(Easing.cubic) }));
    entrada.value = withDelay(inicio, withSpring(1, spring.settle));
    // Un solo aviso, al asentarse: la recompensa se siente, no se celebra a golpes.
    timers.push(setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), inicio + motion.base));
    barrido.value = withDelay(inicio + motion.slow, withTiming(1, { duration: motion.celebracion.barrido * 1.4, easing: Easing.inOut(Easing.quad) }));
    return () => {
      timers.forEach(clearTimeout);
      [fondo, entrada, halo, barrido, salida].forEach((v) => cancelAnimation(v));
    };
    // Una sola vez por logro: `clave` cambia al pasar al siguiente de la cola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, animar]);

  /**
   * Salir: la insignia se desvanece en `relevo` antes de avisar. Si viene otro logro, el fondo se queda (`final` falso) y
   * el siguiente entra sobre el mismo escenario; si era el último, se funde también el fondo.
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
  const estiloHalo = useAnimatedStyle(() => ({ opacity: halo.value * (1 - salida.value), transform: [{ scale: 0.85 + 0.15 * halo.value }] }));
  const estiloInsignia = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrada.value * 1.6) * (1 - salida.value),
    transform: [{ translateY: (1 - entrada.value) * 18 - salida.value * 10 }, { scale: 0.94 + 0.06 * entrada.value }],
  }));
  const estiloTexto = useAnimatedStyle(() => ({ opacity: 1 - salida.value }));
  const propsBarrido = useAnimatedProps(() => ({ x: -30 + barrido.value * 140 }));

  const eRango = useEntrada(tras(0), animar);
  const eTitulo = useEntrada(tras(90), animar);
  const eDetalle = useEntrada(tras(200), animar);
  const eSiguiente = useEntrada(tras(320), animar);
  const eBoton = useEntrada(tras(460), animar);

  const barridoLuz = (
    <>
      <Defs>
        <ClipPath id={`clip-${clave}`}>
          <Path d={SILUETA_MEDALLA} />
        </ClipPath>
        <LinearGradient id={`luz-${clave}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={luz.blanco} stopOpacity={0} />
          <Stop offset="0.5" stopColor={luz.blanco} stopOpacity={0.32} />
          <Stop offset="1" stopColor={luz.blanco} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#clip-${clave})`}>
        <AnimatedRect animatedProps={propsBarrido} y={0} width={26} height={96} fill={`url(#luz-${clave})`} transform="skewX(-18)" />
      </G>
    </>
  );

  const ultimo = posicion.actual >= posicion.total;
  const quedan = posicion.total - posicion.actual;
  const coleccion = logro.tipo === 'insignia' ? logro.coleccion : null;
  const sig = logro.tipo === 'insignia' ? logro.siguiente : null;
  const porcentajeSig = sig && sig.target > 0 ? Math.round((sig.current / sig.target) * 100) : 0;
  const puntosSig = logro.tipo === 'nivel' ? logro.siguiente : null;
  const halado = Math.min(lado * 2.2, width);

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

        <View style={[styles.centro, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
          <View style={[styles.escena, { width: Math.min(lado * 2, width), height: lado * 1.25 }]} pointerEvents="none">
            {/* El único halo: el acento de la marca, contenido y muy tenue. */}
            <Animated.View style={[styles.capa, estiloHalo]}>
              <Svg width={halado} height={halado} viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id={`halo-${clave}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={color.accent.base} stopOpacity={claro ? 0.12 : 0.2} />
                    <Stop offset="0.6" stopColor={color.accent.base} stopOpacity={claro ? 0.04 : 0.06} />
                    <Stop offset="1" stopColor={color.accent.base} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width={100} height={100} fill={`url(#halo-${clave})`} />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.capa, estiloInsignia]}>
              {logro.tipo === 'insignia' ? (
                <Medalla codigo={clave} rango={rango} icono={cara?.icon ?? 'estrella'} ganado lado={lado}>
                  {animar ? barridoLuz : null}
                </Medalla>
              ) : (
                <EscudoDeNivel rango={rango} icono={ICONO_DE_ESCALON[logro.nivel.id] ?? 'estrella'} numero={logro.nivel.index} de={logro.nivel.of} lado={lado} />
              )}
            </Animated.View>
          </View>

          <Animated.View style={[styles.texto, estiloTexto]}>
            <Animated.View style={[styles.cabecera, eRango]}>
              <AtlasText variant="overline" tone="brand" align="center">
                {esNivel ? 'NUEVO NIVEL' : `INSIGNIA · ${RANGO[rango].nombre.toUpperCase()}`}
              </AtlasText>
              {posicion.total > 1 ? (
                <AtlasText variant="micro" tone="tertiary" align="center">
                  {`LOGRO ${posicion.actual} DE ${posicion.total}`}
                </AtlasText>
              ) : null}
            </Animated.View>
            <Animated.View style={[styles.bloque, eTitulo]}>
              <AtlasText variant="h1" align="center" numberOfLines={2} accessibilityRole="header">
                {titulo}
              </AtlasText>
              <AtlasText variant="body" tone="secondary" align="center">
                {ARENGA[rango]}
              </AtlasText>
            </Animated.View>
            <Animated.View style={[styles.bloque, eDetalle]}>
              <View style={styles.separador} />
              <AtlasText variant="body" tone="secondary" align="center">
                {esNivel ? `Nivel ${logro.nivel.index} de ${logro.nivel.of}. Tus compras con ${marca.nombre} te trajeron hasta aquí.` : (cara?.detail ?? '')}
              </AtlasText>
              {coleccion ? (
                <View style={styles.coleccion}>
                  <Casillas ganadas={coleccion.ganadas} total={coleccion.total} />
                  <AtlasText variant="caption" tone="tertiary" align="center">
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
                label={ultimo ? 'Continuar' : `Siguiente (${posicion.actual} de ${posicion.total})`}
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
        {/* Tocar fuera del botón no cierra: un toque suelto al ganar no debe llevarse el premio sin leerlo. */}
      </View>
    </Escenario>
  );
}

const styles = StyleSheet.create({
  /* El escenario es la pantalla entera y recorta lo que la decora (ver «Por qué recorta»). */
  escenario: { overflow: 'hidden' },
  fondo: { backgroundColor: color.stage.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  escena: { alignItems: 'center', justifyContent: 'center' },
  capa: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  texto: { alignItems: 'center', gap: space.md, alignSelf: 'stretch', maxWidth: 420, marginTop: space.sm },
  cabecera: { alignItems: 'center', gap: space.xxs },
  bloque: { gap: space.xs, alignItems: 'center' },
  separador: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: color.accent.border, marginBottom: space.xs },
  coleccion: { alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  casillas: { flexDirection: 'row', gap: space.xs },
  casilla: { width: 14, height: 3, borderRadius: radius.pill, backgroundColor: color.fill.base },
  casillaLlena: { backgroundColor: color.accent.base },
  siguiente: {
    alignSelf: 'stretch',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.stage.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stage.line,
  },
  botones: { alignSelf: 'stretch', gap: space.xs, marginTop: space.xs },
});
