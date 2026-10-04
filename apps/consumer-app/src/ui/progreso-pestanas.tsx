/**
 * Las cuatro pestañas de «Tu nivel Atlas».
 *
 * La pantalla acumulaba ocho secciones en una sola columna y se sentía larga y cargada: para llegar a «Tu evolución» había
 * que pasar por la tarjeta, el nivel, la experiencia, las insignias, la cuenta del puntaje, el puntaje 0-1000, las misiones
 * y la escalera. Ahora cada pestaña responde UNA pregunta:
 *
 *  - Resumen  → «¿dónde estoy?»              tarjeta, nivel y experiencia
 *  - Puntaje  → «¿por qué tengo este puntaje?» la cuenta parte por parte y el puntaje 0-1000
 *  - Logros   → «¿qué he ganado y qué sigue?» insignias y misiones
 *  - Historia → «¿cómo he cambiado?»          la escalera de niveles y la evolución de la línea
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { CreditLine, Progress } from '../api/endpoints/credit-line';
import { cuentaDeUnaParte, fraseDeExperiencia, fraseDelResultado } from '../features/puntaje-explicado';
import { color, radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { Insignia } from './insignia';
import { Gap } from './layout';
import { Appear, Vivo } from './motion';
import { NivelCard } from './nivel-card';
import { AtlasText, Button, Card, CardHeader, Divider, EmptyState, ProgressBar, SectionHeader } from './primitives';
import { ScoringPanel } from './scoring-panel';
import { TarjetaSeccion } from './tarjeta-seccion';

const MOTIVO: Record<string, string> = {
  onboarding: 'Alta',
  bank_statement: 'Extracto bancario',
  delinquency: 'Atraso',
  repayment: 'Pago',
  manual: 'Revisión',
  application: 'Solicitud',
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO');

/** ¿Dónde estoy? La tarjeta, el nivel y la experiencia: lo primero que se quiere ver y nada más. */
export function PestanaResumen({ progress }: { progress: Progress }) {
  return (
    <>
      <Appear index={0}>
        <TarjetaSeccion progress={progress} />
      </Appear>
      <Appear index={1}>
        <NivelCard progress={progress} />
      </Appear>
      <Appear index={2}>
        <Card>
          <View style={styles.xpFila}>
            <Vivo tipo="late" periodo={1800}>
              <View style={styles.xpInsignia}>
                <Icon name="chispa" size={26} tint={color.action.primary} />
              </View>
            </Vivo>
            <View style={styles.texto}>
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
    </>
  );
}

/** ¿Por qué tengo este puntaje? La cuenta de esta persona, parte por parte, y el puntaje 0-1000 aparte. */
export function PestanaPuntaje({ progress, creditLine }: { progress: Progress; creditLine: CreditLine | null }) {
  return (
    <>
      <Appear index={0}>
        <Card testID="por-que-puntaje">
          <CardHeader icon="grafico" title="Por qué tienes este puntaje" detail="Esta es la cuenta de tu nivel, parte por parte, con tus datos." divider={false} />
          {progress.components.map((componente) => (
            <View key={componente.code} style={styles.componente}>
              {/* El nombre y la cuenta van en una fila que se PARTE si no cabe: antes la cuenta se salía de la pantalla. */}
              <View style={styles.componenteTitulo}>
                <AtlasText variant="bodyStrong" style={styles.componenteNombre}>
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
        </Card>
      </Appear>
      <Appear index={1} style={styles.seccion}>
        <SectionHeader title="Tu puntaje Atlas de 0 a 1000" detail="El que decide cuánto puedes gastar." />
        {creditLine ? (
          <Card>
            <ScoringPanel line={creditLine} />
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
    </>
  );
}

/** ¿Qué he ganado y qué sigue? Las insignias y las misiones. */
export function PestanaLogros({ progress }: { progress: Progress }) {
  const ganadas = progress.experience.badges.filter((b) => b.earned).length;
  return (
    <>
      <Appear index={0} style={styles.seccion}>
        <SectionHeader title="Insignias" detail={`${ganadas} de ${progress.experience.badges.length} ganadas`} />
        <Card>
          <View style={styles.rejilla} testID="insignias">
            {progress.experience.badges.map((insignia, indice) => (
              <Insignia key={insignia.code} insignia={insignia} indice={indice} />
            ))}
          </View>
        </Card>
      </Appear>
      <Appear index={1} style={styles.seccion}>
        <SectionHeader title="Misiones" detail="Lo que te hace subir de nivel." />
        <Card padding="none">
          {progress.missions.map((mision, indice) => (
            <View key={mision.code}>
              {indice > 0 ? <Divider inset /> : null}
              <View style={styles.fila} accessibilityLabel={`${mision.label}. ${mision.done ? 'Cumplida' : 'Pendiente'}. ${mision.detail}`}>
                <View style={[styles.marca, mision.done && styles.marcaHecha]}>
                  {mision.done ? <Icon name="check" size={16} tint={color.text.onBrand} /> : null}
                </View>
                <View style={styles.texto}>
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
    </>
  );
}

/** ¿Cómo he cambiado? La escalera de niveles y la evolución de la línea. */
export function PestanaHistoria({ progress }: { progress: Progress }) {
  const router = useRouter();
  return (
    <>
      <Appear index={0} style={styles.seccion}>
        <SectionHeader title="Los niveles" detail="Cada uno amplía hasta cuánto puede crecer tu límite." />
        <Card padding="none">
          {[...progress.ladder].reverse().map((escalon, indice) => (
            <View key={escalon.code}>
              {indice > 0 ? <Divider inset /> : null}
              <View style={styles.fila} accessibilityLabel={`${escalon.label}, desde ${escalon.from} puntos. ${escalon.reached ? 'Alcanzado' : 'Por alcanzar'}`}>
                <View style={[styles.marca, escalon.reached && styles.marcaHecha]}>
                  {escalon.reached ? <Icon name="check" size={16} tint={color.text.onBrand} /> : null}
                </View>
                <View style={styles.texto}>
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
      <Appear index={1} style={styles.seccion}>
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
    </>
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
            <View style={styles.fila}>
              <View style={styles.texto}>
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
  // El encabezado de sección y su tarjeta van en el mismo bloque: sin este `gap` la tarjeta pisaba el apunte del encabezado.
  seccion: { gap: space.sm },
  componente: { gap: space.xs, paddingTop: space.sm },
  xpFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  xpInsignia: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: color.feedbackSoft.success },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  tope: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingTop: space.xs },
  // `flexWrap` y `flexShrink`: si el nombre y la cuenta no caben juntos, la cuenta baja a la línea de abajo en vez de salirse.
  componenteTitulo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: space.sm, rowGap: 2 },
  componenteNombre: { flexShrink: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  texto: { flex: 1, gap: 2 },
  marca: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border.strong, alignItems: 'center', justifyContent: 'center' },
  marcaHecha: { backgroundColor: color.action.primary, borderColor: color.action.primary },
  nota: { paddingHorizontal: space.xs, paddingTop: space.sm },
  derecha: { alignItems: 'flex-end' },
});
