/**
 * Como pagar una obligacion.
 *
 * Muestra el QR BANCARIO del comercio —el instrumento que si mueve dinero— junto al beneficiario y
 * al monto exacto. Ese QR es un snapshot: si el comercio cambia su cuenta manana, esta instruccion
 * sigue apuntando al beneficiario que estaba vigente cuando se emitio.
 *
 * Reportar el pago NO lo marca como pagado. Es evidencia que abre una revision; el estado
 * definitivo lo resuelve Atlas con la confirmacion del comercio. Decir lo contrario seria mentirle
 * a quien despues reclama.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { isSandboxPurchase } from '../../../src/api/config';
import { formatMoney } from '../../../src/domain/money';
import { dueLabel, formatTime, itemTitle, statusLabel, statusTone } from '../../../src/features/payment-copy';
import { useSandbox } from '../../../src/sandbox/store';
import { useSession } from '../../../src/session/session';
import { requestProofTicket, submitPaymentClaim, uploadProof } from '../../../src/api/endpoints/payment-claims';
import { color, palette, radius, space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, Divider, EmptyState, ErrorState, KeyValue, Overline } from '../../../src/ui/primitives';

/** Lo que se le dice al cliente cuando la compra es simulada y toca un botón de dinero. */
const AVISO_DEMOSTRACION =
  'Esta compra es de demostración: el aviso no se envía a ningún comercio. Los pagos reales se avisan desde Pagos, abriendo la cuota.';

