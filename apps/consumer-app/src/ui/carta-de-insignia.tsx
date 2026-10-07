/**
 * La carta de una insignia: al tocarla en la vitrina se abre a pantalla completa como una carta legendaria (Pablo,
 * 2026-10-07: «al darle clic que me muestre la animación… como una carta legendaria de Clash Royale, pero como insignia»).
 *
 * ## Qué pasa, en orden (≈ 1,8 s)
 *
 * 1. La carta GIRA hacia el frente desde el canto (rotateY) y se asienta con el muelle `settle`.
 * 2. La medalla entra con un golpe corto en el centro del arte, y en las ganadas suena un toque.
 * 3. Un barrido de luz diagonal cruza toda la carta: es el «holo» que la hace sentir de coleccionista.
 * 4. La cifra de abajo cuenta hacia arriba y la barra sube con su punto vivo (`cuenta-arriba.tsx`).
 *
 * Ganada: el sello GANADA y, si el servidor los manda, la fecha y los puntos que sumó. No se inventa ninguno: hoy el
 * backend calcula las insignias al vuelo y no guarda ni cuándo se ganaron ni un premio en puntos (ver `Badge`).
 * Pendiente: cuánto llevas y cuánto falta. Secreta sin ganar: sólo su pista.
 *
 * Es una capa en el layout, no un `Modal` (ver `celebracion-logro.tsx`). Con movimiento reducido todo aparece ya puesto.
 */
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOMBRE_COLECCION, type Logro } from '../features/celebraciones';
import { motion, palette, radius, space, spring } from '../theme/tokens';
import { Barra, CuentaArriba, useAvance } from './cuenta-arriba';
import { Icon } from './icons';
import { caraDe } from './insignia';
import { Medalla } from './medalla';
import { AtlasText, Button } from './primitives';
import { METAL } from './trofeo';

const ALTO_BOTONES = 132;

/** «12 de octubre de 2026»; una fecha que no se entiende no se enseña. */
export function fechaLarga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const miles = (n: number) => Math.round(n).toLocaleString('es-BO');

