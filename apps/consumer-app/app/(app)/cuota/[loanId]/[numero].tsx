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
import { categoryLook, dueCopy, formatAmount } from '../../../../src/features/spending-copy';
import type { IconName } from '../../../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../../../src/ui/layout';
import { useAlVolver, useTirarParaRecargar } from '../../../../src/features/al-volver';
import { useLoanDetail } from '../../../../src/features/use-credit-book';
import { useCopy } from '../../../../src/features/use-contenido-remoto';
import {
  AtlasText,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  ErrorState,
  IconChip,
  KeyValue,
  ListRow,
  Skeleton,
} from '../../../../src/ui/primitives';
import { marca } from '../../../../src/theme/tokens';

type State = 'paid' | 'overdue' | 'upcoming';

/*
 * El tono es un NOMBRE, no un color suelto.
 *
 * `tint` guardaba el hexadecimal del estado y la cabecera lo concatenaba con `'22'` para fabricarse
 * un fondo: un color literal escrito en una pantalla, que es justo lo que el sistema de tokens
 * existe para impedir. Con el nombre, la insignia, el chip del icono y el importe leen los tres el
 * mismo estado sin que ninguno tenga que conocer un hexadecimal.
 */
const LOOK: Record<State, { label: string; tone: 'success' | 'danger' | 'warning'; icon: IconName }> = {
  paid: { label: 'Pagada', tone: 'success', icon: 'check' },
  overdue: { label: 'Vencida', tone: 'danger', icon: 'alerta' },
  upcoming: { label: 'Por vencer', tone: 'warning', icon: 'reloj' },
};

function amountOf(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InstallmentDetail() {
  const t = useCopy();
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId: string; numero: string }>();
  const { loan, error, reload } = useLoanDetail(params.loanId, 'No pudimos cargar esta cuota.');
  // Al volver (p. ej. tras avisar el pago de una cuota), tras una operación de dinero y cada minuto a la vista.
  useAlVolver(reload);
  const tirar = useTirarParaRecargar(reload);

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
          <Skeleton height={11} width="30%" />
          <Skeleton height={38} width="60%" />
          <Skeleton height={1} />
          <Skeleton height={19} />
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
    <Screen {...tirar}>
      <ScreenHeader
        title={`Cuota ${installment.installmentNumber}`}
        subtitle={`${loan.merchant?.displayName ?? 'Compra sin comercio'} · ${merchantLook.label}`}
        onBack="auto"
        leading={<IconChip name={look.icon} tone={look.tone} size="lg" />}
      />

      <Card tone={state === 'overdue' ? 'danger' : 'default'}>
        <Badge dot label={look.label} tone={look.tone} />
        <AtlasText variant="amount" tone={state === 'paid' ? 'primary' : look.tone === 'danger' ? 'danger' : 'warning'}>
          {formatAmount(state === 'paid' ? owed : pending, loan.currencyCode)}
        </AtlasText>
        <AtlasText variant="body" tone="secondary">
          {state === 'paid' ? 'Ya está pagada.' : dueCopy(installment.dueDate)}
        </AtlasText>
        {state === 'overdue' ? (
          <AtlasText variant="caption" tone="secondary">
            {t.texto('cuota.vencida')}
          </AtlasText>
        ) : null}
      </Card>

      {/*
        El desglose, siempre: es lo que permite entender por que una cuota vencida cuesta mas que la
        de al lado. Un unico total obliga a creerselo.
      */}
      <Card>
        <CardHeader icon="lista" iconTone="neutral" title="De qué se compone" />
        <KeyValue label="Capital" numeric value={formatAmount(amountOf(installment.principalAmount), loan.currencyCode)} />
        <KeyValue label="Interés" numeric value={formatAmount(amountOf(installment.interestAmount), loan.currencyCode)} />
        {amountOf(installment.lateFeeAmount) > 0 ? (
          <KeyValue
            label="Recargo por mora"
            numeric
            tone="danger"
            value={formatAmount(amountOf(installment.lateFeeAmount), loan.currencyCode)}
          />
        ) : null}
        <Divider />
        {/*
          El total y lo que falta van en el tamano de importe, no en el de las lineas que suman.

          Un desglose donde las cinco lineas se dibujan igual obliga a leerlo entero para saber cual
          es el resultado. La ultima linea es la unica que contesta «cuanto tengo que pagar»; el
          resto explica de donde sale.
        */}
        <KeyValue label="Total de la cuota">
          <AtlasText variant="amountSmall">{formatAmount(owed, loan.currencyCode)}</AtlasText>
        </KeyValue>
        {paid > 0 ? (
          <KeyValue label="Ya pagado" numeric tone="success" value={formatAmount(-paid, loan.currencyCode)} />
        ) : null}
        {pending > 0 ? (
          <KeyValue label="Te falta pagar">
            <AtlasText variant="amountSmall" tone={state === 'overdue' ? 'danger' : 'warning'}>
              {formatAmount(pending, loan.currencyCode)}
            </AtlasText>
          </KeyValue>
        ) : null}
      </Card>

      {state !== 'paid' ? (
        <Card>
          <CardHeader icon="ayuda" title="¿Dónde la pago?" />
          <AtlasText variant="body" tone="secondary">
            Al QR bancario de {loan.merchant?.displayName ?? 'el comercio donde compraste'}. {marca.nombre} nunca recibe tu dinero: cada
            cuota se paga al comercio, y él nos confirma el pago.
          </AtlasText>
          {/*
            El boton que faltaba. Esta pantalla DECIA donde se paga y no ensenaba el QR: la
            instruccion no se podia seguir. Ahora lleva a la pantalla que trae el QR real del
            comercio y deja avisar del pago con el id de ESTA cuota.
          */}
          <Button
            label="Pagar esta cuota"
            onPress={() => router.push(`/(app)/pagar/${installment.installmentId}`)}
            accessibilityHint="Ver el QR del comercio y avisar de tu pago"
          />
          {loan.merchant ? (
            <Button
              label="Ver este comercio"
              variant="secondary"
              onPress={() => router.push(`/(app)/comercio/${loan.merchant!.partnerProfileId}`)}
            />
          ) : null}
        </Card>
      ) : null}

      <Card padding="tight">
        <CardHeader icon="pagos" iconTone="neutral" title="El crédito completo" />
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


