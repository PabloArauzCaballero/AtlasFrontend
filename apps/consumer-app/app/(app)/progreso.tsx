/**
 * Tu nivel Atlas: dónde estás, de dónde salen tus puntos, qué hacer para subir y cómo has evolucionado.
 *
 * ## La idea
 *
 * El puntaje de crédito suele ser un número opaco que sube o baja sin explicación. Aquí es un camino con
 * escalones: se ve el nivel, cuánto falta para el siguiente, qué conductas dan puntos y cuáles ya se cumplieron.
 *
 * ## Dos reglas
 *
 * 1. Nada aquí premia endeudarse. Los puntos vienen de pagar a tiempo, verificarse, cumplir compras y la
 *    antigüedad; pedir más crédito no suma ninguno, y la pantalla lo dice.
 * 2. El nivel existe aunque la línea de crédito todavía no se haya calculado: no depende del motor, así que
 *    nadie ve una pantalla vacía que parezca un fallo.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { Progress } from '../../src/api/endpoints/credit-line';
import { cuentaDeUnaParte, fraseDeExperiencia, fraseDelResultado } from '../../src/features/puntaje-explicado';
import { useCreditBook } from '../../src/features/use-credit-book';
import { useProgress } from '../../src/features/use-progress';
import { useSession } from '../../src/session/session';
import { Icon } from '../../src/ui/icons';
import { Insignia } from '../../src/ui/insignia';
import { ScoringPanel } from '../../src/ui/scoring-panel';
import { TarjetaSeccion } from '../../src/ui/tarjeta-seccion';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { NivelCard } from '../../src/ui/nivel-card';
import { Appear, Vivo } from '../../src/ui/motion';
import { AtlasText, Button, Card, CardHeader, Divider, EmptyState, ErrorState, ProgressBar, SectionHeader, SkeletonLista } from '../../src/ui/primitives';
import { color, radius, space } from '../../src/theme/tokens';

const MOTIVO: Record<string, string> = {
  onboarding: 'Alta',
  bank_statement: 'Extracto bancario',
  delinquency: 'Atraso',
  repayment: 'Pago',
  manual: 'Revisión',
  application: 'Solicitud',
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO');

export default function Progreso() {
  const router = useRouter();
  const session = useSession();
  const { fase, progress, recargar } = useProgress(session.customerId);
  const book = useCreditBook(session.customerId);

  if (fase === 'cargando') {
    return (
      <Screen>
        <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />
        <SkeletonLista filas={4} alto={110} />
      </Screen>
    );
  }
  if (fase === 'fallo') {
    return (
      <Screen>
        <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />
        <ErrorState title="No pudimos cargar tu nivel" detail="Revisa tu conexión y vuelve a intentar." onRetry={() => void recargar()} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void recargar()}>
      <ScreenHeader title="Tu nivel Atlas" subtitle="Cómo subir y qué te falta." onBack="auto" />

      <Appear index={0}>
        <TarjetaSeccion progress={progress} />
      </Appear>

      <Appear index={1}>
        <NivelCard progress={progress} />
      </Appear>

      <Appear index={1}>
        <Card>
          <View style={styles.xpFila}>
            <Vivo tipo="late" periodo={1800}>
              <View style={styles.xpInsignia}>
                <Icon name="chispa" size={26} tint={color.action.primary} />
              </View>
            </Vivo>
            <View style={styles.misionTexto}>
              <AtlasText variant="overline" tone="secondary">
                EXPERIENCIA
              </AtlasText>
              <AtlasText variant="amount">{`${progress.experience.xp.toLocaleString('es-BO')} XP`}</AtlasText>
            </View>
            <View style={styles.derecha}>
              <AtlasText variant="bodyStrong">{`Racha ${progress.experience.currentStreak}`}</AtlasText>
              <AtlasText variant="caption" tone="secondary">{`mejor: ${progress.experience.bestStreak}`}</AtlasText>
            </View>
          </View>
          <AtlasText variant="caption" tone="secondary">
            {fraseDeExperiencia(progress.experience.xp)}
          </AtlasText>
        </Card>
      </Appear>

      <Appear index={2}>
        <SectionHeader
          title="Insignias"
          detail={`${progress.experience.badges.filter((b) => b.earned).length} de ${progress.experience.badges.length} ganadas`}
        />
        <Card>
          <View style={styles.rejilla} testID="insignias">
            {progress.experience.badges.map((insignia, indice) => (
              <Insignia key={insignia.code} insignia={insignia} indice={indice} />
            ))}
          </View>
        </Card>
      </Appear>

      <Appear index={3}>
        <Card testID="por-que-puntaje">
          <CardHeader
            icon="grafico"
            title="Por qué tienes este puntaje"
            detail="Esta es la cuenta de tu nivel, parte por parte, con tus datos."
            divider={false}
          />
          {progress.components.map((componente) => (
            <View key={componente.code} style={styles.componente}>
              <View style={styles.componenteTitulo}>
                <AtlasText variant="bodyStrong">{componente.label}</AtlasText>
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
              <AtlasText variant="caption" tone="secondary" style={styles.misionTexto}>
                {tope.detail}
              </AtlasText>
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={4}>
        <SectionHeader title="Tu puntaje Atlas de 0 a 1000" detail="El que decide cuánto puedes gastar." />
        {book.creditLine ? (
          <Card>
            <ScoringPanel line={book.creditLine} />
          </Card>
        ) : (
          <Card>
            <AtlasText variant="body" tone="secondary">
              Es un número aparte de tu nivel: lo calcula el motor de decisión de Atlas con una política de crédito publicada, usando tus datos
              declarados, tus pagos y, si la subes, la información de tu extracto bancario. Todavía no se calculó tu línea, por eso no aparece.
            </AtlasText>
            <AtlasText variant="caption" tone="secondary">
              Cuando se calcule verás aquí tu puntaje, en qué tramo estás, qué datos pesaron y cómo subirlo.
            </AtlasText>
          </Card>
        )}
      </Appear>

      <Appear index={5}>
        <SectionHeader title="Misiones" detail="Lo que te hace subir de nivel." />
        <Card padding="none">
          {progress.missions.map((mision, indice) => (
            <View key={mision.code}>
              {indice > 0 ? <Divider inset /> : null}
              <View style={styles.mision} accessibilityLabel={`${mision.label}. ${mision.done ? 'Cumplida' : 'Pendiente'}. ${mision.detail}`}>
                <View style={[styles.marca, mision.done && styles.marcaHecha]}>
                  {mision.done ? <Icon name="check" size={16} tint={color.text.onBrand} /> : null}
                </View>
                <View style={styles.misionTexto}>
                  <AtlasText variant="bodyStrong" tone={mision.done ? 'secondary' : 'primary'}>
                    {mision.label}
                  </AtlasText>
                  <AtlasText variant="caption" tone="secondary">
                    {mision.detail}
                  </AtlasText>
                </View>
                <AtlasText variant="caption" tone={mision.done ? 'brand' : 'tertiary'}>
                  {mision.points}
                </AtlasText>
              </View>
            </View>
          ))}
        </Card>
        <AtlasText variant="caption" tone="tertiary" style={styles.nota}>
          Pedir más crédito no suma puntos: tu nivel sube cuando cumples, no cuando te endeudas.
        </AtlasText>
      </Appear>

      <Appear index={6}>
        <SectionHeader title="Los niveles" detail="Cada uno amplía hasta cuánto puede crecer tu límite." />
        <Card padding="none">
          {[...progress.ladder].reverse().map((escalon, indice) => (
            <View key={escalon.code}>
              {indice > 0 ? <Divider inset /> : null}
              <View style={styles.escalon} accessibilityLabel={`${escalon.label}, desde ${escalon.from} puntos. ${escalon.reached ? 'Alcanzado' : 'Por alcanzar'}`}>
                <View style={[styles.marca, escalon.reached && styles.marcaHecha]}>
                  {escalon.reached ? <Icon name="check" size={16} tint={color.text.onBrand} /> : null}
                </View>
                <View style={styles.misionTexto}>
                  <AtlasText variant="bodyStrong" tone={escalon.code === progress.tier.code ? 'brand' : 'primary'}>
                    {escalon.label}
                    {escalon.code === progress.tier.code ? ' · estás aquí' : ''}
                  </AtlasText>
                </View>
                <AtlasText variant="caption" tone="secondary">{`desde ${escalon.from} pts`}</AtlasText>
              </View>
            </View>
          ))}
        </Card>
      </Appear>

      <Appear index={7}>
        <SectionHeader title="Tu evolución" detail="Cómo ha cambiado tu línea con el tiempo." />
        {progress.history.length === 0 ? (
          <EmptyState
            icon="tendencia"
            title="Tu historia empieza aquí"
            detail={
              progress.hasCreditLine
                ? 'Cuando se recalcule tu línea, verás aquí cómo cambió.'
                : 'Todavía no hay una línea calculada. Cuando la haya, verás aquí cómo cambia con cada pago.'
            }
          />
        ) : (
          <EvolucionDeLinea history={progress.history} />
        )}
      </Appear>

      {!progress.hasCreditLine ? (
        <>
          <Gap />
          <Button label="Subir mi extracto bancario" icon="documento" variant="secondary" onPress={() => router.push('/(app)/extracto-bancario')} />
        </>
      ) : null}
    </Screen>
  );
}

/** Las versiones de la línea, de la más reciente a la más antigua, con cuánto cambió cada una. */
function EvolucionDeLinea({ history }: { history: Progress['history'] }) {
  return (
    <Card padding="none">
      {history.map((version, indice) => {
        const anterior = history[indice + 1];
        const delta = anterior ? version.approvedLimit - anterior.approvedLimit : null;
        return (
          <View key={`${version.validFrom}-${indice}`}>
            {indice > 0 ? <Divider inset /> : null}
            <View style={styles.version}>
              <View style={styles.misionTexto}>
                <AtlasText variant="bodyStrong">{fecha(version.validFrom)}</AtlasText>
                <AtlasText variant="caption" tone="secondary">
                  {`${MOTIVO[version.trigger] ?? version.trigger}${version.relationshipScore !== null ? ` · ${version.relationshipScore} pts de nivel` : ''}`}
                </AtlasText>
              </View>
              <View style={styles.derecha}>
                <AtlasText variant="bodyStrong">{`Bs ${version.approvedLimit.toLocaleString('es-BO')}`}</AtlasText>
                {delta !== null && delta !== 0 ? (
                  <AtlasText variant="caption" tone={delta > 0 ? 'success' : 'danger'}>
                    {`${delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toLocaleString('es-BO')}`}
                  </AtlasText>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  componente: { gap: space.xs, paddingTop: space.sm },
  xpFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  xpInsignia: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: color.feedbackSoft.success },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  tope: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.xs },
  componenteTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  mision: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  escalon: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  misionTexto: { flex: 1, gap: 2 },
  marca: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border.strong, alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  nota: { paddingHorizontal: space.xs, paddingTop: space.sm },
  version: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  derecha: { alignItems: 'flex-end' },
});
