/**
 * «Tu tarjeta Atlas» en la pantalla de nivel: la tarjeta grande, de dónde viene, y la escalera completa de tarjetas.
 *
 * La escalera enseña lo que viene: las tarjetas que todavía no se ganaron salen apagadas con candado y dicen con qué
 * nivel se desbloquean. Es la misma idea que la barra de experiencia: ver el siguiente escalón es lo que da ganas de
 * llegar. Y la frase de abajo lo aclara siempre: la tarjeta es estatus, no dinero.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Progress } from '../api/endpoints/credit-line';
import { AVISO_SIN_LIMITE, estaDesbloqueada, fraseDeOrigen, siguienteTarjeta } from '../features/tarjeta';
import { color, space } from '../theme/tokens';
import { Icon } from './icons';
import { TarjetaAtlas } from './tarjeta-atlas';
import { AtlasText, Card } from './primitives';

export function TarjetaSeccion({ progress }: { progress: Progress }) {
  const { card, tier, ladder } = progress;
  if (!card) return null;
  const siguiente = siguienteTarjeta(card, ladder);

  return (
    <Card testID="tarjeta-seccion">
      <TarjetaAtlas tier={card} testID="tarjeta-grande" />
      <View style={styles.texto}>
        <AtlasText variant="bodyStrong">{`Tu tarjeta ${card.label}`}</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          {card.description}
        </AtlasText>
        <AtlasText variant="caption" tone="secondary" testID="tarjeta-origen">
          {fraseDeOrigen(card, tier.label)}
        </AtlasText>
        {siguiente ? (
          <AtlasText variant="caption" tone="brand" testID="tarjeta-siguiente">
            {`Sigue la ${siguiente.tier.label}: se desbloquea al llegar al nivel ${siguiente.nivelLabel}.`}
          </AtlasText>
        ) : (
          <AtlasText variant="caption" tone="brand">
            Tienes la tarjeta más alta de Atlas.
          </AtlasText>
        )}
      </View>

      {card.benefits.length > 0 ? (
        <View style={styles.beneficios} testID="tarjeta-beneficios">
          {card.benefits.map((b) => (
            <View key={b.text} style={styles.beneficio}>
              <Icon name="check" size={16} tint={color.action.primary} />
              <AtlasText variant="caption" style={styles.beneficioTexto}>
                {b.text}
              </AtlasText>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.escalera} testID="tarjeta-escalera">
        {card.catalog.map((t) => (
          <View key={t.code} style={styles.escalon}>
            <TarjetaAtlas tier={t} tamano="mini" bloqueada={!estaDesbloqueada(t, card)} testID={`mini-${t.code}`} />
            <AtlasText variant="micro" tone={t.current ? 'brand' : 'tertiary'}>
              {t.current ? `${t.label} · tuya` : t.label}
            </AtlasText>
          </View>
        ))}
      </ScrollView>

      <AtlasText variant="caption" tone="tertiary" testID="tarjeta-aviso">
        {AVISO_SIN_LIMITE}
      </AtlasText>
    </Card>
  );
}

const styles = StyleSheet.create({
  texto: { gap: space.xs },
  beneficios: { gap: space.xs },
  beneficio: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  beneficioTexto: { flex: 1 },
  escalera: { gap: space.md, paddingVertical: space.xs },
  escalon: { alignItems: 'center', gap: space.xs },
});
