/**
 * «Consejos para la foto»: un desplegable sobre el visor de la camara.
 *
 * ## Por que sobre el visor y no en la columna
 *
 * La camara de captura ocupa todo el hueco que le deja la pantalla (`flex: 1`). Un bloque que
 * creciera EN la columna la encogeria al abrirse, y el visor reencuadra y parpadea cada vez que
 * cambia de tamano. Aqui el desplegable se superpone al visor con posicion absoluta: el visor no se
 * entera, no hay nada que medir y el unico elemento que cambia de altura es el propio panel.
 *
 * ## Por que el pie «Entendido» va FUERA del desplazamiento
 *
 * En la guia de la que partimos —una hoja con la cabecera fija y el contenido desplazandose debajo—
 * la imagen que pasaba por la cabecera se cortaba en seco, a media ilustracion. Aqui el panel es una
 * superficie propia que recorta con su radio y la accion de cerrar esta siempre a la vista, sin
 * tener que desplazarse hasta el final para encontrarla.
 *
 * ## Accesibilidad
 *
 * Lo correcto y lo incorrecto no se distinguen solo por el matiz verde/rojo: cada ficha lleva su
 * insignia (visto / aspa) Y su rotulo escrito. Los dibujos se anuncian con una frase, no como
 * «imagen». Con movimiento reducido, el panel aparece sin animacion.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { CONSEJOS, type Consejo, type TipoDeFoto } from '../features/consejos-foto';
import { color, radius, shadow, space, spring, stroke, touch } from '../theme/tokens';
import { DIBUJO_ASPECTO, svgDe } from './consejos-foto-dibujos';
import { toqueWeb } from './hit-slop';
import { Icon } from './icons';
import { AtlasText } from './primitives';

export function ConsejosFoto({ tipo, children }: { tipo: TipoDeFoto; children: React.ReactNode }) {
  const contenido = CONSEJOS[tipo];
  const [abierto, setAbierto] = useState(false);
  const reduced = useReducedMotion();
  const giro = useSharedValue(0);

  useEffect(() => {
    giro.value = reduced ? (abierto ? 1 : 0) : withSpring(abierto ? 1 : 0, spring.settle);
  }, [abierto, reduced, giro]);

  // «adelante» apunta a la derecha: 90° la deja hacia abajo (plegado) y 270° hacia arriba (abierto).
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 + giro.value * 180}deg` }] }));

  const entrada = FadeInUp.duration(220).reduceMotion(ReduceMotion.System);
  const salida = FadeOutUp.duration(160).reduceMotion(ReduceMotion.System);

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setAbierto((actual) => !actual)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${contenido.titulo}. ${abierto ? 'Ocultar' : 'Ver'} los consejos con ejemplos.`}
        style={({ pressed }) => [styles.toggle, abierto && styles.toggleAbierto, pressed && styles.toggleApretado]}
        hitSlop={4}
        {...toqueWeb(4)}
      >
        <View style={styles.chip}>
          <Icon name="info" size={18} tint={color.action.primary} />
        </View>
        <View style={styles.toggleTexto}>
          <AtlasText variant="title" numberOfLines={1}>
            {contenido.titulo}
          </AtlasText>
          <AtlasText variant="caption" tone="secondary" numberOfLines={1}>
            {contenido.resumen}
          </AtlasText>
        </View>
        <Animated.View style={chevron}>
          <Icon name="adelante" size={18} tint={color.text.tertiary} />
        </Animated.View>
      </Pressable>

      <View style={styles.escenario}>
        {children}
        {abierto ? (
          <Animated.View entering={entrada} exiting={salida} style={styles.panel} accessibilityViewIsModal>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.lista}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              bounces={false}
            >
              {contenido.consejos.map((consejo, indice) => (
                <FilaDeConsejo key={consejo.id} consejo={consejo} primera={indice === 0} />
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setAbierto(false)}
              accessibilityRole="button"
              accessibilityLabel="Entendido, cerrar los consejos"
              style={({ pressed }) => [styles.cerrar, pressed && styles.toggleApretado]}
              hitSlop={4}
              {...toqueWeb(4)}
            >
              <Icon name="check" size={18} tint={color.text.primary} />
              <AtlasText variant="bodyStrong" tone="primary">
                Entendido
              </AtlasText>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function FilaDeConsejo({ consejo, primera }: { consejo: Consejo; primera: boolean }) {
  return (
    <View style={[styles.fila, !primera && styles.filaSeparada]}>
      <AtlasText variant="title">{consejo.titulo}</AtlasText>
      <View style={styles.fichas}>
        <Ficha dibujo={consejo.bien} etiqueta={consejo.bienEtiqueta} correcta />
        <Ficha dibujo={consejo.mal} etiqueta={consejo.malEtiqueta} correcta={false} />
      </View>
      <AtlasText variant="caption" tone="secondary">
        {consejo.texto}
      </AtlasText>
    </View>
  );
}

export function Ficha({ dibujo, etiqueta, correcta }: { dibujo: Consejo['bien']; etiqueta: string; correcta: boolean }) {
  const xml = useMemo(() => svgDe(dibujo), [dibujo]);
  const tono = correcta ? color.feedback.success : color.feedback.danger;
  return (
    <View style={styles.ficha}>
      <View
        style={[styles.dibujo, { borderColor: correcta ? color.feedbackBorder.success : color.feedbackBorder.danger }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${correcta ? 'Correcto' : 'Incorrecto'}: ${etiqueta}`}
      >
        <SvgXml xml={xml} width="100%" height="100%" />
        <Insignia correcta={correcta} tono={tono} />
      </View>
      {/* El rotulo escrito: el matiz solo no basta para quien no distingue verde de rojo. */}
      <AtlasText variant="micro" style={{ color: tono }}>
        {correcta ? 'Correcto' : 'Incorrecto'}
      </AtlasText>
    </View>
  );
}

