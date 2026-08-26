/**
 * Los creditos sacados en UN comercio.
 *
 * Segundo nivel de la pantalla de pagos: comercio -> creditos -> cuotas. Se llega aqui al tocar un
 * comercio, y de aqui a cada credito. Tres niveles y no dos porque quien tiene varias compras en la
 * misma tienda necesita distinguirlas antes de ver cuotas: un calendario con las cuotas de tres
 * creditos mezcladas no dice a cual pertenece cada una.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { categoryLook, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useSession } from '../../../src/session/session';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Card, Divider, EmptyState, IconChip, ListRow, Skeleton, Stat } from '../../../src/ui/primitives';

export default function MerchantCredits() {
  const router = useRouter();
  const session = useSession();
  const params = useLocalSearchParams<{ partnerId: string }>();
  const book = useCreditBook(session.customerId);

  const loans = useMemo(
    () => book.loans.filter((loan) => (loan.merchant?.partnerProfileId ?? 'sin_comercio') === params.partnerId),
    [book.loans, params.partnerId],
  );

  const merchant = loans[0]?.merchant ?? null;
  const look = categoryLook(merchant?.businessCategory ?? 'sin_comercio');
  const outstanding = loans.reduce((total, loan) => total + Number(loan.outstandingPrincipal ?? 0), 0);
  const currency = loans[0]?.currencyCode ?? 'BOB';

  if (!book.ready) {
    return (
      <Screen>
        <ScreenHeader title="Comercio" onBack="auto" />
        <Card>
          <Skeleton height={11} width="60%" />
          <Skeleton height={23} width="40%" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Gap size="sm" />
      <ScreenHeader
        title={merchant?.displayName ?? 'Compra sin comercio'}
        subtitle={look.label}
        onBack="auto"
        leading={<IconChip name={look.icon} size="lg" />}
      />

      <Card>
        <Stat
          label="Total por pagar en este comercio"
          value={formatAmount(outstanding, currency)}
          size="lg"
          hint={`${loans.length} ${loans.length === 1 ? 'crédito' : 'créditos'}`}
        />
      </Card>

      {loans.length === 0 ? (
        <EmptyState icon="billetera" title="Sin créditos aquí" detail="No encontramos créditos de este comercio en tu cuenta." />
      ) : (
        <Card padding="tight">
          {loans.map((loan, index) => {
            const overdue = loan.daysPastDue > 0;
            return (
              <View key={loan.loanId}>
                {index > 0 ? <Divider inset /> : null}
                <ListRow
                  title={formatAmount(Number(loan.principalAmount), loan.currencyCode)}
                  subtitle={`${loan.termMonths} ${loan.termMonths === 1 ? 'mes' : 'meses'} · ${
                    loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString('es-BO') : 'sin desembolsar'
                  }`}
                  icon="billetera"
                  right={
                    overdue ? (
                      <Badge label={`${loan.daysPastDue} d de atraso`} tone="danger" />
                    ) : loan.status === 'paid_off' ? (
                      <Badge label="Pagado" tone="success" />
                    ) : (
                      <AtlasText variant="amountMicro">{formatAmount(Number(loan.outstandingPrincipal), loan.currencyCode)}</AtlasText>
                    )
                  }
                  onPress={() => router.push(`/(app)/credito/${loan.loanId}`)}
                  accessibilityHint="Abrir para ver las cuotas de este crédito"
                />
              </View>
            );
          })}
        </Card>
      )}

      <Gap size="lg" />
    </Screen>
  );
}


