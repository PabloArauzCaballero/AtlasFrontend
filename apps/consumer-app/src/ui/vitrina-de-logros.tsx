/**
 * La vitrina de logros: los trofeos agrupados por colección, con cuánto falta para lo más cercano.
 *
 * Dos ideas de conducta mandan aquí. La primera, el gradiente de meta: la gente acelera cuando ve cerca la meta, así que lo
 * más cercano a ganarse va ARRIBA, con su barra, antes que cualquier colección. La segunda, el cierre de colecciones: «2 de
 * 4 en Rachas» da una razón concreta para el siguiente paso. Las insignias secretas cuentan en el total pero no se
 * anticipan: enseñan su pista y un candado.
 *
 * Tocar CUALQUIER insignia abre su carta (`carta-de-insignia.tsx`); desde la de una ganada se puede revivir su celebración.
 * Van paginadas por colección: treinta y cuatro de golpe eran demasiadas (Pablo, 2026-10-07).
 */
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { Badge, Progress } from '../api/endpoints/credit-line';
import { logroDeInsignia, NOMBRE_COLECCION } from '../features/celebraciones';
import { abrirCartaDeInsignia } from '../features/celebraciones-bus';
import { avanceDeInsignia } from '../features/puntaje-explicado';
import { color, palette, space } from '../theme/tokens';
import { Insignia } from './insignia';
import { AtlasText, Card, SectionHeader } from './primitives';
import { BarraViva } from './cuenta-arriba';

/** El trofeo sin ganar, no secreto, con más avance proporcional: lo que está a un paso. */
export function masCercano(badges: readonly Badge[]): Badge | null {
  const candidatas = badges.filter((b) => !b.earned && !b.secret && b.target > 0 && b.current > 0);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, b) => (b.current / b.target > mejor.current / mejor.target ? b : mejor));
}

/** Las insignias por colección, en el orden de `NOMBRE_COLECCION`; sin `category` (backend anterior), todas en una. */
export function porColeccion(badges: readonly Badge[]): { clave: string; nombre: string; items: Badge[] }[] {
  const orden = Object.keys(NOMBRE_COLECCION);
  const grupos = new Map<string, Badge[]>();
  for (const b of badges) grupos.set(b.category ?? 'todas', [...(grupos.get(b.category ?? 'todas') ?? []), b]);
  return [...grupos.entries()]
    .sort(([a], [b]) => (orden.indexOf(a) === -1 ? 99 : orden.indexOf(a)) - (orden.indexOf(b) === -1 ? 99 : orden.indexOf(b)))
    .map(([clave, items]) => ({ clave, nombre: NOMBRE_COLECCION[clave] ?? 'Tus trofeos', items }));
}

/** Cuántas pendientes se enseñan por colección antes de «Ver las que faltan»: lo ganado y lo próximo, no el catálogo. */
export const PENDIENTES_A_LA_VISTA = 3;

/**
 * Lo que se ve de una colección: todo lo ganado y las pendientes más cercanas (las secretas, al final). Treinta y cuatro
 * insignias a la vez abruman; la gente mira lo que ya es suyo y lo que está a un paso (Pablo, 2026-10-07).
 */
export function aLaVista(items: readonly Badge[], abierta: boolean): { visibles: Badge[]; ocultas: number } {
  if (abierta) return { visibles: [...items], ocultas: 0 };
  const razon = (b: Badge) => (b.target > 0 ? b.current / b.target : 0);
  const pendientes = items
    .filter((b) => !b.earned)
    .sort((a, b) => Number(!!a.secret) - Number(!!b.secret) || razon(b) - razon(a))
    .slice(0, PENDIENTES_A_LA_VISTA);
  const elegidas = new Set(pendientes.map((b) => b.code));
  const visibles = items.filter((b) => b.earned || elegidas.has(b.code));
  return { visibles, ocultas: items.length - visibles.length };
}

