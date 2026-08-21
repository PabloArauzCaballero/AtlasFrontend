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
import { Appear } from '../../src/ui/motion';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Card, ErrorState, Skeleton } from '../../src/ui/primitives';

type PolicySection = { heading: string; paragraphs: string[] };

/**
 * El texto, partido en SECCIONES y no en parrafos sueltos.
 *
 * Antes se pintaba bloque a bloque: encabezado, parrafo, encabezado, parrafo… y el resultado era un
 * muro. La informacion ya venia estructurada en el markdown —cada `##` abre un tema— y no se estaba
 * usando esa estructura para nada visual.
 *
 * Agrupar cada tema con sus parrafos permite darle el mismo tratamiento que a los tramos de mora:
 * un bloque con su marca a la izquierda, que se puede saltar de un vistazo hasta encontrar el que
 * interesa. Nadie lee una politica entera; se busca dentro de ella.
 */
function parseSections(markdown: string): PolicySection[] {
  const sections: PolicySection[] = [];
  for (const block of markdown.split('\n\n')) {
    const trimmed = block.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.startsWith('## ')) {
      sections.push({ heading: trimmed.slice(3), paragraphs: [] });
      continue;
    }

    // Las negritas se marcan quitando los asteriscos: el enfasis lo da el peso de la primera frase.
    const plain = trimmed.replace(/\n/g, ' ').replace(/\*\*/g, '');
    if (sections.length === 0) sections.push({ heading: '', paragraphs: [] });
    sections[sections.length - 1]!.paragraphs.push(plain);
  }
  return sections;
}

/**
 * El color de cada tramo.
 *
 * Se usa en el punto del raíl y en el rango de días, no en un fondo: un bloque coloreado por tramo
 * convertiría la escalera en un semáforo de seis luces, y con seis luces ninguna destaca.
 */
const TONE_COLOR: Record<string, string> = {
  ok: color.feedback.success,
  info: color.feedback.info,
  warn: color.feedback.warning,
  danger: color.feedback.danger,
};

function stageRange(from: number | null, to: number | null): string {
  // «Sin atraso» y no «Al día»: el tramo ya se llama «Al día», y repetirlo dos veces en la misma
  // fila hace que el rango parezca un titulo duplicado en vez de un plazo.
  if (from === null && to !== null) return to === 0 ? 'Sin atraso' : `Hasta ${to} días`;
  if (from !== null && to === null) return `Desde el día ${from}`;
  if (from !== null && to !== null) return from === to ? `Día ${from}` : `Días ${from} a ${to}`;
  return 'Sin plazo';
}

export default function DelinquencyPolicyScreen() {
  const { policy, error } = useDelinquencyPolicy(true);
  const sections = useMemo(() => (policy ? parseSections(policy.bodyMarkdown) : []), [policy]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Política de mora" onBack="auto" />
        <ErrorState title="No pudimos cargar la política" detail={error} />
      </Screen>
    );
  }

  if (!policy) {
    return (
      <Screen>
        <ScreenHeader title="Política de mora" onBack="auto" />
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
      <ScreenHeader title={policy.title} onBack="auto" />
      <View style={styles.metaRow}>
        <Badge label={`Versión ${policy.versionCode}`} tone="neutral" />
        <Badge label={policy.source.kind === 'regulatorio' ? 'Normativa' : 'Política de Atlas'} tone="info" />
      </View>
      <AtlasText variant="caption" tone="tertiary">
        Vigente desde {new Date(`${policy.effectiveFrom}T00:00:00`).toLocaleDateString('es-BO')}
      </AtlasText>

      <Card>
        <AtlasText variant="bodyStrong">{policy.summary}</AtlasText>
      </Card>

      {/*
        Un bloque por tema, con su barra de color a la izquierda: el mismo lenguaje que la escalera
        de tramos. Una tarjeta unica con todo el texto dentro obliga a leerlo entero para encontrar
        una frase.
      */}
      {sections.map((section, index) => (
        /*
          Escalonadas: los temas llegan en el orden en que hay que leerlos. Sobre un texto largo el
          escalonado hace más que decorar — reparte la llegada y quita la sensacion de pared.
        */
        <Appear key={section.heading || index} index={index}>
        <View style={styles.section}>
          <View style={styles.sectionAccent} />
          <View style={styles.sectionBody}>
            {section.heading ? <AtlasText variant="h3">{section.heading}</AtlasText> : null}
            {section.paragraphs.map((paragraph, position) => (
              <AtlasText key={position} variant="body" tone="secondary" style={styles.paragraph}>
                {paragraph}
              </AtlasText>
            ))}
          </View>
        </View>
        </Appear>
      ))}

      <Card>
        <View style={styles.rowCenter}>
          <Icon name="reloj" size={18} tint={color.text.secondary} />
          <AtlasText variant="h3">Qué pasa según los días de atraso</AtlasText>
        </View>
        <AtlasText variant="caption" tone="tertiary">
          De arriba abajo, según pasan los días sin pagar.
        </AtlasText>

        {/*
          Una ESCALERA, no una lista.

          Los tramos no son opciones sueltas: son un recorrido en el tiempo, y cada uno es peor que
          el anterior. Una lista de filas iguales con una insignia a la derecha no dice eso —se lee
          como un menú—. El raíl vertical y el punto de color cuentan la progresión sin una sola
          palabra de más, que es justo lo que hace falta cuando alguien mira esto asustado.
        */}
        <View style={styles.timeline}>
          {policy.stages.map((stage, index) => {
            const tone = TONE_COLOR[stage.tone] ?? color.text.tertiary;
            const last = index === policy.stages.length - 1;
            return (
              <View key={stage.code} style={styles.stageRow}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { borderColor: tone, backgroundColor: tone }]} />
                  {/* El raíl no baja del último punto: si bajara, prometería un tramo que no existe. */}
                  {!last ? <View style={styles.railLine} /> : null}
                </View>

                <View style={styles.stageBody}>
                  <AtlasText variant="caption" style={{ color: tone, letterSpacing: 0.8 }}>
                    {stageRange(stage.fromDay, stage.toDay).toUpperCase()}
                  </AtlasText>
                  <AtlasText variant="bodyStrong">{stage.label}</AtlasText>
                  <AtlasText variant="caption" tone="secondary">
                    {stage.detail}
                  </AtlasText>
                </View>
              </View>
            );
          })}
        </View>
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
  section: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface.raised,
  },
  // La barra hereda el color de marca: marca el tema sin pintar el bloque entero.
  sectionAccent: { width: 3, borderRadius: 2, backgroundColor: color.action.primary },
  sectionBody: { flex: 1, gap: space.xs },
  paragraph: { lineHeight: 22 },
  timeline: { marginTop: space.xs },
  stageRow: { flexDirection: 'row', gap: space.md },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: 6 },
  railLine: { flex: 1, width: 2, backgroundColor: color.border.subtle, marginTop: 2 },
  stageBody: { flex: 1, gap: 2, paddingBottom: space.lg },
  sourceBox: {
    gap: space.xxs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface.raisedStrong,
  },
});
