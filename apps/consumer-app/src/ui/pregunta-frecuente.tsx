/**
 * Una pregunta frecuente de Soporte, desplegable.
 *
 * Antes era el `Accordion` genérico dentro de una sola tarjeta: preguntas en `h3` que partían en dos
 * renglones, la respuesta corta y el paso a paso al mismo peso, y el «Cuándo escribirnos» como una
 * pastilla pegada al texto (Pablo, 2026-10-08: «hagamos las mejoras acá»). Ahora cada pregunta es su
 * propia tarjeta con número, la respuesta corta va destacada con una barra de marca, el paso a paso
 * debajo, y «Cuándo escribirnos» es un aviso propio con su botón para hablar con soporte.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { color, press, radius, space, spring, stroke } from '../theme/tokens';
import { Icon } from './icons';
import { Markdown } from './markdown';
import { PressSurface } from './motion';
import { AtlasText, Button } from './primitives';

export function PreguntaFrecuente({
  numero,
  pregunta,
  respuestaCorta,
  detalle,
  cuandoEscribirnos,
  onEscribir,
  testID,
}: {
  numero: number;
  pregunta: string;
  respuestaCorta?: string | null;
  detalle?: string | null;
  cuandoEscribirnos?: string | null;
  onEscribir?: () => void;
  testID?: string;
}) {
  const [abierta, setAbierta] = React.useState(false);
  const reducido = useReducedMotion();
  const giro = useSharedValue(0);
  React.useEffect(() => {
    giro.value = reducido ? (abierta ? 1 : 0) : withSpring(abierta ? 1 : 0, spring.settle);
  }, [abierta, reducido, giro]);
  const flecha = useAnimatedStyle(() => ({ transform: [{ rotate: `${giro.value * 90}deg` }] }));

  return (
    <View style={[styles.tarjeta, abierta && styles.tarjetaAbierta]} testID={testID}>
      <PressSurface
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={pregunta}
        onPress={() => setAbierta((a) => !a)}
        scaleTo={press.scaleSubtle}
        style={styles.cabecera}
      >
        <View style={[styles.numero, abierta && styles.numeroAbierto]}>
          <AtlasText variant="captionStrong" tone={abierta ? 'onBrand' : 'brand'}>
            {String(numero).padStart(2, '0')}
          </AtlasText>
        </View>
        <AtlasText variant="bodyStrong" style={styles.pregunta}>
          {pregunta}
        </AtlasText>
        <Reanimated.View style={flecha}>
          <Icon name="adelante" size={16} tint={abierta ? color.action.primary : color.text.tertiary} />
        </Reanimated.View>
      </PressSurface>

      {abierta ? (
        <View style={styles.cuerpo}>
          {respuestaCorta ? (
            <View style={styles.corta}>
              <View style={styles.cortaBarra} />
              <View style={styles.cortaTexto}>
                <Markdown variant="body" tone="primary">
                  {respuestaCorta}
                </Markdown>
              </View>
            </View>
          ) : null}
          {detalle ? (
            <View style={styles.detalle}>
              <AtlasText variant="overline" tone="tertiary">
                Paso a paso
              </AtlasText>
              <Markdown variant="caption">{detalle}</Markdown>
            </View>
          ) : null}
          {/*
            Cuándo escribir va aparte y destacado: un artículo que no dice dónde termina su utilidad deja a la
            persona insistiendo con una guía que ya no aplica a su caso.
          */}
          {cuandoEscribirnos ? (
            <View style={styles.aviso}>
              <View style={styles.avisoCabeza}>
                <Icon name="chat" size={16} tint={color.feedback.info} />
                <AtlasText variant="captionStrong" style={{ color: color.feedback.info }}>
                  Cuándo escribirnos
                </AtlasText>
              </View>
              <AtlasText variant="caption" tone="secondary">
                {cuandoEscribirnos}
              </AtlasText>
              {onEscribir ? <Button label="Hablar con soporte" icon="chat" variant="secondary" onPress={onEscribir} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    marginBottom: space.sm,
    borderRadius: radius.xl,
    borderWidth: stroke.hairline,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.raised,
    overflow: 'hidden',
  },
  tarjetaAbierta: { borderColor: color.accent.border },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  numero: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.feedbackSoft.success,
  },
  numeroAbierto: { backgroundColor: color.action.primary },
  pregunta: { flex: 1 },
  cuerpo: { gap: space.md, paddingHorizontal: space.md, paddingBottom: space.md },
  corta: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.feedbackSoft.success,
  },
  cortaBarra: { width: 3, borderRadius: 2, backgroundColor: color.action.primary },
  cortaTexto: { flex: 1 },
  detalle: { gap: space.xs },
  aviso: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: stroke.hairline,
    borderColor: color.accent.border,
    backgroundColor: color.feedbackSoft.info,
  },
  avisoCabeza: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
