/**
 * La Calificación de la persona: de 1 a 100, qué tan buen pagador es (pedido de Pablo, 2026-10-06).
 *
 * Es una pieza aparte del Puntaje a propósito. El Puntaje son puntos que se GANAN pagando y sólo suben; la
 * Calificación es un juicio sobre cómo paga y puede bajar. Ponerlos en la misma tarjeta hacía que «tengo 1.200
 * puntos» y «califico 38» se leyeran como el mismo número.
 */
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { calificacionDe, fraseDeCalificacion } from '../features/calificacion';
import { space } from '../theme/tokens';
import { PressSurface } from './motion';
import { AtlasText, Card, CardHeader, ProgressBar } from './primitives';

export function CalificacionCard({ progress, onPress }: { progress: Progress; onPress?: () => void }) {
  const valor = calificacionDe(progress);
  const frase = fraseDeCalificacion(valor);
  const cuerpo = (
    <>
      <CardHeader icon="grafico" eyebrow="Qué tan buen pagador eres" title="Tu calificación" divider={false} />
      <View style={styles.cifra}>
        <AtlasText variant="amount">{String(valor)}</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          de 100
        </AtlasText>
      </View>
      <ProgressBar value={valor} label={`Calificación ${valor} de 100`} />
      <AtlasText variant="caption" tone="secondary">
        {frase}
      </AtlasText>
    </>
  );

  if (!onPress) return <Card testID="calificacion-card">{cuerpo}</Card>;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tu calificación: ${valor} de 100. ${frase} Toca para ver de dónde sale.`}
      testID="calificacion-card"
    >
      <Card>{cuerpo}</Card>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});
