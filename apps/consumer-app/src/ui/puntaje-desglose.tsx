/**
 * La calificación de la persona, desglosada: cada parte con su valor, su peso, los puntos que aporta y por qué.
 *
 * Es la respuesta a «¿por qué tengo este puntaje?». Estaba sólo en la pestaña «Puntaje» de «Tu nivel Atlas»; la
 * portada enseñaba el número y había que ir a buscar la cuenta. Ahora es una pieza y la portada la trae entera,
 * debajo de los puntos: un número sin su cuenta es un veredicto.
 *
 * Los `points` de las partes suman `rawScore`; si un tope recortó el resultado, se dice cuál y por qué.
 */
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { cuentaDeUnaParte, fraseDelResultado } from '../features/puntaje-explicado';
import { color, space } from '../theme/tokens';
import { Icon } from './icons';
import { AtlasText, Button, Card, CardHeader, Divider, ProgressBar } from './primitives';

export function PuntajeDesglose({
  progress,
  titulo = 'Por qué tienes esta calificación',
  onVerMas,
}: {
  progress: Progress;
  titulo?: string;
  /** Sólo donde hay más que ver: en «Tu nivel Atlas» ya se está ahí y no se pinta el botón. */
  onVerMas?: () => void;
}) {
  return (
    <Card testID="por-que-puntaje">
      <CardHeader icon="grafico" title={titulo} detail="La cuenta de tu calificación de 1 a 100, parte por parte, con tus datos." divider={false} />
      {progress.components.map((componente) => (
        <View key={componente.code} style={styles.componente}>
          {/* El nombre y la cuenta van en una fila que se PARTE si no cabe: antes la cuenta se salía de la pantalla. */}
          <View style={styles.titulo}>
            <AtlasText variant="bodyStrong" style={styles.nombre}>
              {componente.label}
            </AtlasText>
            <AtlasText variant="caption" tone="brand">
              {cuentaDeUnaParte(componente)}
            </AtlasText>
          </View>
          <ProgressBar value={componente.value} label={`${componente.label}: ${componente.value} de 100`} />
          <AtlasText variant="caption" tone="secondary">
            {componente.why}
          </AtlasText>
        </View>
      ))}
      <Divider />
      <AtlasText variant="bodyStrong">{fraseDelResultado(progress)}</AtlasText>
      {progress.caps.map((tope) => (
        <View key={tope.code} style={styles.tope} accessibilityLabel={`Tope. ${tope.detail}`}>
          <Icon name="info" size={18} tint={color.feedback.warning} />
          <AtlasText variant="caption" tone="secondary" style={styles.texto}>
            {tope.detail}
          </AtlasText>
        </View>
      ))}
      {onVerMas ? <Button label="Ver cómo subir de nivel" variant="ghost" onPress={onVerMas} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  componente: { gap: space.xs, paddingTop: space.sm },
  // `flexWrap` y `flexShrink`: si el nombre y la cuenta no caben juntos, la cuenta baja a la línea de abajo en vez de salirse.
  titulo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space.sm, rowGap: 2 },
  nombre: { flexShrink: 1 },
  tope: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.xs },
  texto: { flex: 1, gap: 2 },
});
