/**
 * Las cuatro pestañas de «Tu nivel Atlas». Pablo (2026-10-06): la tarjeta va SEPARADA en dos, una para el puntaje por
 * cada compra pagada y otra para la calificación de qué tan buen pagador eres. Por eso no hay «Resumen» que mezcle las dos:
 *
 *  - Puntaje      → puntos por compra pagada a tiempo, el nivel que dan y la tarjeta Normal…Black
 *  - Calificación → 1-100, qué tan buen pagador eres, su cuenta y el índice del motor
 *  - Logros       → insignias y misiones
 *  - Historia     → la escalera de niveles (en puntos) y la evolución de la línea
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { CreditLine, Progress } from '../api/endpoints/credit-line';
import { space } from '../theme/tokens';
import { VitrinaDeLogros } from './vitrina-de-logros';
import { Gap } from './layout';
import { LineaDeNiveles } from './linea-de-niveles';
import { ListaDePasos } from './lista-de-pasos';
import { formatoPuntos, idDeEscalon, nivelPorPuntos } from '../features/nivel';
import { Appear } from './motion';
import { NivelCard } from './nivel-card';
import { AtlasText, Button, Card, Divider, EmptyState, SectionHeader } from './primitives';
import { CalificacionCard } from './calificacion-card';
import { CrecimientoCreditoCard } from './crecimiento-credito-card';
import { PuntajeDesglose } from './puntaje-desglose';
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

/**
 * **Puntaje** — los puntos que se ganan con cada compra PAGADA a tiempo, el nivel que dan y la tarjeta Normal…Black
 * que ese nivel desbloquea. Todo lo de esta pestaña sube pagando; nada aquí es la calificación.
 */
export function PestanaPuntaje({ progress }: { progress: Progress }) {
  return (
    <>
      <Appear index={0}>
        <TarjetaSeccion progress={progress} />
      </Appear>
      <Appear index={1}>
        <NivelCard progress={progress} />
      </Appear>
    </>
  );
}

/**
 * **Calificación** — de 1 a 100, qué tan buen pagador eres, con su cuenta parte por parte. El índice 0-1000 del
 * motor va aquí y con su nombre: no es un «puntaje» más.
 */
export function PestanaCalificacion({ progress, creditLine }: { progress: Progress; creditLine: CreditLine | null }) {
  return (
    <>
      <Appear index={0}>
        <CalificacionCard progress={progress} />
      </Appear>
      <Appear index={1}>
        <CrecimientoCreditoCard progress={progress} />
      </Appear>
      <Appear index={2}>
        <PuntajeDesglose progress={progress} />
      </Appear>
      <Appear index={3} style={styles.seccion}>
        <SectionHeader title="Lo que miró el motor para tu crédito" detail="Un índice de 0 a 1000, aparte de tu calificación." />
        {creditLine ? (
          <Card>
            <ScoringPanel line={creditLine} />
          </Card>
        ) : (
          <Card>
            <AtlasText variant="body" tone="secondary">
              Es un número aparte de tu calificación: lo calcula el motor de decisión de Atlas con una política de crédito publicada, usando tus
              datos declarados, tus pagos y, si la subes, la información de tu extracto bancario. Todavía no se calculó tu línea, por eso no aparece.
            </AtlasText>
          </Card>
        )}
      </Appear>
    </>
  );
}

/** ¿Qué he ganado y qué sigue? Las insignias, por colección, y las misiones. */
export function PestanaLogros({ progress }: { progress: Progress }) {
  return (
    <>
      <Appear index={0} style={styles.seccion}>
        <VitrinaDeLogros progress={progress} />
      </Appear>
      <Appear index={1} style={styles.seccion}>
        <SectionHeader title="Misiones" detail="Lo que sube tu calificación." />
        <ListaDePasos
          testID="misiones"
          porPagina={3}
          pasos={progress.missions.map((m) => ({
            clave: m.code,
            titulo: m.label,
            detalle: m.detail,
            derecha: m.points,
            hecho: m.done,
            etiqueta: `${m.label}. ${m.done ? 'Cumplida' : 'Pendiente'}. ${m.detail}`,
          }))}
        />
        <AtlasText variant="caption" tone="tertiary" style={styles.nota}>
          Pedir más crédito no sube tu calificación ni tus puntos: subes cuando cumples, no cuando te endeudas.
        </AtlasText>
      </Appear>
    </>
  );
}

/** ¿Cómo he cambiado? La escalera de niveles y la evolución de la línea. */
export function PestanaHistoria({ progress }: { progress: Progress }) {
  const router = useRouter();
  const { level, levelLadder } = nivelPorPuntos(progress);
  return (
    <>
      <Appear index={0} style={styles.seccion}>
        <SectionHeader title="Los niveles" detail="Se suben con los puntos que ganas pagando a tiempo." />
        <LineaDeNiveles
          testID="niveles"
          // De «Nuevo» (arriba) al nivel más alto (abajo): Pablo, 2026-10-08.
          pasos={levelLadder.map((e) => {
            const actual = idDeEscalon(e) === idDeEscalon(level);
            return {
              clave: idDeEscalon(e),
              titulo: `${e.label}${actual ? ' · estás aquí' : ''}`,
              derecha: `desde ${formatoPuntos(e.from)} puntos`,
              hecho: e.reached,
              actual,
              etiqueta: `${e.label}, desde ${formatoPuntos(e.from)} puntos. ${e.reached ? 'Alcanzado' : 'Por alcanzar'}`,
            };
          })}
        />
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
                  {`${MOTIVO[version.trigger] ?? version.trigger}${version.relationshipScore !== null ? ` · calificación ${version.relationshipScore}` : ''}`}
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  texto: { flex: 1, gap: 2 },
  nota: { paddingHorizontal: space.xs, paddingTop: space.sm },
  derecha: { alignItems: 'flex-end' },
});
