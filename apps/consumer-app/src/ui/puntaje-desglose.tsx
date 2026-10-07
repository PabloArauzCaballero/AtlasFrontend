/**
 * La calificación de la persona, desglosada: cada parte con su valor, su peso, los puntos que aporta y por qué.
 *
 * Es la respuesta a «¿por qué tengo este puntaje?». Va PAGINADA —una parte por página, y al final el resultado—
 * porque cuatro cuentas apiladas se leían como una tabla y ninguna como una explicación (Pablo, 2026-10-07).
 *
 * Los `points` de las partes suman `rawScore`; si un tope recortó el resultado, la última página dice cuál y por qué.
 *
 * ## Movimiento (contesta «¿de dónde salió esto?»)
 *
 * Al llegar a una página por PRIMERA vez, la barra sube hasta su valor y los puntos cuentan hacia arriba al mismo
 * ritmo: la cifra y la barra son la misma cosa vista de dos maneras, así que comparten un solo valor compartido. No
 * se repite al volver a la página —ya se vio— y con movimiento reducido todo aparece en su valor final. El punto de la
 * punta de la barra lleva un halo fijo; no pulsa solo.
 */
import { useCallback, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { Progress } from '../api/endpoints/credit-line';
import { cuentaDeUnaParte, formatoPuntos, fraseDelResultado } from '../features/puntaje-explicado';
import { color, space } from '../theme/tokens';
import { Barra, CuentaArriba, useAvance } from './cuenta-arriba';
import { Icon } from './icons';
import { AtlasText, Card, CardHeader } from './primitives';

type Parte = Progress['components'][number];

export function PuntajeDesglose({
  progress,
  titulo = 'Por qué tienes esta calificación',
  onVerMas,
  plano = false,
}: {
  progress: Progress;
  titulo?: string;
  /** Sin tarjeta alrededor: para pintarlo dentro de una hoja de «Más info», que ya es la superficie. */
  plano?: boolean;
  /** Sólo donde hay más que ver: en «Tu nivel Atlas» ya se está ahí y no se pinta el botón. */
  onVerMas?: () => void;
}) {
  const Envoltura = plano ? View : Card;
  const partes = progress.components;
  const total = partes.length + 1; // las partes y el resultado
  const { width: ventana } = useWindowDimensions();
  const [ancho, setAncho] = useState(Math.max(240, ventana - 80));
  const [pagina, setPagina] = useState(0);
  const vistas = useRef(new Set<number>([0])).current;
  const progresoScroll = useSharedValue(0);
  const scroll = useRef<Animated.ScrollView>(null);

  const alMedir = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setAncho(w);
  }, []);

  const marcar = useCallback(
    (n: number) => {
      vistas.add(n);
      setPagina(n);
    },
    [vistas],
  );

  // En el hilo de UI: el avance de los puntos del pie sigue al dedo sin pasar por React. A JS sólo vuelve el número de página.
  const alDesplazar = useAnimatedScrollHandler({
    onScroll: (e) => {
      progresoScroll.value = e.contentOffset.x / ancho;
      const n = Math.round(e.contentOffset.x / ancho);
      runOnJS(marcar)(n);
    },
  });

  const irA = (n: number) => scroll.current?.scrollTo({ x: n * ancho, animated: true });

  return (
    <Envoltura testID="por-que-puntaje" style={plano ? styles.plano : undefined}>
      <CardHeader icon="grafico" title={titulo} detail="La cuenta de tu calificación de 1 a 100, parte por parte, con tus datos." divider={false} />
      <View onLayout={alMedir} style={styles.visor}>
        <Animated.ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={alDesplazar}
          scrollEventThrottle={16}
          testID="por-que-puntaje-paginas"
        >
          {partes.map((parte, i) => (
            <PaginaDeParte key={parte.code} parte={parte} indice={i} de={partes.length} ancho={ancho} activa={pagina === i} vista={vistas.has(i)} />
          ))}
          <PaginaDeResultado progress={progress} ancho={ancho} activa={pagina === partes.length} />
        </Animated.ScrollView>
      </View>
      <View style={styles.puntos} accessibilityRole="tablist">
        {Array.from({ length: total }, (_, i) => (
          <Punto key={i} indice={i} progreso={progresoScroll} activo={pagina === i} onPress={() => irA(i)} />
        ))}
      </View>
      {onVerMas ? (
        <Pressable accessibilityRole="button" onPress={onVerMas} style={styles.verMas} hitSlop={8}>
          <AtlasText variant="caption" tone="brand">
            Ver cómo subir de nivel
          </AtlasText>
        </Pressable>
      ) : null}
    </Envoltura>
  );
}

