/**
 * «De dónde salió cada dato de tu línea», con un color por origen.
 *
 * Verde lo que declaró la persona, azul lo que calculó Atlas y ámbar lo que falta: el color responde de reojo a
 * «¿esto lo puse yo?» antes de leer una sola palabra. Se agrupa por origen y no en el orden del Motor, porque quien
 * mira busca «qué me falta» y en una lista de sesenta filas mezcladas eso no se encuentra.
 */
import { StyleSheet, View } from 'react-native';
import { agruparPorOrigen, ORIGENES } from '../features/variables-del-motor';
import { space } from '../theme/tokens';
import { AtlasText, Badge, Card, CardHeader, Divider } from './primitives';

export function OrigenDeDatosCard({ inputs }: { inputs: Record<string, string> }) {
  const grupos = agruparPorOrigen(inputs);
  if (grupos.length === 0) return null;

  return (
    <Card>
      <CardHeader icon="grafico" title="De dónde salió cada dato de tu línea" divider={false} />

      {/* El resumen: tres colores, tres cifras. */}
      <View style={styles.resumen}>
        {grupos.map(({ origen, filas }) => (
          <Badge key={origen} dot tone={ORIGENES[origen].tono} label={`${ORIGENES[origen].resumen} ${filas.length}`} />
        ))}
      </View>

      {grupos.map(({ origen, filas }) => (
        <View key={origen} style={styles.grupo}>
          <Divider />
          {filas.map((fila) => (
            <View key={fila.codigo} style={styles.fila}>
              <AtlasText variant="caption" tone="secondary" style={styles.etiqueta}>
                {fila.etiqueta}
              </AtlasText>
              <Badge dot tone={ORIGENES[origen].tono} label={ORIGENES[origen].titulo} />
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  grupo: { gap: space.xs },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingVertical: 2 },
  etiqueta: { flex: 1 },
});