/** Rayos fijos detrás de la medalla: el fondo de «arte» de la carta. */
function ArteDeFondo({ ancho, alto, rango }: { ancho: number; alto: number; rango: keyof typeof METAL }) {
  const m = METAL[rango];
  const cx = ancho / 2;
  const cy = alto / 2;
  const cuñas = Array.from({ length: 14 }, (_, k) => {
    const a0 = (k * (360 / 14) * Math.PI) / 180;
    const a1 = ((k * (360 / 14) + 10) * Math.PI) / 180;
    const r = ancho * 1.1;
    return `M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
  });
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`arte-${rango}`} cx={cx} cy={cy} r={ancho * 0.75} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={m.halo} stopOpacity={0.55} />
          <Stop offset="0.6" stopColor={m.sombra} stopOpacity={0.25} />
          <Stop offset="1" stopColor="#050B16" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={ancho} height={alto} fill="#071426" />
      {cuñas.map((d, k) => (
        <Path key={k} d={d} fill={m.halo} opacity={0.1} />
      ))}
      <Rect width={ancho} height={alto} fill={`url(#arte-${rango})`} />
    </Svg>
  );
}

export function CartaDeInsignia({ logro, onCerrar, onRevivir }: { logro: Extract<Logro, { tipo: 'insignia' }>; onCerrar: () => void; onRevivir: () => void }) {
  const reducido = useReducedMotion();
  const animar = !reducido;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const insignia = logro.insignia;
  const rango = logro.rango;
  const m = METAL[rango];
  const cara = caraDe(insignia);
  const ganada = insignia.earned;

  // La carta es 2:3, y nunca más alta que lo que cabe sobre los botones.
  const maxAlto = height - insets.top - insets.bottom - ALTO_BOTONES - space.lg;
  const ancho = Math.round(Math.min(320, width - 48, maxAlto / 1.5));
  const alto = Math.round(ancho * 1.5);
  const alturaArte = Math.round(alto * 0.46);

  const fondo = useSharedValue(animar ? 0 : 1);
  const giro = useSharedValue(animar ? 0 : 1);
  const medalla = useSharedValue(animar ? 0 : 1);
  const barrido = useSharedValue(0);
  const avance = useAvance(true);

  useEffect(() => {
    void AccessibilityInfo.announceForAccessibility(`${cara.label}. ${ganada ? 'Insignia ganada' : cara.oculta ? 'Insignia secreta' : 'Insignia pendiente'}.`);
    if (!animar) return;
    fondo.value = withTiming(1, { duration: motion.base });
    giro.value = withSpring(1, spring.glide);
    medalla.value = withDelay(320, withSpring(1, spring.logro));
    barrido.value = withDelay(760, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(() => {
      if (ganada) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 380);
    return () => clearTimeout(t);
    // Una vez por carta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estiloFondo = useAnimatedStyle(() => ({ opacity: fondo.value }));
  const estiloCarta = useAnimatedStyle(() => ({
    opacity: Math.min(1, giro.value * 2.2),
    transform: [{ perspective: 1000 }, { rotateY: `${(1 - giro.value) * -84}deg` }, { scale: 0.86 + 0.14 * giro.value }],
  }));
  const estiloMedalla = useAnimatedStyle(() => ({ opacity: Math.min(1, medalla.value * 2), transform: [{ scale: 0.35 + 0.65 * medalla.value }] }));
  const estiloBarrido = useAnimatedStyle(() => ({
    opacity: barrido.value > 0 && barrido.value < 1 ? 1 : 0,
    transform: [{ translateX: -ancho * 0.6 + barrido.value * ancho * 1.8 }, { rotate: '18deg' }],
  }));

  const fecha = fechaLarga(insignia.earnedAt);
  const puntos = typeof insignia.points === 'number' && insignia.points > 0 ? insignia.points : null;
  const faltan = Math.max(0, insignia.target - insignia.current);
  const coleccion = insignia.category ? NOMBRE_COLECCION[insignia.category] : null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      testID="carta-de-insignia"
      accessibilityLabel={`Insignia de ${m.nombre.toLowerCase()}: ${cara.label}. ${ganada ? 'Ganada' : 'Pendiente'}.`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, estiloFondo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar la carta" />
      </Animated.View>

      <View style={[styles.centro, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
        <Animated.View style={[{ width: ancho, height: alto }, estiloCarta, styles.sombra, { shadowColor: m.halo }]}>
          {/* El marco: metal con degradado, y dentro la carta. */}
          <LinearGradient colors={[m.luz, m.medio, m.sombra, m.medio]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.marco}>
            <View style={styles.cara}>
              <LinearGradient colors={['#0C1B30', '#08111F']} style={StyleSheet.absoluteFill} />

              <View style={[styles.arte, { height: alturaArte }]}>
                <ArteDeFondo ancho={ancho - 8} alto={alturaArte} rango={rango} />
                <View style={styles.cinta}>
                  <View style={[styles.pildora, { borderColor: m.medio }]}>
                    <AtlasText variant="micro" style={{ color: m.luz }}>
                      {m.nombre.toUpperCase()}
                    </AtlasText>
                  </View>
                  {coleccion ? (
                    <AtlasText variant="micro" tone="secondary" numberOfLines={1} style={styles.coleccion}>
                      {coleccion.toUpperCase()}
                    </AtlasText>
                  ) : null}
                </View>
                <Animated.View style={estiloMedalla}>
                  <Medalla codigo={`carta-${insignia.code}`} rango={rango} icono={cara.icon} ganado={ganada} avance={cara.oculta ? 0 : Math.min(1, insignia.current / Math.max(1, insignia.target))} lado={Math.round(alturaArte * 0.86)} />
                </Animated.View>
              </View>

              {/* El nombre en una cinta de metal, como el rótulo de una carta. */}
              <LinearGradient colors={ganada ? [m.sombra, m.medio, m.luz, m.medio, m.sombra] : ['#16263D', '#22364F', '#16263D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rotulo}>
                <AtlasText variant="h3" align="center" numberOfLines={2} style={{ color: ganada ? m.tinta : '#C9D6E8' }} accessibilityRole="header">
                  {cara.label}
                </AtlasText>
              </LinearGradient>

              <View style={styles.cuerpo}>
                <AtlasText variant="caption" tone="secondary" align="center" numberOfLines={3}>
                  {cara.detail}
                </AtlasText>

                {ganada ? (
                  <View style={styles.sello}>
                    <View style={[styles.selloMarca, { borderColor: m.medio }]}>
                      <Icon name="check" size={14} tint={m.luz} />
                      <AtlasText variant="captionStrong" style={{ color: m.luz }}>
                        GANADA
                      </AtlasText>
                    </View>
                    {fecha ? (
                      <AtlasText variant="caption" tone="secondary" align="center">
                        {`El ${fecha}`}
                      </AtlasText>
                    ) : null}
                    {puntos ? (
                      <View style={styles.puntos} accessibilityLabel={`Sumó ${miles(puntos)} puntos`}>
                        <AtlasText variant="h2" style={{ color: m.luz }}>
                          +
                        </AtlasText>
                        <CuentaArriba avance={avance} hasta={puntos} formato={miles} tamano="h2" color={m.luz} />
                        <AtlasText variant="caption" tone="secondary">
                          puntos
                        </AtlasText>
                      </View>
                    ) : null}
                  </View>
                ) : cara.oculta ? (
                  <AtlasText variant="captionStrong" tone="tertiary" align="center">
                    SECRETA · sigue usando Atlas
                  </AtlasText>
                ) : (
                  <View style={styles.avance}>
                    <View style={styles.cifraAvance}>
                      <CuentaArriba avance={avance} hasta={insignia.current} formato={miles} tamano="h2" />
                      <AtlasText variant="caption" tone="secondary">{`de ${miles(insignia.target)}`}</AtlasText>
                    </View>
                    <Barra valor={Math.round((insignia.current / Math.max(1, insignia.target)) * 100)} avance={avance} etiqueta={`Avance: ${insignia.current} de ${insignia.target}`} />
                    <AtlasText variant="caption" tone="tertiary" align="center">{`Te faltan ${miles(faltan)}`}</AtlasText>
                  </View>
                )}
              </View>

              {/* El barrido holográfico: una banda de luz recortada por el marco de la carta. */}
              <Animated.View style={[styles.barrido, { height: alto * 1.5 }, estiloBarrido]} pointerEvents="none">
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={[styles.botones, { width: ancho }]}>
          {ganada ? <Button label="Ver la celebración" variant="ghost" onPress={onRevivir} testID="carta-revivir" /> : null}
          <Button label="Cerrar" onPress={onCerrar} haptic="light" testID="carta-cerrar" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { backgroundColor: 'rgba(3,10,20,0.94)' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg },
  sombra: { shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 18 },
  marco: { flex: 1, borderRadius: radius.xl + 6, padding: 4 },
  cara: { flex: 1, borderRadius: radius.xl + 2, overflow: 'hidden', backgroundColor: palette.bg },
  arte: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cinta: { position: 'absolute', top: space.sm, left: space.sm, right: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  pildora: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, backgroundColor: 'rgba(5,11,22,0.55)' },
  coleccion: { flexShrink: 1, letterSpacing: 1 },
  rotulo: { paddingVertical: space.sm, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  cuerpo: { flex: 1, gap: space.sm, padding: space.md, justifyContent: 'center' },
  sello: { alignItems: 'center', gap: space.xs },
  selloMarca: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3 },
  puntos: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  avance: { gap: space.xs },
  cifraAvance: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.xs },
  barrido: { position: 'absolute', top: -40, left: 0, width: 90 },
  botones: { gap: space.sm },
});