/* ------------------------------------------------------------------ páginas */

function PaginaDeParte({ parte, indice, de, ancho, activa, vista }: { parte: Parte; indice: number; de: number; ancho: number; activa: boolean; vista: boolean }) {
  const maximo = Math.round(parte.weight * 100);
  const avance = useAvance(activa || vista);
  return (
    <View style={[styles.pagina, { width: ancho }]} accessibilityLabel={`${parte.label}. ${cuentaDeUnaParte(parte)}. ${parte.why}`}>
      <AtlasText variant="caption" tone="tertiary" style={styles.sobretitulo}>
        {`PARTE ${indice + 1} DE ${de}`}
      </AtlasText>
      <AtlasText variant="h3">{parte.label}</AtlasText>
      <View style={styles.cifra}>
        <CuentaArriba avance={avance} hasta={parte.points} formato={formatoPuntos} />
        <AtlasText variant="caption" tone="secondary">
          {`de ${maximo} posibles`}
        </AtlasText>
      </View>
      <Barra valor={parte.value} avance={avance} etiqueta={`${parte.label}: ${parte.value} de 100`} />
      <AtlasText variant="caption" tone="brand">
        {cuentaDeUnaParte(parte)}
      </AtlasText>
      <AtlasText variant="caption" tone="secondary">
        {parte.why}
      </AtlasText>
    </View>
  );
}

function PaginaDeResultado({ progress, ancho, activa }: { progress: Progress; ancho: number; activa: boolean }) {
  const avance = useAvance(activa);
  return (
    <View style={[styles.pagina, { width: ancho }]}>
      <AtlasText variant="caption" tone="tertiary" style={styles.sobretitulo}>
        RESULTADO
      </AtlasText>
      <AtlasText variant="h3">Tu calificación</AtlasText>
      <View style={styles.cifra}>
        <CuentaArriba avance={avance} hasta={progress.score} formato={(n) => String(Math.round(n))} />
        <AtlasText variant="caption" tone="secondary">
          sobre 100
        </AtlasText>
      </View>
      <Barra valor={progress.score} avance={avance} etiqueta={`Calificación ${progress.score} de 100`} />
      <AtlasText variant="bodyStrong">{fraseDelResultado(progress)}</AtlasText>
      {progress.caps.map((tope) => (
        <View key={tope.code} style={styles.tope} accessibilityLabel={`Tope. ${tope.detail}`}>
          <Icon name="info" size={18} tint={color.feedback.warning} />
          <AtlasText variant="caption" tone="secondary" style={styles.texto}>
            {tope.detail}
          </AtlasText>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ piezas */

/** Un punto del pie: el activo se alarga y se enciende; el ancho sigue al dedo mientras se desliza. */
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

const styles = StyleSheet.create({
  plano: { gap: space.sm },
  visor: { overflow: 'hidden' },
  pagina: { overflow: 'hidden', paddingHorizontal: space.sm, gap: space.sm, paddingTop: space.md, paddingBottom: space.xs },
  sobretitulo: { letterSpacing: 1.4 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingTop: space.xs },
  puntos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingTop: space.md },
  dot: { height: 6, borderRadius: 3, backgroundColor: color.action.primary },
  verMas: { alignSelf: 'center', paddingTop: space.sm },
  tope: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.xs },
  texto: { flex: 1, gap: 2 },
});
