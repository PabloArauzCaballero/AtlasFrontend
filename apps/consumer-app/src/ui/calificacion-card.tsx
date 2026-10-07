/**
 * La Calificación de la persona: de 1 a 100, qué tan buen pagador es (pedido de Pablo, 2026-10-06).
 *
 * Es una pieza aparte del Puntaje a propósito. El Puntaje son puntos que se GANAN pagando y sólo suben; la
 * Calificación es un juicio sobre cómo paga y puede bajar. Ponerlos en la misma tarjeta hacía que «tengo 1.200
 * puntos» y «califico 38» se leyeran como el mismo número.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { calificacionDe, fraseDeCalificacion } from '../features/calificacion';
import { space } from '../theme/tokens';
import { BotonInfo, InfoSheet } from './help-sheet';
import { PressSurface } from './motion';
import { AtlasText, Card, CardHeader } from './primitives';
import { BarraViva, CuentaArriba, useAvance } from './cuenta-arriba';
import { PuntajeDesglose } from './puntaje-desglose';

/**
 * Con `masInfo`, la tarjeta lleva un botón «Más info» que abre la cuenta parte por parte en una hoja. Así la portada
 * enseña el número y su frase, y la explicación larga sólo aparece si alguien la pide (Pablo, 2026-10-06).
 */
export function CalificacionCard({ progress, onPress, masInfo = false }: { progress: Progress; onPress?: () => void; masInfo?: boolean }) {
  const [info, setInfo] = useState(false);
  const valor = calificacionDe(progress);
  const frase = fraseDeCalificacion(valor);
  if (masInfo) {
    return (
      <Card testID="calificacion-card">
        <Cuerpo valor={valor} frase={frase} info={<BotonInfo etiqueta="cómo se calcula tu calificación" onPress={() => setInfo(true)} testID="calificacion-mas-info" />} />
        <InfoSheet visible={info} titulo="Cómo se calcula tu calificación" onClose={() => setInfo(false)} testID="calificacion-info">
          <PuntajeDesglose progress={progress} titulo="Parte por parte" plano />
        </InfoSheet>
      </Card>
    );
  }
  const cuerpo = <Cuerpo valor={valor} frase={frase} />;

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

function Cuerpo({ valor, frase, info }: { valor: number; frase: string; info?: React.ReactNode }) {
  const avance = useAvance(true);
  return (
    <>
      <CardHeader icon="grafico" eyebrow="Qué tan buen pagador eres" title="Tu calificación" trailing={info} divider={false} />
      <View style={styles.cifra}>
        <CuentaArriba avance={avance} hasta={valor} formato={(n) => String(Math.round(n))} tamano="amount" />
        <AtlasText variant="caption" tone="secondary">
          de 100
        </AtlasText>
      </View>
      <BarraViva value={valor} label={`Calificación ${valor} de 100`} />
      <AtlasText variant="caption" tone="secondary">
        {frase}
      </AtlasText>
    </>
  );
}

const styles = StyleSheet.create({
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});
