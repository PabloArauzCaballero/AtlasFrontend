/**
 * Una tarjeta larga partida en páginas que se deslizan, con su título arriba y los puntos abajo.
 *
 * Para explicaciones que son varias cosas seguidas («Lo que miró el motor»: el índice, con qué se calculó, por qué tu
 * límite, cómo subirlo). Todo en una columna obligaba a bajar una pantalla entera (Pablo, 2026-10-09: «esto debe ser
 * paginado»). Cada página es un tema; se pasa deslizando o tocando un punto o una pestaña.
 */
import React, { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { AtlasText } from './primitives';

export type Pagina = { clave: string; titulo: string; contenido: React.ReactNode };

export function Paginas({ paginas, testID }: { paginas: readonly Pagina[]; testID?: string }) {
  const [ancho, setAncho] = useState(0);
  const [actual, setActual] = useState(0);
  const scroll = useRef<ScrollView>(null);

  const alMedir = useCallback((e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width)), []);
  const alParar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ancho > 0) setActual(Math.round(e.nativeEvent.contentOffset.x / ancho));
  };
  const irA = (n: number) => {
    setActual(n);
    scroll.current?.scrollTo({ x: n * ancho, animated: true });
  };

  return (
    <View testID={testID} onLayout={alMedir}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pestanas}>
        {paginas.map((p, i) => (
          <Pressable
            key={p.clave}
            onPress={() => irA(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === actual }}
            style={[styles.pestana, i === actual && styles.pestanaActiva]}
            testID={testID ? `${testID}-pestana-${i + 1}` : undefined}
          >
            <AtlasText variant="captionStrong" tone={i === actual ? 'brand' : 'secondary'}>
              {p.titulo}
            </AtlasText>
          </Pressable>
        ))}
      </ScrollView>

      {ancho > 0 ? (
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={alParar}
        >
          {paginas.map((p, i) => (
            <View key={p.clave} style={[styles.pagina, { width: ancho }]} testID={testID ? `${testID}-pagina-${i + 1}` : undefined}>
              {p.contenido}
            </View>
          ))}
        </ScrollView>
      ) : (
        // Antes de medir: la primera página, para que no salte el alto al aparecer.
        <View style={styles.pagina}>{paginas[0]?.contenido}</View>
      )}

      {paginas.length > 1 ? (
        <View style={styles.puntos}>
          {paginas.map((p, i) => (
            <Pressable key={p.clave} onPress={() => irA(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Ir a ${p.titulo}`}>
              <View style={[styles.punto, i === actual && styles.puntoActivo]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pestanas: { gap: space.xs, paddingBottom: space.sm },
  pestana: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  pestanaActiva: { borderColor: color.action.primary, backgroundColor: color.feedbackSoft.success },
  pagina: { gap: space.sm },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: space.xs, paddingTop: space.md },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border.strong },
  puntoActivo: { width: 18, backgroundColor: color.action.primary },
});
