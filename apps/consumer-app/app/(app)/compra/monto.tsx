/**
 * Monto de la compra.
 *
 * Lo unico que la persona aporta es el monto BRUTO. El 60/40, las cuotas y las fechas se calculan
 * con la politica vigente y se muestran antes de continuar: nadie deberia aceptar un plan de pagos
 * que no vio.
 *
 * El desglose que se ve aqui es una previsualizacion. El importe que manda es el que confirma el
 * servidor al originar la compra.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatMoney, type Minor } from '../../../src/domain/money';
import { STANDARD_POLICY_V1, buildBreakdown, describeAmountRejection, validateGrossAmount } from '../../../src/domain/policy';
import { ROTULO_SIMULACION } from '../../../src/features/demo-copy';
import { formatDate } from '../../../src/features/payment-copy';
import { useSandbox, useScanSession } from '../../../src/sandbox/store';
import { space } from '../../../src/theme/tokens';
import { firstBlocker } from '../../../src/ui/blocked';
import { DataSourceBadge } from '../../../src/ui/brand';
import { AmountField } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, Divider, ErrorState, IconChip, KeyValue, Overline } from '../../../src/ui/primitives';
import { useCopy } from '../../../src/features/use-contenido-remoto';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function PurchaseAmount() {
  const t = useCopy();
  const router = useRouter();
  const sandbox = useSandbox();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useScanSession(sessionId);

  const [raw, setRaw] = useState('');
  const [amount, setAmount] = useState<Minor | null>(null);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const rejection = validateGrossAmount(amount, STANDARD_POLICY_V1);
  const breakdown = useMemo(() => (amount && !rejection ? buildBreakdown(amount, STANDARD_POLICY_V1) : null), [amount, rejection]);
  const exceedsAvailable = Boolean(breakdown && breakdown.financedAmount > sandbox.available);

  if (!session) {
    return (
      <Screen>
        <ScreenHeader title="Compra" onBack="auto" />
        <ErrorState
          title="Sesión no encontrada"
          detail="Vuelve a escanear el código QR del comercio para empezar de nuevo."
          onRetry={() => router.replace('/(app)/(tabs)/escanear')}
        />
      </Screen>
    );
  }

  if (session.status === 'EXPIRED') {
    return (
      <Screen footer={<Button label="Escanear de nuevo" onPress={() => router.replace('/(app)/(tabs)/escanear')} />}>
        <ScreenHeader title="El código expiró" onBack="auto" />
        <ErrorState
          title="Pasaron más de 10 minutos"
          detail="Por seguridad, el escaneo caduca. Vuelve a escanear el QR del comercio."
        />
      </Screen>
    );
  }

  const submit = () => {
    if (!amount || rejection || exceedsAvailable) return;
    const result = sandbox.submitAmount(session.id, amount);
    if (!result.ok) {
      setFailure(result.code);
      return;
    }
    // No se espera la decision para navegar: la pantalla de la orden es la que la muestra llegue
    // cuando llegue, y bloquear aqui dejaria al usuario mirando un boton muerto contra la red.
    void sandbox.evaluate(result.orderId);
    router.replace(`/(app)/compra/${result.orderId}`);
  };

  return (
    <Screen
      footer={
        <Button
          label="Continuar"
          onPress={submit}
          disabled={!amount || Boolean(rejection) || exceedsAvailable}
          blockedReason={firstBlocker([
            [Boolean(amount), 'Escribe el monto total que te indica el comercio.'],
            [
              !rejection,
              rejection ? describeAmountRejection(rejection, STANDARD_POLICY_V1) : 'El monto está fuera de rango.',
            ],
            // El detalle exacto ya esta arriba, en su propio aviso con las dos cifras. Repetirlo
            // aqui obligaria a leer dos veces lo mismo.
            [!exceedsAvailable, 'El monto supera tu disponible.'],
          ])}
          haptic="light"
        />
      }
    >
      <ScreenHeader title="Tu compra" subtitle="Escribe el monto total que te indica el comercio." onBack="auto" />
      <DataSourceBadge label={ROTULO_SIMULACION} />

      {/*
        El comercio es el CONTEXTO de la compra, no un bloque mas de la pantalla.

        Va con su chip a la izquierda y su antetitulo encima: quien acaba de escanear necesita
        confirmar en un vistazo que esta comprando donde cree que esta comprando, antes de teclear
        ningun importe. Sin el antetitulo, el nombre del comercio se leia como el titulo de la
        tarjeta y competia con el de la pantalla.
      */}
      <Card padding="tight">
        <View style={styles.merchantRow}>
          <IconChip name="comercio" />
          <View style={styles.merchantText}>
            <Overline>Comprando en</Overline>
            <AtlasText variant="h3">{session.context.tradeName}</AtlasText>
            <AtlasText variant="caption" tone="secondary">
              {session.context.branchName} · {session.context.posName} · {session.context.city}
            </AtlasText>
          </View>
          {session.context.verified ? <Badge label="verificado" tone="success" /> : null}
        </View>
      </Card>

      <AmountField
        value={raw}
        ayuda="El precio total que te dice el comercio, en bolivianos y con centavos si los hay. Ej.: 1250,50. Con este monto se calcula la simulación de tu pago inicial y tus cuotas; si supera tu disponible, la app te lo dice antes de seguir."
        autoFocus
        onChangeAmount={(next, parsed) => {
          setRaw(next);
          setAmount(parsed);
          setTouched(true);
          setFailure(null);
        }}
        error={touched && rejection ? describeAmountRejection(rejection, STANDARD_POLICY_V1) : null}
      />

      {exceedsAvailable ? (
        <ErrorState
          title="Supera tu disponible"
          detail={`Con este monto necesitarias financiar ${formatMoney(breakdown!.financedAmount)} y tu disponible es ${formatMoney(sandbox.available)}.`}
        />
      ) : null}

      {failure ? (
        <ErrorState
          title="No pudimos iniciar la compra"
          detail={
            failure === 'SESSION_ALREADY_USED'
              ? 'Este escaneo ya se uso para otra compra. Escanea el QR de nuevo.'
              : 'El escaneo caduco. Vuelve a escanear el QR del comercio.'
          }
          onRetry={() => router.replace('/(app)/(tabs)/escanear')}
        />
      ) : null}

      {breakdown && !exceedsAvailable ? (
        <Card>
          <CardHeader icon="lista" title="Así quedaría tu plan" trailing={<DataSourceBadge label={ROTULO_SIMULACION} />} />

          <KeyValue label="Pagas hoy al comercio (60 %)">
            <AtlasText variant="amountSmall">{formatMoney(breakdown.initialPaymentAmount)}</AtlasText>
          </KeyValue>
          <KeyValue label="Financias con Atlas (40 %)">
            <AtlasText variant="amountSmall" tone="brand">
              {formatMoney(breakdown.financedAmount)}
            </AtlasText>
          </KeyValue>

          <Divider />
          <Overline>Tus cuotas</Overline>

          {breakdown.installments.map((installment) => (
            <KeyValue
              key={installment.sequenceNo}
              label={`Cuota ${installment.sequenceNo} · ${formatDate(new Date(Date.now() + installment.dueInDays * DAY_MS).toISOString())}`}
              numeric
              value={formatMoney(installment.amount)}
            />
          ))}

          <Divider />
          <AtlasText variant="caption" tone="tertiary">
            {t.texto('demo.plan_simulado')}
          </AtlasText>
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Todavía no se cobra nada. Al continuar evaluamos tu crédito y el comercio confirma la venta.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  merchantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  merchantText: { flex: 1, gap: space.xxs },
});
