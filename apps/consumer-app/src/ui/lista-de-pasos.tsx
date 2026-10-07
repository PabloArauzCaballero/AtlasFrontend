/**
 * Una lista de pasos (niveles, misiones) PAGINADA: unas pocas filas por página, deslizando de lado, con puntos abajo.
 *
 * Pablo (2026-10-07): «que se paginen todos». Los doce niveles y todas las misiones de golpe eran una pared; esconderlos
 * tras un botón tampoco era lo pedido. Aquí están todos y se llega a cada uno con el dedo, igual que en la calificación
 * y en las insignias.
 *
 * ## Movimiento (contesta «¿de dónde salió esto?»)
 *
 * Al llegar a una página por PRIMERA vez, sus filas suben 10 px mientras aparecen, escalonadas; en la escalera de niveles
 * (`ascender`) la cuenta empieza por ABAJO, así que se ve cómo se sube. La marca de lo hecho entra con un muelle corto.
 * La lista abre en la página donde está lo actual (`actual`). Con movimiento reducido todo aparece ya puesto.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, easing, motion, radius, space, spring } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Card, Divider } from './primitives';

export type Paso = { clave: string; titulo: string; derecha: string; hecho: boolean; actual?: boolean; detalle?: string; etiqueta: string };

const CURVA = Easing.bezier(easing.decelerate[0], easing.decelerate[1], easing.decelerate[2], easing.decelerate[3]);
const ESCALON_MS = 90;

/** Reparte los pasos en páginas de `porPagina`. */
export function paginar<T>(items: readonly T[], porPagina: number): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return paginas;
}

function Fila({ paso, retardo, separador, reproducir }: { paso: Paso; retardo: number; separador: boolean; reproducir: boolean }) {
  const reducido = useReducedMotion();
  const entrada = useSharedValue(reducido ? 1 : 0);
  const marca = useSharedValue(reducido || !paso.hecho ? 1 : 0);
  const arrancada = useRef(false);
  useEffect(() => {
    if (reducido || !reproducir || arrancada.current) return;
    arrancada.current = true;
    entrada.value = withDelay(retardo, withTiming(1, { duration: motion.base, easing: CURVA }));
    if (paso.hecho) marca.value = withDelay(retardo + motion.fast, withSpring(1, spring.settle));
  }, [entrada, marca, paso.hecho, reducido, reproducir, retardo]);
  const estiloFila = useAnimatedStyle(() => ({ opacity: entrada.value, transform: [{ translateY: (1 - entrada.value) * 10 }] }));
  const estiloMarca = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + 0.6 * marca.value }], opacity: marca.value }));
  return (
    <Animated.View style={estiloFila}>
      {separador ? <Divider inset /> : null}
      <View style={styles.fila} accessibilityLabel={paso.etiqueta}>
        <View style={[styles.marca, paso.hecho && styles.marcaHecha]}>
          {paso.hecho ? (
            <Animated.View style={estiloMarca}>
              <Icon name="check" size={16} tint={color.text.onBrand} />
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.texto}>
          <AtlasText variant="bodyStrong" tone={paso.actual ? 'brand' : 'primary'}>
            {paso.titulo}
          </AtlasText>
          {paso.detalle ? (
            <AtlasText variant="caption" tone="secondary">
              {paso.detalle}
            </AtlasText>
          ) : null}
        </View>
        <AtlasText variant="caption" tone={paso.hecho ? 'brand' : 'secondary'}>
          {paso.derecha}
        </AtlasText>
      </View>
    </Animated.View>
  );
}

/** Un punto del pie: el activo se alarga y se enciende; sigue al dedo mientras se desliza. */
function Punto({ indice, progreso, activo, onPress }: { indice: number; progreso: SharedValue<number>; activo: boolean; onPress: () => void }) {
  const estilo = useAnimatedStyle(() => {
    const cerca = interpolate(progreso.value, [indice - 1, indice, indice + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 6 + 14 * cerca, opacity: 0.35 + 0.65 * cerca };
  });
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="tab" accessibilityState={{ selected: activo }} accessibilityLabel={`Ir a la página ${indice + 1}`}>
      <Animated.View style={[styles.dot, estilo]} />
    </Pressable>
  );
}

export function ListaDePasos({
  pasos,
  porPagina,
  ascender = false,
  testID,
}: {
  pasos: readonly Paso[];
  porPagina: number;
  /** La cuenta de la animación empieza por el final de cada página (la escalera de niveles se sube desde abajo). */
  ascender?: boolean;
  testID?: string;
}) {
  const paginas = paginar(pasos, porPagina);
  const inicial = Math.max(0, paginas.findIndex((p) => p.some((x) => x.actual)));
  const { width: ventana } = useWindowDimensions();
  const [ancho, setAncho] = useState(Math.max(240, ventana - 32));
  const [pagina, setPagina] = useState(inicial);
  const [vistas] = useState(() => new Set<number>([inicial]));
  const progreso = useSharedValue(inicial);
  const scroll = useRef<Animated.ScrollView>(null);

  const alMedir = useCallback(
    (e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w <= 0) return;
      setAncho(w);
      // Abre en la página donde está lo actual, sin animar.
      requestAnimationFrame(() => scroll.current?.scrollTo({ x: inicial * w, animated: false }));
    },
    [inicial],
  );
  const marcar = useCallback(
    (n: number) => {
      vistas.add(n);
      setPagina(n);
    },
    [vistas],
  );
  const alDesplazar = useAnimatedScrollHandler({
    onScroll: (e) => {
      progreso.value = e.contentOffset.x / ancho;
      runOnJS(marcar)(Math.round(e.contentOffset.x / ancho));
    },
  });
  const irA = (n: number) => scroll.current?.scrollTo({ x: n * ancho, animated: true });

  return (
    <View testID={testID}>
      <Card padding="none">
        <View onLayout={alMedir} style={styles.visor}>
          <Animated.ScrollView ref={scroll} horizontal pagingEnabled decelerationRate="fast" showsHorizontalScrollIndicator={false} onScroll={alDesplazar} scrollEventThrottle={16}>
            {paginas.map((filas, p) => (
              <View key={p} style={{ width: ancho }} testID={testID ? `${testID}-pagina-${p + 1}` : undefined}>
                {filas.map((paso, i) => (
                  <Fila key={paso.clave} paso={paso} separador={i > 0} reproducir={vistas.has(p) || pagina === p} retardo={(ascender ? filas.length - 1 - i : i) * ESCALON_MS} />
                ))}
              </View>
            ))}
          </Animated.ScrollView>
        </View>
      </Card>
      {paginas.length > 1 ? (
        <View style={styles.puntos} accessibilityRole="tablist">
          {paginas.map((_, p) => (
            <Punto key={p} indice={p} progreso={progreso} activo={pagina === p} onPress={() => irA(p)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  visor: { overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  texto: { flex: 1, gap: 2 },
  marca: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border.strong, alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  puntos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingTop: space.md },
  dot: { height: 6, borderRadius: 3, backgroundColor: color.action.primary },
});