/** Visto o aspa dentro de un circulo, en la esquina inferior derecha de la ficha. */
function Insignia({ correcta, tono }: { correcta: boolean; tono: string }) {
  return (
    <View style={styles.insignia} pointerEvents="none">
      <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={12} cy={12} r={10.5} fill={color.surface.secondary} stroke={tono} strokeWidth={1.8} />
        <Path
          d={correcta ? 'M7.5 12.4 L10.6 15.3 L16.6 9' : 'M8.6 8.6 L15.4 15.4 M15.4 8.6 L8.6 15.4'}
          fill="none"
          stroke={tono}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: space.sm },
  toggle: {
    minHeight: touch.minSize + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
  },
  toggleAbierto: { borderColor: color.accent.border },
  toggleApretado: { opacity: 0.85 },
  chip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brandWash.from,
    borderWidth: 1,
    borderColor: color.surface.edge,
  },
  toggleTexto: { flex: 1, gap: 2 },

  // Las dos cosas comparten hueco: el visor llena el escenario y el panel se le superpone.
  escenario: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: '100%',
    borderRadius: radius.xl,
    backgroundColor: color.surface.sheet,
    borderWidth: 1,
    borderColor: color.border.strong,
    borderTopColor: color.surface.edge,
    overflow: 'hidden',
    ...shadow.card,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  lista: { padding: space.base, gap: space.base },
  fila: { gap: space.sm },
  filaSeparada: { borderTopWidth: stroke.hairline, borderTopColor: color.border.hairline, paddingTop: space.base },
  fichas: { flexDirection: 'row', gap: space.sm },
  ficha: { flex: 1, gap: space.xs },
  dibujo: {
    width: '100%',
    aspectRatio: DIBUJO_ASPECTO,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: color.surface.secondary,
  },
  insignia: { position: 'absolute', right: space.xs, bottom: space.xs },
  cerrar: {
    minHeight: touch.minSize,
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: stroke.hairline,
    borderTopColor: color.border.hairline,
    backgroundColor: color.surface.raised,
  },
});