export function VitrinaDeLogros({ progress }: { progress: Progress }) {
  const badges = progress.experience.badges;
  const ganadas = badges.filter((b) => b.earned).length;
  const cercano = masCercano(badges);
  const grupos = porColeccion(badges);
  const { width: ventana } = useWindowDimensions();
  const [ancho, setAncho] = useState(Math.max(240, ventana - 80));
  const [pagina, setPagina] = useState(0);
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set());
  const progresoScroll = useSharedValue(0);
  const scroll = useRef<Animated.ScrollView>(null);

  const alDesplazar = useAnimatedScrollHandler({
    onScroll: (e) => {
      progresoScroll.value = e.contentOffset.x / ancho;
      runOnJS(setPagina)(Math.round(e.contentOffset.x / ancho));
    },
  });
  const irA = (n: number) => scroll.current?.scrollTo({ x: n * ancho, animated: true });
  const actual = grupos[Math.min(pagina, grupos.length - 1)];
  const hechas = actual ? actual.items.filter((b) => b.earned).length : 0;

  return (
    <View style={styles.vitrina}>
      <SectionHeader title="Tus insignias" detail={`${ganadas} de ${badges.length} ganadas · de bronce a diamante`} />
      <BarraViva value={badges.length > 0 ? Math.round((ganadas / badges.length) * 100) : 0} label={`${ganadas} de ${badges.length} insignias ganadas`} />
      {cercano ? (
        <Card tone="brand" testID="logro-mas-cercano">
          <AtlasText variant="overline" tone="brand">
            LO MÁS CERCANO
          </AtlasText>
          <AtlasText variant="bodyStrong">{cercano.label}</AtlasText>
          <AtlasText variant="caption" tone="secondary">{`${cercano.detail} Llevas ${avanceDeInsignia(cercano)}.`}</AtlasText>
          <BarraViva value={Math.round((cercano.current / cercano.target) * 100)} label={`Avance de ${cercano.label}`} />
        </Card>
      ) : null}

      {/* Una colección por página: treinta y cuatro insignias de golpe eran una pared, no una vitrina. */}
      <Card style={styles.caja} testID="vitrina-paginada">
        {actual && actual.clave !== 'todas' ? (
          <View style={styles.cabecera}>
            <AtlasText variant="bodyStrong">{actual.nombre}</AtlasText>
            <AtlasText variant="caption" tone={hechas === actual.items.length ? 'brand' : 'tertiary'}>
              {hechas === actual.items.length ? 'Completa' : `${hechas} de ${actual.items.length}`}
            </AtlasText>
          </View>
        ) : null}
        <View onLayout={(e: LayoutChangeEvent) => e.nativeEvent.layout.width > 0 && setAncho(Math.round(e.nativeEvent.layout.width))} style={styles.visor}>
          <Animated.ScrollView ref={scroll} horizontal pagingEnabled decelerationRate="fast" showsHorizontalScrollIndicator={false} onScroll={alDesplazar} scrollEventThrottle={16}>
            {grupos.map((grupo) => {
              const abierta = abiertas.has(grupo.clave);
              const { visibles, ocultas } = aLaVista(grupo.items, abierta);
              return (
                <View key={grupo.clave} style={[styles.rejilla, { width: ancho }]} testID={`coleccion-${grupo.clave}`}>
                  <View style={styles.celdas} testID={grupo.clave === 'todas' ? 'insignias' : undefined}>
                    {visibles.map((insignia) => (
                      <Insignia key={insignia.code} insignia={insignia} onPress={() => abrirCartaDeInsignia(logroDeInsignia(progress, insignia))} />
                    ))}
                  </View>
                  {ocultas > 0 || abierta ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.verTodas}
                      onPress={() =>
                        setAbiertas((previas) => {
                          const sig = new Set(previas);
                          if (sig.has(grupo.clave)) sig.delete(grupo.clave);
                          else sig.add(grupo.clave);
                          return sig;
                        })
                      }
                      testID={`ver-todas-${grupo.clave}`}
                    >
                      <AtlasText variant="caption" tone="brand">
                        {abierta ? 'Ver menos' : `Ver las ${ocultas} que faltan`}
                      </AtlasText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Animated.ScrollView>
        </View>
        {grupos.length > 1 ? (
          <View style={styles.puntos} accessibilityRole="tablist">
            {grupos.map((g, i) => (
              <Punto key={g.clave} indice={i} progreso={progresoScroll} activo={pagina === i} etiqueta={g.nombre} onPress={() => irA(i)} />
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

/** Un punto del pie: el activo se alarga y se enciende; sigue al dedo mientras se desliza. */
function Punto({ indice, progreso, activo, etiqueta, onPress }: { indice: number; progreso: SharedValue<number>; activo: boolean; etiqueta: string; onPress: () => void }) {
  const estilo = useAnimatedStyle(() => {
    const cerca = interpolate(progreso.value, [indice - 1, indice, indice + 1], [0, 1, 0], Extrapolation.CLAMP);
    return { width: 6 + 14 * cerca, opacity: 0.35 + 0.65 * cerca };
  });
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="tab" accessibilityState={{ selected: activo }} accessibilityLabel={`Colección ${etiqueta}`}>
      <Animated.View style={[styles.dot, estilo]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  vitrina: { gap: space.md },
  caja: { backgroundColor: palette.bg, borderColor: color.feedbackBorder.brand, gap: space.sm },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  visor: { overflow: 'hidden' },
  rejilla: { justifyContent: 'flex-start' },
  celdas: { flexDirection: 'row', flexWrap: 'wrap' },
  verTodas: { alignSelf: 'center', paddingVertical: space.sm },
  puntos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingTop: space.xs },
  dot: { height: 6, borderRadius: 3, backgroundColor: color.action.primary },
});
