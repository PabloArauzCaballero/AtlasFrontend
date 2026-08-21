/**
 * El detalle de UNA cuota.
 *
 * ## Lo que estaba mal
 *
 * Las cuotas de la pantalla del credito se pintaban con `ListRow`, que dibuja una fila con su
 * flecha de «abrir» — pero sin `onPress`. Eran botones muertos: tenian el aspecto de llevar a algun
 * sitio y no llevaban a ninguno. Una fila que parece pulsable y no responde se lee como una app
 * rota, no como una app sin esa funcion.
 *
 * Existia `pago/[itemId]`, pero opera sobre el simulador local y no sabe nada de las cuotas reales
 * del backend; no se podia enlazar ahi sin enseñar datos de otro sitio.
 *
 * ## Que responde esta pantalla
 *
 * «¿Cuanto es, de que se compone y donde lo pago?». El desglose importa porque en una cuota vencida
 * la diferencia entre capital, interes y mora es justo lo que la persona viene a discutir, y verlo
 * sumado no deja discutir nada.
 *
 * El «donde» es siempre el mismo y por eso se dice aqui en vez de esconderlo en la ayuda: Atlas no
 * recibe el dinero, cada cuota se paga al QR bancario del comercio donde se compro.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as loansApi from '../../../../src/api/endpoints/loans';
import { categoryLook, dueCopy, formatAmount } from '../../../../src/features/spending-copy';
import { color, radius, space } from '../../../../src/theme/tokens';
import { Icon, type IconName } from '../../../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ErrorState, ListRow, Skeleton } from '../../../../src/ui/primitives';

type State = 'paid' | 'overdue' | 'upcoming';

const LOOK: Record<State, { label: string; tone: 'success' | 'danger' | 'warning'; tint: string; icon: IconName }> = {
  paid: { label: 'Pagada', tone: 'success', tint: color.feedback.success, icon: 'check' },
  overdue: { label: 'Vencida', tone: 'danger', tint: color.feedback.danger, icon: 'alerta' },
  upcoming: { label: 'Por vencer', tone: 'warning', tint: color.feedback.warning, icon: 'reloj' },
};

function amountOf(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InstallmentDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId: string; numero: string }>();
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
        if (!cancelled) setError('No pudimos cargar esta cuota.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.loanId]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Cuota" onBack="auto" />
        <ErrorState title="Cuota no disponible" detail={error} />
      </Screen>
    );
  }

  if (!loan) {
    return (
      <Screen>
        <ScreenHeader title="Cuota" onBack="auto" />
        <Card>
          <Skeleton height={18} width="40%" />
          <Skeleton height={32} width="60%" />
        </Card>
      </Screen>
    );
  }

  const number = Number(params.numero);
  const installment = loan.schedule.find((entry) => entry.installmentNumber === number) ?? null;

  if (!installment) {
    return (
      <Screen>
        <ScreenHeader title="Cuota" onBack="auto" />
        <ErrorState title="No encontramos esta cuota" detail="Vuelve al crédito y ábrela desde la lista." />
      </Screen>
    );
  }

  const owed =
    amountOf(installment.principalAmount) + amountOf(installment.interestAmount) + amountOf(installment.lateFeeAmount);
  const paid = amountOf(installment.paidPrincipal) + amountOf(installment.paidInterest) + amountOf(installment.paidLateFee);
  const pending = Math.max(0, owed - paid);

  /*
   * El estado se deduce del CALENDARIO, igual que en la pantalla del credito y que en el servidor.
   * `installment.status` lo mueve un barrido periodico y puede ir por detras; que esta pantalla y la
   * anterior discrepen sobre la misma cuota destruiria la confianza en las dos.
   */
  const today = new Date().toISOString().slice(0, 10);
  const state: State =
    installment.status === 'paid' || pending === 0 ? 'paid' : installment.dueDate < today ? 'overdue' : 'upcoming';
  const look = LOOK[state];
  const merchantLook = categoryLook(loan.merchant?.businessCategory ?? 'sin_comercio');

  return (
    <Screen>
      <ScreenHeader
        title={`Cuota ${installment.installmentNumber}`}
        subtitle={`${loan.merchant?.displayName ?? 'Compra sin comercio'} · ${merchantLook.label}`}
        onBack="auto"
        leading={
          <View style={[styles.icon, { backgroundColor: look.tint + '22' }]}>
            <Icon name={look.icon} size={24} tint={look.tint} />
          </View>
        }
      />

      <Card>
        <Badge label={look.label} tone={look.tone} />
        <AtlasText variant="amount" style={{ color: state === 'paid' ? color.text.primary : look.tint }}>
          {formatAmount(state === 'paid' ? owed : pending, loan.currencyCode)}
        </AtlasText>
        <AtlasText variant="body" tone="secondary">
          {state === 'paid' ? 'Ya está pagada.' : dueCopy(installment.dueDate)}
        </AtlasText>
        {state === 'overdue' ? (
          <AtlasText variant="caption" tone="secondary">
            El interés penal corre solo sobre el capital de esta cuota, nunca sobre el saldo total de tu crédito.
          </AtlasText>
        ) : null}
      </Card>

      {/*
        El desglose, siempre: es lo que permite entender por que una cuota vencida cuesta mas que la
        de al lado. Un unico total obliga a creerselo.
      */}
      <Card>
        <View style={styles.rowCenter}>
          <Icon name="lista" size={18} tint={color.text.secondary} />
          <AtlasText variant="h3">De qué se compone</AtlasText>
        </View>
        <Divider />
        <Breakdown label="Capital" value={amountOf(installment.principalAmount)} currency={loan.currencyCode} />
        <Breakdown label="Interés" value={amountOf(installment.interestAmount)} currency={loan.currencyCode} />
        {amountOf(installment.lateFeeAmount) > 0 ? (
          <Breakdown
            label="Interés penal por mora"
            value={amountOf(installment.lateFeeAmount)}
            currency={loan.currencyCode}
            tint={color.feedback.danger}
          />
        ) : null}
        <Divider />
        <Breakdown label="Total de la cuota" value={owed} currency={loan.currencyCode} strong />
        {paid > 0 ? <Breakdown label="Ya pagado" value={-paid} currency={loan.currencyCode} tint={color.feedback.success} /> : null}
        {pending > 0 ? <Breakdown label="Te falta pagar" value={pending} currency={loan.currencyCode} strong tint={look.tint} /> : null}
      </Card>

      {state !== 'paid' ? (
        <Card>
          <View style={styles.rowCenter}>
            <Icon name="ayuda" size={18} tint={color.action.primary} />
            <AtlasText variant="h3">¿Dónde la pago?</AtlasText>
          </View>
          <Divider />
          <AtlasText variant="body" tone="secondary">
            Al QR bancario de {loan.merchant?.displayName ?? 'el comercio donde compraste'}. Atlas nunca recibe tu dinero: cada
            cuota se paga al comercio, y él nos confirma el pago.
          </AtlasText>
          {loan.merchant ? (
            <Button
              label="Ver este comercio"
              variant="secondary"
              onPress={() => router.push(`/(app)/comercio/${loan.merchant!.partnerProfileId}`)}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <View style={styles.rowCenter}>
          <Icon name="pagos" size={18} tint={color.text.secondary} />
          <AtlasText variant="h3">El crédito completo</AtlasText>
        </View>
        <Divider />
        <ListRow
          title={formatAmount(amountOf(loan.principalAmount), loan.currencyCode)}
          subtitle={`${loan.schedule.length} ${loan.schedule.length === 1 ? 'cuota' : 'cuotas'} · ${loan.loanCode}`}
          icon={merchantLook.icon}
          onPress={() => router.push(`/(app)/credito/${loan.loanId}`)}
          accessibilityHint="Volver a las cuotas de este crédito"
        />
      </Card>

      <Gap size="lg" />
    </Screen>
  );
}

/** Una linea del desglose. Los importes se alinean a la derecha porque se leen comparandolos. */
function Breakdown({
  label,
  value,
  currency,
  strong = false,
  tint,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
  tint?: string;
}) {
  return (
    <View style={styles.breakdown}>
      <AtlasText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'primary' : 'secondary'} style={styles.flex}>
        {label}
      </AtlasText>
      <AtlasText variant={strong ? 'bodyStrong' : 'body'} style={tint ? { color: tint } : undefined}>
        {formatAmount(value, currency)}
      </AtlasText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  breakdown: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
