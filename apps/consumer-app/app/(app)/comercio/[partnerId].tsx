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
import { StyleSheet, View } from 'react-native';
import { categoryLook, formatAmount } from '../../../src/features/spending-copy';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { useSession } from '../../../src/session/session';
import { color, space } from '../../../src/theme/tokens';
import { Icon } from '../../../src/ui/icons';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Card, Divider, EmptyState, ListRow, Skeleton } from '../../../src/ui/primitives';

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
        <Gap size="lg" />
        <Card>
          <Skeleton height={18} width="60%" />
          <Skeleton height={14} width="40%" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Gap size="sm" />
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon name={look.icon} size={26} tint={color.action.primary} />
        </View>
        <View style={styles.headerText}>
          <AtlasText variant="h1">{merchant?.displayName ?? 'Compra sin comercio'}</AtlasText>
          <AtlasText variant="body" tone="secondary">
            {look.label}
          </AtlasText>
        </View>
      </View>

      <Card>
        <AtlasText variant="caption" tone="tertiary">
          TOTAL POR PAGAR EN ESTE COMERCIO
        </AtlasText>
        <AtlasText variant="amountSmall">{formatAmount(outstanding, currency)}</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          {loans.length} {loans.length === 1 ? 'crédito' : 'créditos'}
        </AtlasText>
      </Card>

      {loans.length === 0 ? (
        <EmptyState title="Sin créditos aquí" detail="No encontramos créditos de este comercio en tu cuenta." />
      ) : (
        <Card>
          {loans.map((loan, index) => {
            const overdue = loan.daysPastDue > 0;
            return (
              <View key={loan.loanId}>
                {index > 0 ? <Divider /> : null}
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
                      <AtlasText variant="bodyStrong">{formatAmount(Number(loan.outstandingPrincipal), loan.currencyCode)}</AtlasText>
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raised,
  },
});
