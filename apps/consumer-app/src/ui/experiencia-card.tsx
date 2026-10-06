/**
 * Los puntos XP de la persona: cuántos tiene, de dónde salen y su racha.
 *
 * Vivía sólo dentro de «Tu nivel Atlas», a dos toques de la portada, así que casi nadie sabía que tenía
 * puntos. Ahora es una pieza: Inicio la enseña justo debajo de la línea de crédito y «Tu nivel Atlas» la
 * sigue enseñando igual, las dos con el mismo número.
 *
 * Los puntos se ganan PAGANDO a tiempo las compras, no comprando: 1 por cada boliviano pagado en fecha.
 * La tarjeta lo dice con esas palabras porque «puntos por compras» a secas invita a comprar más para
 * subir, y eso es justo lo que este programa no premia.
 */
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { fraseDeExperiencia } from '../features/puntaje-explicado';
import { color, space } from '../theme/tokens';
import { Icon } from './icons';
import { PressSurface, Vivo } from './motion';
import { AtlasText, Card } from './primitives';

export function ExperienciaCard({ progress, onPress }: { progress: Progress; onPress?: () => void }) {
  const { xp, currentStreak, bestStreak } = progress.experience;
  const puntos = `${xp.toLocaleString('es-BO')} puntos`;
  const cuerpo = (
    <>
      <View style={styles.fila}>
        <Vivo tipo="late" periodo={1800}>
          <View style={styles.insignia}>
            <Icon name="chispa" size={26} tint={color.action.primary} />
          </View>
        </Vivo>
        <View style={styles.texto}>
          <AtlasText variant="overline" tone="secondary">
            TU PUNTAJE
          </AtlasText>
          <AtlasText variant="amount">{puntos}</AtlasText>
        </View>
        <View style={styles.derecha}>
          <AtlasText variant="bodyStrong">{`Racha ${currentStreak}`}</AtlasText>
          <AtlasText variant="caption" tone="secondary">{`mejor: ${bestStreak}`}</AtlasText>
        </View>
      </View>
      <AtlasText variant="caption" tone="secondary">
        {fraseDeExperiencia(xp)}
      </AtlasText>
    </>
  );

  if (!onPress) return <Card testID="experiencia-card">{cuerpo}</Card>;
  return (
    <PressSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tu puntaje: ${puntos}. Racha de ${currentStreak} pagos a tiempo. ${fraseDeExperiencia(xp)} Toca para ver tus insignias.`}
      testID="experiencia-card"
    >
      <Card>{cuerpo}</Card>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  insignia: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: color.feedbackSoft.success },
  texto: { flex: 1, gap: 2 },
  derecha: { alignItems: 'flex-end' },
});
