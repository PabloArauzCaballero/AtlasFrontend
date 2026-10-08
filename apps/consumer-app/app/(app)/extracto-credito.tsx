/**
 * Mi extracto de crédito: todo lo que pasó con el crédito, como el extracto de un banco (Pablo, 2026-10-08).
 *
 * Arriba lo que se financió, lo que se pagó y lo que se debe hoy. Después lo que viene (las cuotas por pagar) y la
 * lista de movimientos con el saldo de cada momento. Las cuentas viven en `features/extracto-credito.ts`.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as loansApi from '../../src/api/endpoints/loans';
import { useAlVolver } from '../../src/features/al-volver';
import { armarExtracto, type Extracto } from '../../src/features/extracto-credito';
import { formatAmount } from '../../src/features/spending-copy';
import { useSession } from '../../src/session/session';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Card, EmptyState, ErrorState, ListRow, SectionHeader, SkeletonLista, Stat, StatRow } from '../../src/ui/primitives';

const fecha = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('es-BO');

export default function ExtractoCredito() {
  const session = useSession();
  const [extracto, setExtracto] = useState<Extracto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!session.customerId) return;
    setError(null);
    try {
      const { items } = await loansApi.listLoans(session.customerId);
      const detalles = await Promise.all(items.map((loan) => loansApi.getLoan(loan.loanId)));
      setExtracto(armarExtracto(detalles));
    } catch {
      setError('No pudimos cargar tu extracto. Revisa tu conexión y vuelve a intentar.');
    }
  }, [session.customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useAlVolver(cargar);

  const moneda = 'BOB';
  return (
    <Screen onRefresh={() => void cargar()}>
      <ScreenHeader title="Mi extracto de crédito" subtitle="Tus compras, tus pagos y lo que debes hoy." onBack="auto" />

      {error ? <ErrorState title="Extracto no disponible" detail={error} onRetry={() => void cargar()} /> : null}

      {!extracto && !error ? <SkeletonLista /> : null}

      {extracto ? (
        <>
          <Card testID="extracto-resumen">
            <StatRow>
              <Stat label="Financiado" value={formatAmount(extracto.totalFinanciado, moneda)} />
              <Stat label="Pagado" value={formatAmount(extracto.totalPagado, moneda)} tone="success" />
              <Stat label="Debes hoy" value={formatAmount(extracto.saldo, moneda)} tone="brand" />
            </StatRow>
          </Card>

          <Gap size="md" />
          <SectionHeader title="Lo que viene" detail="Tus cuotas por pagar, de la más cercana a la más lejana." />
          {extracto.proximas.length === 0 ? (
            <EmptyState title="Nada por pagar" detail="Cuando tengas cuotas pendientes, aparecerán aquí." />
          ) : (
            <Card padding="none">
              {extracto.proximas.map((cuota) => (
                <ListRow
                  key={cuota.id}
                  title={cuota.concepto}
                  subtitle={`Vence el ${fecha(cuota.fecha)}`}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <AtlasText variant="bodyStrong">{formatAmount(cuota.importe, moneda)}</AtlasText>
                      {cuota.vencida ? <Badge label="Vencida" tone="danger" /> : null}
                    </View>
                  }
                />
              ))}
            </Card>
          )}

          <Gap size="md" />
          <SectionHeader title="Movimientos" detail="Más recientes primero, con lo que debías después de cada uno." />
          {extracto.movimientos.length === 0 ? (
            <EmptyState title="Todavía no hay movimientos" detail="Cuando compres con Atlas, tu extracto empieza aquí." />
          ) : (
            <Card padding="none" testID="extracto-movimientos">
              {extracto.movimientos.map((mov) => (
                <ListRow
                  key={mov.id}
                  title={mov.concepto}
                  subtitle={fecha(mov.fecha)}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <AtlasText variant="bodyStrong" tone={mov.tipo === 'pago' ? 'success' : 'primary'}>
                        {`${mov.tipo === 'pago' ? '−' : '+'} ${formatAmount(Math.abs(mov.importe), moneda)}`}
                      </AtlasText>
                      <AtlasText variant="caption" tone="secondary">
                        {`Saldo ${formatAmount(mov.saldo, moneda)}`}
                      </AtlasText>
                    </View>
                  }
                />
              ))}
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
