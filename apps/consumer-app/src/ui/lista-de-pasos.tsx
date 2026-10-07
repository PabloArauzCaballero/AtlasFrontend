/**
 * Una lista VERTICAL de pasos (niveles, misiones) que se enseña poco a poco y entra con movimiento.
 *
 * Pablo (2026-10-07): «aquí puede ser vertical» y «hay demasiados»: los doce niveles y todas las misiones de golpe eran una
 * pared. Aquí se enseña lo que importa (`resumir`) y el resto queda tras un botón.
 *
 * ## Movimiento (contesta «¿de dónde salió esto?»)
 *
 * Cada fila sube 10 px mientras aparece, escalonada; en la escalera de niveles (`ascender`) la cuenta empieza por ABAJO,
 * así que se ve cómo se sube hasta donde estás. La marca de lo hecho entra con un muelle corto. Con movimiento reducido
 * todo aparece ya puesto.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { color, easing, motion, radius, space, spring } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Card, Divider } from './primitives';

export type Paso = { clave: string; titulo: string; derecha: string; hecho: boolean; actual?: boolean; detalle?: string; etiqueta: string };

const CURVA = Easing.bezier(easing.decelerate[0], easing.decelerate[1], easing.decelerate[2], easing.decelerate[3]);
const ESCALON_MS = 90;

function Fila({ paso, retardo, separador }: { paso: Paso; retardo: number; separador: boolean }) {
  const reducido = useReducedMotion();
  const entrada = useSharedValue(reducido ? 1 : 0);
  const marca = useSharedValue(reducido || !paso.hecho ? 1 : 0);
  useEffect(() => {
    if (reducido) return;
    entrada.value = withDelay(retardo, withTiming(1, { duration: motion.base, easing: CURVA }));
    if (paso.hecho) marca.value = withDelay(retardo + motion.fast, withSpring(1, spring.settle));
  }, [entrada, marca, paso.hecho, reducido, retardo]);
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
          <AtlasText variant="bodyStrong" tone={paso.actual ? 'brand' : paso.hecho && !paso.actual ? 'primary' : 'primary'}>
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

export function ListaDePasos({
  pasos,
  resumir,
  ascender = false,
  verTodos,
  testID,
}: {
  pasos: readonly Paso[];
  /** Qué enseñar de entrada. Sin esto se enseña todo. */
  resumir?: (pasos: readonly Paso[]) => Paso[];
  /** La cuenta de la animación empieza por el final de la lista (la escalera de niveles se sube desde abajo). */
  ascender?: boolean;
  verTodos: (ocultos: number) => string;
  testID?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const visibles = abierta || !resumir ? [...pasos] : resumir(pasos);
  const ocultos = pasos.length - visibles.length;
  return (
    <View testID={testID}>
      <Card padding="none">
        {visibles.map((paso, i) => (
          <Fila key={paso.clave} paso={paso} separador={i > 0} retardo={(ascender ? visibles.length - 1 - i : i) * ESCALON_MS} />
        ))}
      </Card>
      {ocultos > 0 || abierta ? (
        <Pressable accessibilityRole="button" hitSlop={8} style={styles.ver} onPress={() => setAbierta((a) => !a)} testID={testID ? `${testID}-ver-todos` : undefined}>
          <AtlasText variant="caption" tone="brand">
            {abierta ? 'Ver menos' : verTodos(ocultos)}
          </AtlasText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Los niveles, de arriba abajo (el más alto primero): se enseñan los 3 que vienen, el actual y nada más. */
export const resumirNiveles = (pasos: readonly Paso[]): Paso[] => {
  const actual = pasos.findIndex((p) => p.actual);
  if (actual < 0) return pasos.slice(0, 5);
  return pasos.slice(Math.max(0, actual - 3), actual + 1);
};

/** Las misiones: las pendientes primero (hasta 4); si ya no queda ninguna, las primeras hechas. */
export const resumirMisiones = (pasos: readonly Paso[]): Paso[] => {
  const pendientes = pasos.filter((p) => !p.hecho);
  return (pendientes.length > 0 ? pendientes : pasos).slice(0, 4);
};

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  texto: { flex: 1, gap: 2 },
  marca: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border.strong, alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  ver: { alignSelf: 'center', paddingVertical: space.sm },
});
