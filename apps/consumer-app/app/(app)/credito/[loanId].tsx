/**
 * Las cuotas de un credito.
 *
 * Tercer y ultimo nivel: aqui se ve cada cuota con su fecha, su importe y su estado. Lo VENCIDO en
 * rojo y lo que vence pronto en ambar; lo pagado se apaga, porque ya no pide nada.
 *
 * La traza al motor se muestra al final. No es adorno: es la respuesta a «por que me dieron este
 * credito», y tenerla a mano en la app evita que la unica forma de saberlo sea llamar a soporte.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as loansApi from '../../../src/api/endpoints/loans';
import { categoryLook, dueCopy, formatAmount } from '../../../src/features/spending-copy';
import { color, space } from '../../../src/theme/tokens';
import { Icon } from '../../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Card, Divider, ErrorState, ListRow, Skeleton } from '../../../src/ui/primitives';

/** Lo que queda por pagar de una cuota: lo pactado menos lo cobrado, sin dejar negativos. */
function pendingOf(installment: loansApi.LoanInstallment): number {
  const owed =
    Number(installment.principalAmount) + Number(installment.interestAmount) + Number(installment.lateFeeAmount);
  const paid = Number(installment.paidPrincipal) + Number(installment.paidInterest) + Number(installment.paidLateFee);
  return Math.max(0, owed - paid);
}

export default function LoanDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId: string }>();
  const [loan, setLoan] = useState<loansApi.LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.loanId) return;
    let cancelled = false;
    loansApi
      .getLoan(params.loanId)
      .then((value) => {
        if (!cancelled) setLoan(value);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar este crédito.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.loanId]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Crédito" onBack="auto" />
        <ErrorState title="Crédito no disponible" detail={error} />
      </Screen>
    );
  }

  if (!loan) {
    return (
      <Screen>
        <ScreenHeader title="Crédito" onBack="auto" />
        <Card>
          <Skeleton height={18} width="50%" />
          <Skeleton height={32} width="70%" />
        </Card>
      </Screen>
    );
  }

  const look = categoryLook(loan.merchant?.businessCategory ?? 'sin_comercio');
  const today = new Date().toISOString().slice(0, 10);

  /*
   * El estado del credito se deduce del CALENDARIO, no de `loan.daysPastDue`.
   *
   * Ese contador lo actualiza un barrido periodico y puede ir por detras: en la propia demo, un
   * credito con dos cuotas vencidas seguia declarandose «al dia». Una insignia que contradice a la
   * lista que tiene debajo destruye la confianza en las dos.
   */
  const overdueInstallments = loan.schedule.filter(
    (installment) => installment.status !== 'paid' && installment.status !== 'written_off' && installment.dueDate < today && pendingOf(installment) > 0,
  );
  const worstOverdueDays = overdueInstallments.reduce((worst, installment) => {
    const days = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${installment.dueDate}T00:00:00`)) / 86_400_000);
    return Math.max(worst, days);
  }, 0);

  return (
    <Screen>
      <ScreenHeader
        title={formatAmount(Number(loan.principalAmount), loan.currencyCode)}
        subtitle={`${loan.merchant?.displayName ?? 'Compra sin comercio'} · ${look.label}`}
        onBack="auto"
        leading={
          <View style={styles.icon}>
            <Icon name={look.icon} size={24} tint={color.action.primary} />
          </View>
        }
      />

      <Card>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <AtlasText variant="caption" tone="tertiary">
              POR PAGAR
            </AtlasText>
            <AtlasText variant="amountSmall">{formatAmount(Number(loan.outstandingPrincipal), loan.currencyCode)}</AtlasText>
          </View>
          <View style={styles.summaryItem}>
            <AtlasText variant="caption" tone="tertiary">
              PLAZO
            </AtlasText>
            <AtlasText variant="amountSmall">{loan.termMonths} m</AtlasText>
          </View>
        </View>
        {overdueInstallments.length > 0 ? (
          <Badge label={`${worstOverdueDays} días de atraso`} tone="danger" />
        ) : loan.status === 'paid_off' ? (
          <Badge label="Pagado" tone="success" />
        ) : (
          <Badge label="Al día" tone="success" />
        )}
      </Card>

      <Card>
        <View style={styles.rowCenter}>
          <Icon name="pagos" size={18} tint={color.text.secondary} />
          <AtlasText variant="h3">Cuotas</AtlasText>
        </View>
        {loan.schedule.map((installment, index) => {
          const pending = pendingOf(installment);
          const settled = installment.status === 'paid' || pending === 0;
          const overdue = !settled && installment.dueDate < today;

          return (
            <View key={installment.installmentNumber}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                title={`Cuota ${installment.installmentNumber}`}
                subtitle={settled ? 'Pagada' : dueCopy(installment.dueDate)}
                icon={settled ? 'check' : overdue ? 'alerta' : 'reloj'}
                onPress={() => router.push(`/(app)/cuota/${loan.loanId}/${installment.installmentNumber}`)}
                accessibilityHint="Abrir el detalle de esta cuota"
                right={
                  <AtlasText
                    variant="bodyStrong"
                    style={{
                      color: settled ? color.text.tertiary : overdue ? color.feedback.danger : color.feedback.warning,
                    }}
                  >
                    {formatAmount(settled ? 0 : pending, loan.currencyCode)}
                  </AtlasText>
                }
              />
            </View>
          );
        })}
      </Card>

      {loan.decision.executionId ? (
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="ayuda" size={18} tint={color.action.primary} />
            <AtlasText variant="h3">¿Cómo se decidió?</AtlasText>
          </View>
          <AtlasText variant="caption" tone="secondary">
            Este crédito lo aprobó el motor de decisión de Atlas. Ejecución {loan.decision.executionId}
            {loan.decision.artifactVersionId ? ` · política ${loan.decision.artifactVersionId}` : ''}.
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  summary: { flexDirection: 'row', gap: space.xl },
  summaryItem: { gap: space.xxs },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
});
