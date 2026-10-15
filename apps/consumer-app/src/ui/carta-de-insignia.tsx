/**
 * La carta de una insignia: al tocarla en la vitrina se abre a pantalla completa.
 *
 * ## Una pieza de colección sobria (2026-10-15)
 *
 * Pablo: «más premium, más serio, y con el MISMO estilo de colores» que la app. La carta era «legendaria» a la manera de
 * un juego: marco de metal de color, rayos, una cinta metálica con el nombre. Ahora es una pieza de esmalte de marca
 * (`theme/esmalte.ts`), igual en claro y en oscuro, como la tarjeta navy de la app:
 *
 * - canto satinado fino en lugar del marco de metal; un filete interior del acento;
 * - arriba, el RANGO escrito con sus marcas (no un color) y la colección;
 * - el arte: la insignia sobre un grabado muy tenue, sin rayos;
 * - el nombre en tipografía, separado por un filete, no en una cinta;
 * - abajo, el estado: GANADA con su fecha, o cuánto llevas y cuánto falta; y las casillas de la colección.
 *
 * Todo el texto usa las tintas del esmalte, medidas contra su cara con cualquier marca (`esmalte-contraste.test.ts`).
 *
 * ## Entrada
 *
 * La carta sube unos puntos y se asienta (`spring.settle`, sin rebote); la insignia aparece detrás, y un único barrido
 * muy tenue cruza la carta. En una ganada, un toque leve. Con movimiento reducido todo aparece ya puesto.
 *
 * Es una capa en el layout, no un `Modal` (ver `celebracion-logro.tsx`), y recorta lo que la decora.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOMBRE_COLECCION, type Logro } from '../features/celebraciones';
import { esmalte } from '../theme/esmalte';
import { alpha, color, luz, marca, motion, radius, space, spring } from '../theme/tokens';
import { CuentaArriba, useAvance } from './cuenta-arriba';
import { Icon } from './icons';
import { caraDe } from './insignia';
import { Medalla } from './medalla';
import { AtlasText, Escenario, Button } from './primitives';
import { RANGO } from './trofeo';

const ALTO_BOTONES = 132;
const TINTA = esmalte.tinta;

/** «12 de octubre de 2026»; una fecha que no se entiende no se enseña. */
export function fechaLarga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const miles = (n: number) => Math.round(n).toLocaleString('es-BO');

/** El fondo del arte: el esmalte con una luz suave detrás de la insignia y un grabado de anillos casi invisible. */
function ArteDeFondo({ ancho, alto, id }: { ancho: number; alto: number; id: string }) {
  const cx = ancho / 2;
  const cy = alto / 2;
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`arte-${id}`} cx={cx} cy={cy} r={ancho * 0.6} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={esmalte.caraAlta} stopOpacity={1} />
          <Stop offset="1" stopColor={esmalte.caraAlta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={ancho} height={alto} fill={`url(#arte-${id})`} />
      {Array.from({ length: 10 }, (_, k) => (
        <Circle key={k} cx={cx} cy={cy} r={alto * (0.22 + k * 0.065)} fill="none" stroke={esmalte.filete} strokeWidth={0.5} opacity={0.06} />
      ))}
    </Svg>
  );
}

/** Las marcas del rango, en texto: tantos rombos como dificultad. */
const marcasDe = (n: number) => '◆'.repeat(n);

