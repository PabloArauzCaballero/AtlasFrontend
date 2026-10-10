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
import { View } from 'react-native';
import * as loansApi from '../../../src/api/endpoints/loans';
import { categoryLook, dueCopy, formatAmount } from '../../../src/features/spending-copy';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { useAlVolver, useTirarParaRecargar } from '../../../src/features/al-volver';
import { useLoanDetail } from '../../../src/features/use-credit-book';
import {
  AtlasText,
  Badge,
  Card,
  CardHeader,
  Divider,
  ErrorState,
  IconChip,
  ListRow,
  Skeleton,
  Stat,
  StatRow,
} from '../../../src/ui/primitives';
import { marca } from '../../../src/theme/tokens';

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
  const { loan, error, reload } = useLoanDetail(params.loanId, 'No pudimos cargar este crédito.');
  // Al volver (p. ej. tras avisar el pago de una cuota), tras una operación de dinero y cada minuto a la vista.
  useAlVolver(reload);
  const tirar = useTirarParaRecargar(reload);

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
          <Skeleton height={11} width="35%" />
          <Skeleton height={23} width="55%" />
          <Skeleton height={1} />
          <Skeleton height={40} />
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
    <Screen {...tirar}>
      <ScreenHeader
        title={formatAmount(Number(loan.principalAmount), loan.currencyCode)}
        subtitle={`${loan.merchant?.displayName ?? 'Compra sin comercio'} · ${look.label}`}
        onBack="auto"
        leading={<IconChip name={look.icon} size="lg" />}
      />

      <Card tone={overdueInstallments.length > 0 ? 'danger' : 'default'}>
        <StatRow>
          <Stat
            label="Por pagar"
            value={formatAmount(Number(loan.outstandingPrincipal), loan.currencyCode)}
            tone={overdueInstallments.length > 0 ? 'danger' : 'primary'}
          />
          {/* «meses», no «m»: la abreviatura ahorra cuatro letras y obliga a descifrarlas. */}
          <Stat label="Plazo" value={`${loan.termMonths} ${loan.termMonths === 1 ? 'mes' : 'meses'}`} />
        </StatRow>
        <Divider />
        {overdueInstallments.length > 0 ? (
          <Badge dot label={`${worstOverdueDays} días de atraso`} tone="danger" />
        ) : loan.status === 'paid_off' ? (
          <Badge dot label="Pagado" tone="success" />
        ) : (
          <Badge dot label="Al día" tone="success" />
        )}
      </Card>

      <Card padding="tight">
        <CardHeader
          icon="pagos"
          iconTone="neutral"
          title="Cuotas"
          trailing={<Badge label={`${loan.schedule.length}`} tone="neutral" />}
        />
        {loan.schedule.map((installment, index) => {
          const pending = pendingOf(installment);
          const settled = installment.status === 'paid' || pending === 0;
          const overdue = !settled && installment.dueDate < today;

          return (
            <View key={installment.installmentNumber}>
              {index > 0 ? <Divider inset /> : null}
              <ListRow
                title={`Cuota ${installment.installmentNumber}`}
                subtitle={settled ? 'Pagada' : dueCopy(installment.dueDate)}
                icon={settled ? 'check' : overdue ? 'alerta' : 'reloj'}
                onPress={() => router.push(`/(app)/cuota/${loan.loanId}/${installment.installmentNumber}`)}
                accessibilityHint="Abrir el detalle de esta cuota"
                right={
                  <AtlasText variant="amountMicro" tone={settled ? 'tertiary' : overdue ? 'danger' : 'warning'}>
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
          <CardHeader icon="ayuda" title="¿Cómo se decidió?" />
          <AtlasText variant="caption" tone="secondary">
            Este crédito lo aprobó el motor de decisión de {marca.nombre}. Ejecución {loan.decision.executionId}
            {loan.decision.artifactVersionId ? ` · política ${loan.decision.artifactVersionId}` : ''}.
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="lg" />
    </Screen>
  );
}