export default function PaymentScreen() {
  const router = useRouter();
  const sandbox = useSandbox();
  const session = useSession();
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const [reference, setReference] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (itemId) sandbox.ensureInstruction(itemId);
  }, [itemId, sandbox]);

  const schedule = sandbox.state.schedules.find((entry) => entry.items.some((item) => item.id === itemId));
  const item = schedule?.items.find((entry) => entry.id === itemId);
  const instruction = itemId ? sandbox.instructionFor(itemId) : null;
  const order = sandbox.state.orders.find((entry) => entry.id === schedule?.purchaseOrderId);
  const claim = sandbox.state.claims.find((entry) => entry.instructionId === instruction?.id);

  if (!item || !order) {
    return (
      <Screen>
        <ScreenHeader title="Pago" onBack="auto" />
        <EmptyState icon="pagos" title="No encontramos este pago" detail="Vuelve a la lista de pagos y abre la cuota otra vez." />
      </Screen>
    );
  }

  if (item.status === 'PAID') {
    return (
      <Screen footer={<Button label="Volver" onPress={() => router.back()} />}>
        <ScreenHeader title={itemTitle(item)} subtitle={order.context.tradeName} onBack="auto" />
        <Card tone="success">
          <Badge dot label="pagada" tone="success" />
          <AtlasText variant="amount" tone="success">
            {formatMoney(item.amount)}
          </AtlasText>
          <AtlasText variant="body" tone="secondary">
            {dueLabel(item)}
          </AtlasText>
        </Card>
      </Screen>
    );
  }

  const copyEndpoint = async () => {
    if (!instruction) return;
    await Clipboard.setStringAsync(instruction.qrPayloadSnapshot);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const attachProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!picked.canceled && picked.assets[0]) setProofUri(picked.assets[0].uri);
  };

  /**
   * El aviso de pago sale de verdad hacia el backend.
   *
   * Antes esto llamaba al sandbox: el comprobante se quedaba en el telefono, el cliente creia haber
   * avisado y el comercio nunca se enteraba. Ahora el comprobante sube al almacen con una URL
   * firmada y el aviso queda esperando a que el comercio lo confirme.
   *
   * Si el envio falla NO se marca como avisado: decirle a alguien que su pago esta reportado cuando
   * no salio de su telefono es la unica forma de que deje de intentarlo.
   */
  const reportPayment = async () => {
    if (!instruction) return;

    /*
     * En una compra de DEMOSTRACIÓN el aviso no sale del teléfono, y se dice: antes esto marcaba
     * «reportado» con vibración de éxito y el cliente creía haber avisado a un comercio que nunca
     * se enteró. Los pagos reales se avisan desde Pagos › la cuota, que sí llega al backend.
     */
    if (isSandboxPurchase || !session.customerId) {
      sandbox.claimPayment({ instructionId: instruction.id, reference: reference.trim() || null, proofUri });
      setFallo(AVISO_DEMOSTRACION);
      return;
    }

    setEnviando(true);
    setFallo(null);
    try {
      const contentType = 'image/jpeg';
      let storageKey: string | null = null;

      if (proofUri) {
        const blob = await (await fetch(proofUri)).blob();
        const ticket = await requestProofTicket(session.customerId, { contentType, sizeBytes: blob.size });
        await uploadProof(ticket, proofUri, contentType);
        storageKey = ticket.storageKey;
      }
      if (!storageKey) {
        setFallo('Adjunta el comprobante de tu transferencia antes de avisar.');
        return;
      }

      await submitPaymentClaim(session.customerId, {
        installmentId: String(item.id),
        amount: String(item.amount),
        payerReference: reference.trim() || undefined,
        storageKey,
        contentType,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReported(true);
    } catch (error) {
      setFallo(error instanceof Error ? error.message : 'No pudimos enviar tu aviso. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen
      footer={
        reported || claim ? (
          <Button label="Entendido" onPress={() => router.back()} />
        ) : (
          <Button
            label={enviando ? 'Enviando tu aviso…' : 'Ya realicé el pago'}
            onPress={() => void reportPayment()}
            disabled={!instruction || enviando}
            blockedReason={instruction ? null : 'Estamos preparando las instrucciones de pago.'}
            haptic="success"
          />
        )
      }
    >
      <ScreenHeader title={itemTitle(item)} subtitle={order.context.tradeName} onBack="auto" />

      <Card>
        <View style={styles.rowBetween}>
          <Overline>Monto a pagar</Overline>
          <Badge dot label={statusLabel(item.status)} tone={statusTone(item.status)} />
        </View>
        <AtlasText variant="amountHero">{formatMoney(item.amount)}</AtlasText>
        <AtlasText variant="body" tone="secondary">
          {dueLabel(item)}
        </AtlasText>
      </Card>

      {instruction ? (
        <Card>
          <CardHeader
            icon="escanear"
            title="Paga con el QR del comercio"
            detail="Abre la app de tu banco, escanea este código y paga el monto exacto."
            divider={false}
          />

          <View style={styles.qrBox}>
            <QRCode value={instruction.qrPayloadSnapshot} size={196} backgroundColor={palette.white} color={palette.bg} />
          </View>

          <Divider />
          <KeyValue label="Beneficiario" value={instruction.beneficiaryNameSnapshot} />
          <KeyValue label="Cuenta" numeric value={instruction.paymentEndpointMaskedSnapshot} />
          <KeyValue label="Vigente hasta" numeric value={formatTime(instruction.expiresAt)} />

          <Button label={copied ? 'Código copiado' : 'Copiar código de pago'} variant="secondary" onPress={copyEndpoint} />
        </Card>
      ) : (
        <ErrorState
          title="Sin instruccion de pago"
          detail="No pudimos preparar el destino de cobro de esta cuota. Intenta de nuevo en un momento."
          onRetry={() => itemId && sandbox.ensureInstruction(itemId)}
        />
      )}

      {reported || claim ? (
        <Card tone="brand">
          <CardHeader
            icon="reloj"
            title="Recibimos tu reporte"
            trailing={<Badge dot label="en verificación" tone="info" />}
          />
          <AtlasText variant="body" tone="secondary">
            Tu comprobante es evidencia, no confirma el pago por si solo. Lo damos por pagado cuando el comercio confirma
            que recibio el dinero. Te avisamos apenas ocurra.
          </AtlasText>
        </Card>
      ) : (
        <Card>
          <CardHeader
            icon="documento"
            title="Ya pagaste"
            detail="Cuéntanos los datos del pago para acelerar la verificación. Es opcional."
            divider={false}
          />
          <Field
            label="Número de transacción"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder="Ej. 4839201"
          />
          <Button label={proofUri ? 'Comprobante adjunto' : 'Adjuntar comprobante'} variant="secondary" onPress={attachProof} />
          {fallo ? (
            <>
              <Gap size="sm" />
              <AtlasText variant="body" tone="danger">{fallo}</AtlasText>
            </>
          ) : null}
        </Card>
      )}

      <Card>
        <CardHeader
          icon="alerta"
          iconTone="warning"
          title="Algo no cuadra"
          detail="Si pagaste y sigue apareciendo pendiente, abre una revisión. No se borra el vencimiento mientras la revisamos."
          divider={false}
        />
        {/*
          Antes esto abría una «disputa» en el motor local y volvía atrás sin decir nada, en cualquier
          modo: la queja no salía del teléfono. Con una compra real, el camino que sí llega a alguien es
          Ayuda; con una simulada, se dice que es simulada.
        */}
        <Button
          label={isSandboxPurchase ? 'Reportar un problema (demostración)' : 'Pedir ayuda con este pago'}
          variant="ghost"
          onPress={() => {
            if (isSandboxPurchase || !session.customerId) {
              sandbox.openDispute(item.id, 'CONSUMER_CLAIMS_PAID');
              setFallo(AVISO_DEMOSTRACION);
              return;
            }
            router.push('/(app)/soporte');
          }}
        />
      </Card>

      {isSandboxPurchase ? (
        <Card>
          <CardHeader
            icon="chispa"
            iconTone="neutral"
            title="Simular la confirmación del comercio"
            detail="En producción esta confirmación llega desde el portal del comercio y es la única que resuelve la cuota como pagada. Aquí se dispara a mano para poder recorrer el ciclo completo."
            trailing={<DataSourceBadge label="Solo en sandbox" />}
            divider={false}
          />
          <Button
            label="El comercio confirma que recibió el pago"
            variant="secondary"
            onPress={() => {
              sandbox.confirmMerchantReceipt(item.id);
              router.back();
            }}
          />
        </Card>
      ) : null}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Atlas nunca recibe este dinero: va directo a la cuenta de {order.context.tradeName}.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  /*
    El QR sobre blanco, con aire alrededor y su propio filo.

    La zona tranquila —el margen blanco de al menos cuatro modulos— no es estetica: sin ella muchos
    lectores no enganchan el codigo, y esta es la pantalla donde un fallo de lectura significa que
    alguien no puede pagar su cuota. El contorno separa el blanco del papel navy para que la tarjeta
    no parezca tener un agujero.
  */
  qrBox: {
    alignSelf: 'center',
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface.inverse,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
});
