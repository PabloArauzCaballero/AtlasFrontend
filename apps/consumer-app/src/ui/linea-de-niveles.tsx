/**
 * Los niveles como una LÍNEA DE PROGRESO vertical (Pablo, 2026-10-07: «scroll hacia arriba… como una línea de progreso»).
 *
 * «Nuevo» arriba y el nivel más alto abajo (Pablo, 2026-10-08: «acá debería ser al revés»), unidos por una línea que se
 * llena DESDE ARRIBA hasta donde estás; lo que sigue queda debajo, apagado, y se llega a ello deslizando hacia abajo. La
 * lista abre con tu nivel cerca de la parte alta, con lo que viene a continuación debajo.
 *
 * ## Movimiento (contesta «¿de dónde salió esto?»)
 *
 * Al abrir, la línea baja desde «Nuevo» hasta tu nivel y los puntos de lo alcanzado se encienden en ese mismo orden, de
 * arriba abajo: se ve el camino recorrido. Sólo se anima `transform` y `opacity`. Con movimiento reducido todo aparece puesto.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { color, easing, motion, palette, radius, space, spring } from '../theme/tokens';
import { Icon } from './icons';
import type { Paso } from './lista-de-pasos';
import { AtlasText, Card } from './primitives';

const FILA = 68;
const NODO = 28;
/** Cuántas filas se ven a la vez: la última asoma a medias para que se note que hay más debajo. */
const FILAS_A_LA_VISTA = 4.6;
const CURVA = Easing.bezier(easing.emphasized[0], easing.emphasized[1], easing.emphasized[2], easing.emphasized[3]);
const ESCALON_MS = 110;
const MS_POR_FILA = 140;

/** Dónde dejar el scroll al abrir: tu nivel arriba de lo visible (con el anterior asomando), y lo que viene debajo. */
export function desplazamientoInicial(indiceActual: number, total: number, alto: number): number {
  // Sin nivel, o en las dos primeras filas: abre arriba del todo, para que «Nuevo» no asome cortado.
  if (indiceActual < 2) return 0;
  const y = (indiceActual - 1) * FILA + FILA * 0.6;
  return Math.max(0, Math.min(Math.max(0, total * FILA - alto), y));
}

function Nodo({ paso, retardo }: { paso: Paso; retardo: number }) {
  const reducido = useReducedMotion();
  const v = useSharedValue(reducido || !paso.hecho ? 1 : 0);
  useEffect(() => {
    if (reducido || !paso.hecho) return;
    v.value = withDelay(retardo, withSpring(1, spring.settle));
  }, [paso.hecho, reducido, retardo, v]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + 0.5 * v.value }], opacity: 0.25 + 0.75 * v.value }));
  return (
    <Animated.View style={[styles.nodo, paso.hecho && styles.nodoHecho, paso.actual && styles.nodoActual, estilo]}>
      {paso.hecho ? <Icon name="check" size={paso.actual ? 18 : 16} tint={color.text.onBrand} /> : null}
    </Animated.View>
  );
}

export function LineaDeNiveles({ pasos, testID }: { pasos: readonly Paso[]; testID?: string }) {
  const reducido = useReducedMotion();
  const total = pasos.length;
  const actual = pasos.findIndex((p) => p.actual);
  const alto = Math.min(total, FILAS_A_LA_VISTA) * FILA;
  const scroll = useRef<ScrollView>(null);
  const [ancho, setAncho] = useState(0);
  const alMedir = useCallback((e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width), []);

  // La línea llena va de «Nuevo» (el principio de la lista) hasta tu nivel.
  const filas = actual < 0 ? 0 : actual;
  const largoLleno = filas * FILA;
  const sube = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    if (reducido) return;
    sube.value = withDelay(motion.base, withTiming(1, { duration: Math.max(600, filas * MS_POR_FILA), easing: CURVA }));
  }, [filas, reducido, sube]);
  const estiloLleno = useAnimatedStyle(() => ({ transform: [{ translateY: -(1 - sube.value) * largoLleno }] }));

  useEffect(() => {
    const y = desplazamientoInicial(actual, total, alto);
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  }, [actual, total, alto, ancho]);

  const centro = FILA / 2;
  return (
    <Card padding="none" testID={testID}>
      <View onLayout={alMedir} style={{ height: alto }}>
        <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ height: total * FILA }}>
          {/* La pista gris, de punta a punta, y encima la que se llena desde arriba hasta tu nivel. */}
          <View style={[styles.pista, { top: centro, height: (total - 1) * FILA }]} />
          {largoLleno > 0 ? (
            <View style={[styles.llenoMarco, { top: centro, height: largoLleno }]}>
              <Animated.View style={[StyleSheet.absoluteFill, estiloLleno]}>
                <LinearGradient colors={[palette.brand700, palette.brand500, palette.brand300]} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
          ) : null}
          {pasos.map((paso, i) => (
            <View key={paso.clave} style={[styles.fila, { top: i * FILA }]} accessibilityLabel={paso.etiqueta}>
              <View style={styles.colNodo}>
                <Nodo paso={paso} retardo={motion.base + i * ESCALON_MS} />
              </View>
              <View style={styles.texto}>
                <AtlasText variant="bodyStrong" tone={paso.actual ? 'brand' : paso.hecho ? 'primary' : 'secondary'}>
                  {paso.titulo}
                </AtlasText>
                <AtlasText variant="caption" tone={paso.hecho ? 'secondary' : 'tertiary'}>
                  {paso.derecha}
                </AtlasText>
              </View>
            </View>
          ))}
        </ScrollView>
        {/* Los bordes se desvanecen: lo que se corta arriba y abajo avisa de que se puede deslizar. */}
        {total > FILAS_A_LA_VISTA ? (
          <>
            <LinearGradient pointerEvents="none" colors={[color.surface.raised, 'rgba(11,30,54,0)']} style={styles.fundidoArriba} />
            <LinearGradient pointerEvents="none" colors={['rgba(11,30,54,0)', color.surface.raised]} style={styles.fundidoAbajo} />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fila: { position: 'absolute', left: 0, right: 0, height: FILA, flexDirection: 'row', alignItems: 'center', paddingRight: space.lg },
  colNodo: { width: 76, alignItems: 'center' },
  texto: { flex: 1, gap: 2 },
  pista: { position: 'absolute', left: 38 - 2, width: 4, borderRadius: 2, backgroundColor: color.surface.raisedStrong },
  llenoMarco: { position: 'absolute', left: 38 - 2, width: 4, borderRadius: 2, overflow: 'hidden' },
  nodo: { width: NODO, height: NODO, borderRadius: NODO / 2, borderWidth: 2, borderColor: color.border.strong, backgroundColor: color.surface.raised, alignItems: 'center', justifyContent: 'center' },
  nodoHecho: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  // Tu nivel: más grande y con un halo fijo (no pulsa solo).
  nodoActual: { width: NODO + 8, height: NODO + 8, borderRadius: (NODO + 8) / 2, borderColor: palette.brand300, borderWidth: 3, shadowColor: palette.brand400, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  fundidoArriba: { position: 'absolute', top: 0, left: 0, right: 0, height: 28, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl },
  fundidoAbajo: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
});