export function CartaDeInsignia({ logro, onCerrar, onRevivir }: { logro: Extract<Logro, { tipo: 'insignia' }>; onCerrar: () => void; onRevivir: () => void }) {
  const reducido = useReducedMotion();
  const animar = !reducido;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const insignia = logro.insignia;
  const rango = logro.rango;
  const r = RANGO[rango];
  const cara = caraDe(insignia);
  const ganada = insignia.earned;

  // La carta es 2:3, y nunca más alta que lo que cabe sobre los botones.
  const maxAlto = height - insets.top - insets.bottom - ALTO_BOTONES - space.lg;
  const ancho = Math.round(Math.min(320, width - 48, maxAlto / 1.5));
  const alto = Math.round(ancho * 1.5);
  const alturaArte = Math.round(alto * 0.44);

  const fondo = useSharedValue(animar ? 0 : 1);
  const entrada = useSharedValue(animar ? 0 : 1);
  const medalla = useSharedValue(animar ? 0 : 1);
  const barrido = useSharedValue(0);
  const avance = useAvance(true);

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${cara.label}. ${ganada ? 'Insignia ganada' : cara.oculta ? 'Insignia secreta' : 'Insignia pendiente'}.`);
    if (!animar) return;
    fondo.value = withTiming(1, { duration: motion.base });
    entrada.value = withSpring(1, spring.settle);
    medalla.value = withDelay(motion.base, withSpring(1, spring.settle));
    barrido.value = withDelay(motion.slow * 2, withTiming(1, { duration: motion.celebracion.barrido * 1.4, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => {
      if (ganada) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, motion.slow);
    return () => clearTimeout(t);
    // Una vez por carta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));
  const estiloCarta = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrada.value * 1.5),
    transform: [{ translateY: (1 - entrada.value) * 20 }, { scale: 0.97 + 0.03 * entrada.value }],
  }));
  const estiloMedalla = useAnimatedStyle(() => ({ opacity: medalla.value, transform: [{ scale: 0.92 + 0.08 * medalla.value }] }));
  const estiloBarrido = useAnimatedStyle(() => ({
    opacity: barrido.value > 0 && barrido.value < 1 ? 1 : 0,
    transform: [{ translateX: -ancho * 0.6 + barrido.value * ancho * 1.8 }, { skewX: '-18deg' }],
  }));

  const fecha = fechaLarga(insignia.earnedAt);
  const faltan = Math.max(0, insignia.target - insignia.current);
  const porcentaje = Math.round((insignia.current / Math.max(1, insignia.target)) * 100);
  const coleccion = insignia.category ? NOMBRE_COLECCION[insignia.category] : null;

  return (
    <Escenario>
      <View
        style={[StyleSheet.absoluteFill, styles.escenario]}
        accessibilityViewIsModal
        importantForAccessibility="yes"
        testID="carta-de-insignia"
        accessibilityLabel={`Insignia de rango ${r.nombre.toLowerCase()}: ${cara.label}. ${ganada ? 'Ganada' : 'Pendiente'}.`}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, estiloFondo]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar la carta" />
        </Animated.View>

        <View style={[styles.centro, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
          <View style={[{ width: ancho, height: alto }, styles.sombra]}>
            <Animated.View style={[StyleSheet.absoluteFill, estiloCarta]}>
              {/* El canto: satinado y fino, del aro claro a su sombra. */}
              <LinearGradient colors={[esmalte.aroLuz, esmalte.cara, esmalte.aroSombra]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.marco}>
                <View style={styles.cara}>
                  <LinearGradient colors={[esmalte.cara, esmalte.caraProfunda]} style={StyleSheet.absoluteFill} />
                  <View style={styles.filo} pointerEvents="none" />

                  <View style={[styles.arte, { height: alturaArte }]}>
                    <ArteDeFondo ancho={ancho - 4} alto={alturaArte} id={insignia.code} />
                    <View style={styles.cinta}>
                      <View style={styles.rango}>
                        <AtlasText variant="micro" style={{ color: esmalte.filete }}>
                          {marcasDe(r.marcas)}
                        </AtlasText>
                        <AtlasText variant="micro" style={{ color: TINTA.secundaria }}>
                          {r.nombre.toUpperCase()}
                        </AtlasText>
                      </View>
                      {coleccion ? (
                        <AtlasText variant="micro" numberOfLines={1} style={[styles.coleccion, { color: TINTA.terciaria }]}>
                          {coleccion.toUpperCase()}
                        </AtlasText>
                      ) : null}
                    </View>
                    <Animated.View style={estiloMedalla}>
                      <Medalla
                        codigo={`carta-${insignia.code}`}
                        rango={rango}
                        icono={cara.icon}
                        ganado={ganada}
                        avance={cara.oculta ? 0 : Math.min(1, insignia.current / Math.max(1, insignia.target))}
                        lado={Math.round(alturaArte * 0.82)}
                        sobreOscuro
                      />
                    </Animated.View>
                  </View>

                  <View style={styles.nombre}>
                    <View style={styles.regla} />
                    <AtlasText variant="h2" align="center" numberOfLines={2} style={{ color: TINTA.primaria }} accessibilityRole="header">
                      {cara.label}
                    </AtlasText>
                  </View>

                  <View style={styles.cuerpo}>
                    <AtlasText variant="body" align="center" numberOfLines={3} style={{ color: TINTA.secundaria }}>
                      {cara.detail}
                    </AtlasText>

                    {ganada ? (
                      <View style={styles.sello}>
                        <View style={styles.selloMarca}>
                          <Icon name="check" size={14} tint={esmalte.filete} />
                          <AtlasText variant="captionStrong" style={{ color: esmalte.filete }}>
                            GANADA
                          </AtlasText>
                        </View>
                        {fecha ? (
                          <AtlasText variant="caption" align="center" style={{ color: TINTA.terciaria }}>
                            {`El ${fecha}`}
                          </AtlasText>
                        ) : null}
                      </View>
                    ) : cara.oculta ? (
                      <AtlasText variant="captionStrong" align="center" style={{ color: TINTA.terciaria }}>
                        SECRETA · sigue usando {marca.nombre}
                      </AtlasText>
                    ) : (
                      <View style={styles.avance}>
                        <View style={styles.cifraAvance}>
                          <CuentaArriba avance={avance} hasta={insignia.current} formato={miles} tamano="h2" color={TINTA.primaria} />
                          <AtlasText variant="caption" style={{ color: TINTA.secundaria }}>{`de ${miles(insignia.target)}`}</AtlasText>
                        </View>
                        <View
                          style={styles.pista}
                          accessibilityRole="progressbar"
                          accessibilityLabel={`Avance: ${insignia.current} de ${insignia.target}`}
                          accessibilityValue={{ min: 0, max: 100, now: porcentaje }}
                        >
                          <View style={[styles.relleno, { width: `${Math.min(100, porcentaje)}%` }]} />
                        </View>
                        <AtlasText variant="caption" align="center" style={{ color: TINTA.terciaria }}>{`Te faltan ${miles(faltan)}`}</AtlasText>
                      </View>
                    )}
                  </View>

                  {logro.coleccion && coleccion ? (
                    <View style={styles.pie}>
                      <View style={styles.casillas}>
                        {Array.from({ length: Math.min(logro.coleccion.total, 12) }, (_, i) => (
                          <View key={i} style={[styles.casilla, i < logro.coleccion!.ganadas ? styles.casillaLlena : null]} />
                        ))}
                      </View>
                      <AtlasText variant="micro" style={{ color: TINTA.terciaria }}>
                        {`${logro.coleccion.ganadas} DE ${logro.coleccion.total} EN ${coleccion.toUpperCase()}`}
                      </AtlasText>
                    </View>
                  ) : null}

                  {/* Un único barrido, muy tenue: el brillo de un objeto bien acabado, no un holograma. */}
                  <Animated.View style={[styles.barrido, { height: alto * 1.5 }, estiloBarrido]} pointerEvents="none">
                    <LinearGradient colors={[alpha(luz.blanco, 0), alpha(luz.blanco, 0.14), alpha(luz.blanco, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  </Animated.View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>

          <View style={[styles.botones, { width: ancho }]}>
            {ganada ? <Button label="Ver la celebración" variant="ghost" onPress={onRevivir} testID="carta-revivir" /> : null}
            <Button label="Cerrar" onPress={onCerrar} haptic="light" testID="carta-cerrar" />
          </View>
        </View>
      </View>
    </Escenario>
  );
}

const styles = StyleSheet.create({
  /** La capa es la pantalla entera y recorta lo que la decora: la sombra de la carta no puede ensanchar la página web. */
  escenario: { overflow: 'hidden' },
  fondo: { backgroundColor: color.stage.scrim },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg },
  // Con el mismo radio que la carta: sin él, la web pinta la sombra (y su caja) como un rectángulo de esquinas vivas.
  sombra: { borderRadius: radius.xxl, shadowColor: luz.negro, shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 14 },
  marco: { flex: 1, borderRadius: radius.xxl, padding: 1.5 },
  cara: { flex: 1, borderRadius: radius.xxl - 1.5, overflow: 'hidden', backgroundColor: esmalte.cara },
  filo: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderWidth: 1, borderRadius: radius.xxl - 6, borderColor: alpha(esmalte.filete, 0.22), zIndex: 2 },
  arte: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cinta: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rango: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  coleccion: { flexShrink: 1, letterSpacing: 1 },
  nombre: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  regla: { width: 28, height: 1, backgroundColor: alpha(esmalte.filete, 0.5) },
  // Arriba, pegado al nombre: centrado en el hueco libre dejaba un vacío entre el nombre y lo que significa.
  cuerpo: { flex: 1, gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, justifyContent: 'flex-start' },
  sello: { alignItems: 'center', gap: space.xs },
  selloMarca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderColor: alpha(esmalte.filete, 0.5),
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  avance: { gap: space.xs },
  cifraAvance: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.xs },
  pista: { height: 4, borderRadius: radius.pill, backgroundColor: esmalte.hueco, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radius.pill, backgroundColor: esmalte.filete },
  pie: { alignItems: 'center', gap: space.xs, paddingBottom: space.lg },
  casillas: { flexDirection: 'row', gap: space.xs },
  casilla: { width: 12, height: 3, borderRadius: radius.pill, backgroundColor: esmalte.hueco },
  casillaLlena: { backgroundColor: esmalte.filete },
  barrido: { position: 'absolute', top: -40, left: 0, width: 90 },
  botones: { gap: space.sm },
});
