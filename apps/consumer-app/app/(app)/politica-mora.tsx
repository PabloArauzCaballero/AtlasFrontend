/**
 * La politica de mora e intereses, tal y como esta publicada.
 *
 * El texto NO vive en esta pantalla: llega del backend con su version y su fecha de vigencia. Es la
 * promesa que se le opone al cliente cuando reclama, y una promesa que cambia con cada publicacion
 * de la app no se puede fechar ni auditar.
 *
 * ## Se dice de donde sale cada regla
 *
 * La respuesta trae `source.kind`: `regulatorio` o `atlas`. Presentar como ley lo que es politica de
 * la casa engaña aunque sea sin querer, y quien lee esto tiene derecho a saber a que puede apelar y
 * que puede negociar.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDelinquencyPolicy } from '../../src/features/use-credit-book';
import { color, radius, space } from '../../src/theme/tokens';
import { Icon } from '../../src/ui/icons';
import { Gap, Screen } from '../../src/ui/layout';
import { AtlasText, Badge, Card, Divider, ErrorState, Skeleton } from '../../src/ui/primitives';

/**
 * Un markdown minimo: encabezados `##`, negritas `**` y parrafos.
 *
 * No entra una libreria de markdown por dos lineas de formato: pesaria mas que el texto que
 * renderiza y traeria su propia tipografia, que es justo lo que el sistema de diseno evita.
 */
function renderBody(markdown: string) {
  return markdown.split('\n\n').map((block, index) => {
    const trimmed = block.trim();
    if (trimmed.length === 0) return null;

    if (trimmed.startsWith('## ')) {
      return (
        <AtlasText key={index} variant="h3" style={styles.heading}>
          {trimmed.slice(3)}
        </AtlasText>
      );
    }

    // Las negritas se marcan quitando los asteriscos: el enfasis lo da el peso de la primera frase.
    const plain = trimmed.replace(/\n/g, ' ').replace(/\*\*/g, '');
    return (
      <AtlasText key={index} variant="body" tone="secondary" style={styles.paragraph}>
        {plain}
      </AtlasText>
    );
  });
}

const TONE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  ok: 'success',
  info: 'info',
  warn: 'warning',
  danger: 'danger',
};

function stageRange(from: number | null, to: number | null): string {
  if (from === null && to !== null) return `Hasta ${to} dias`;
  if (from !== null && to === null) return `Desde ${from} dias`;
  if (from !== null && to !== null) return from === to ? `Dia ${from}` : `Dias ${from} a ${to}`;
  return 'Sin plazo';
}

export default function DelinquencyPolicyScreen() {
  const { policy, error } = useDelinquencyPolicy(true);
  const body = useMemo(() => (policy ? renderBody(policy.bodyMarkdown) : null), [policy]);

  if (error) {
    return (
      <Screen>
        <Gap size="lg" />
        <ErrorState title="No pudimos cargar la politica" detail={error} />
      </Screen>
    );
  }

  if (!policy) {
    return (
      <Screen>
        <Gap size="lg" />
        <Card>
          <Skeleton height={20} width="60%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="90%" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Gap size="sm" />
      <AtlasText variant="h1">{policy.title}</AtlasText>
      <View style={styles.metaRow}>
        <Badge label={`Version ${policy.versionCode}`} tone="neutral" />
        <Badge label={policy.source.kind === 'regulatorio' ? 'Normativa' : 'Politica de Atlas'} tone="info" />
      </View>
      <AtlasText variant="caption" tone="tertiary">
        Vigente desde {new Date(`${policy.effectiveFrom}T00:00:00`).toLocaleDateString('es-BO')}
      </AtlasText>

      <Card>
        <AtlasText variant="bodyStrong">{policy.summary}</AtlasText>
      </Card>

      <Card>{body}</Card>

      <Card>
        <View style={styles.rowCenter}>
          <Icon name="reloj" size={18} tint={color.text.secondary} />
          <AtlasText variant="h3">Que pasa segun los dias de atraso</AtlasText>
        </View>
        {policy.stages.map((stage, index) => (
          <View key={stage.code}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.stage}>
              <View style={styles.stageHead}>
                <AtlasText variant="bodyStrong">{stage.label}</AtlasText>
                <Badge label={stageRange(stage.fromDay, stage.toDay)} tone={TONE_BADGE[stage.tone] ?? 'neutral'} />
              </View>
              <AtlasText variant="caption" tone="secondary">
                {stage.detail}
              </AtlasText>
            </View>
          </View>
        ))}
      </Card>

      {policy.source.reference ? (
        <View style={styles.sourceBox}>
          <AtlasText variant="caption" tone="tertiary">
            Fuente
          </AtlasText>
          <AtlasText variant="caption" tone="secondary">
            {policy.source.reference}
          </AtlasText>
        </View>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heading: { marginTop: space.sm },
  paragraph: { marginTop: space.xxs },
  stage: { gap: space.xxs, paddingVertical: space.xs },
  stageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  sourceBox: {
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface.raisedStrong,
  },
});
