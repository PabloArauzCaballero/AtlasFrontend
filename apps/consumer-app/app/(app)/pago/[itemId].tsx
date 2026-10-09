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
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { isSandboxPurchase } from '../../../src/api/config';
import { getPaymentQrForPos } from '../../../src/api/endpoints/loans';
import { listCreditApplications } from '../../../src/api/endpoints/credit';
import { formatMoney, toMajorNumber } from '../../../src/domain/money';
import { dueLabel, formatTime, itemTitle, statusLabel, statusTone } from '../../../src/features/payment-copy';
import { ESPERA_ENTRE_CONSULTAS_MS, estadoDelPagoInicial, type EstadoPagoInicial } from '../../../src/features/pago-inicial';
import { useSandbox } from '../../../src/sandbox/store';
import { POS_QRS } from '../../../src/sandbox/fixtures';
import { useSession } from '../../../src/session/session';
import { submitDownPayment, submitPaymentClaim } from '../../../src/api/endpoints/payment-claims';
import { subirComprobante } from '../../../src/features/comprobante-de-pago';
import { color, radius, space } from '../../../src/theme/tokens';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Cargando, Card, CardHeader, Divider, EmptyState, ErrorState, KeyValue, Overline, Skeleton } from '../../../src/ui/primitives';
import { useCopy } from '../../../src/features/use-contenido-remoto';

export default function PaymentScreen() {
  const t = useCopy();
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
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRetry, setQrRetry] = useState(0);

  useEffect(() => {
    if (itemId) sandbox.ensureInstruction(itemId);
  }, [itemId, sandbox]);

  const schedule = sandbox.state.schedules.find((entry) => entry.items.some((item) => item.id === itemId));
  const item = schedule?.items.find((entry) => entry.id === itemId);
  const instruction = itemId ? sandbox.instructionFor(itemId) : null;
  const order = sandbox.state.orders.find((entry) => entry.id === schedule?.purchaseOrderId);
  const claim = sandbox.state.claims.find((entry) => entry.instructionId === instruction?.id);
  const realPos = Boolean(order && !POS_QRS.some((entry) => entry.context.posId === order.context.posId));
  const partnerId = order?.context.organizationId;
  const posId = order?.context.posId;
  const ensureUploadedQrInstruction = sandbox.ensureUploadedQrInstruction;

  /*
   * El pago INICIAL de una compra real vive en el backend: el cliente avisa con su comprobante y sólo el comercio lo
   * confirma desde su ERP. `esInicialReal` es la compra que nació de una solicitud de crédito de verdad; las de
   * demostración (sin solicitud) siguen en el motor local y se dicen como tales.
   */
  const applicationId = order?.backendApplicationId ?? null;
  const esInicialReal = Boolean(item?.itemType === 'INITIAL' && applicationId && session.customerId);
  const [remoto, setRemoto] = useState<EstadoPagoInicial>({ tipo: 'sin_avisar' });
  const yaConfirmado = useRef(false);
  const itemIdActual = item?.id;
  const confirmarLocal = sandbox.confirmMerchantReceipt;

  useEffect(() => {
    if (!esInicialReal || !applicationId || !session.customerId || !itemIdActual) return;
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const consultar = async () => {
      try {
        const { applications } = await listCreditApplications(session.customerId!, { sinPantalla: true });
        const mia = applications.find((solicitud) => String(solicitud.applicationId) === String(applicationId));
        if (!vivo) return;
        const estado = estadoDelPagoInicial(mia);
        setRemoto(estado);
        if (estado.tipo === 'confirmado') {
          // El comercio lo vio entrar: sólo ahora el inicial se da por pagado y la compra se activa. Una sola vez.
          if (!yaConfirmado.current) {
            yaConfirmado.current = true;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            confirmarLocal(itemIdActual);
          }
          return;
        }
      } catch {
        // Sin red no se afirma nada: se sigue esperando y se vuelve a preguntar.
      }
      if (vivo) temporizador = setTimeout(consultar, ESPERA_ENTRE_CONSULTAS_MS);
    };
    void consultar();
    return () => {
      vivo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [esInicialReal, applicationId, session.customerId, itemIdActual, confirmarLocal]);

  useEffect(() => {
    if (!realPos || !partnerId || !posId || !itemId || instruction) return;
    let cancelled = false;
    void getPaymentQrForPos(partnerId, posId)
      .then((qr) => {
        if (cancelled) return;
        if (!qr) {
          setQrError('El comercio todavía no tiene un QR bancario aprobado para recibir este pago.');
          return;
        }
        setQrError(null);
        ensureUploadedQrInstruction(itemId, qr);
      })
      .catch((error: unknown) => {
        if (!cancelled) setQrError(error instanceof Error ? error.message : 'No se pudo obtener el QR bancario del comercio.');
      });
    return () => { cancelled = true; };
  }, [itemId, instruction, partnerId, posId, realPos, qrRetry, ensureUploadedQrInstruction]);

  if (!sandbox.ready) {
    return (
      <Screen>
        <ScreenHeader title="Pago" onBack="auto" />
        <Cargando bloque texto="Buscando tu pago…" />
      </Screen>
    );
  }

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
    if (!instruction?.qrPayloadSnapshot) return;
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

    if (esInicialReal && applicationId && session.customerId) {
      if (!proofUri) {
        setFallo(t.texto('pago.comprobante_falta'));
        return;
      }
      setEnviando(true);
      setFallo(null);
      try {
        const { storageKey, contentType } = await subirComprobante(session.customerId, proofUri);
        await submitDownPayment(session.customerId, applicationId, {
          amount: toMajorNumber(item.amount).toFixed(2),
          payerReference: reference.trim() || undefined,
          storageKey,
          contentType,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRemoto({ tipo: 'esperando_al_comercio' });
      } catch (error) {
        setFallo(error instanceof Error ? error.message : 'No pudimos enviar tu aviso. Intenta de nuevo.');
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (realPos && !isSandboxPurchase) {
      setFallo('El pago inicial de esta compra aún no admite avisos reales. Conserva el comprobante y contacta al comercio.');
      return;
    }

    /*
     * En una compra de DEMOSTRACIÓN el aviso no sale del teléfono, y se dice: antes esto marcaba
     * «reportado» con vibración de éxito y el cliente creía haber avisado a un comercio que nunca
     * se enteró. Los pagos reales se avisan desde Pagos › la cuota, que sí llega al backend.
     */
    if (isSandboxPurchase || !session.customerId) {
      sandbox.claimPayment({ instructionId: instruction.id, reference: reference.trim() || null, proofUri });
      setFallo(t.texto('demo.compra'));
      return;
    }

    setEnviando(true);
    setFallo(null);
    try {
      if (!proofUri) {
        setFallo(t.texto('pago.comprobante_falta'));
        return;
      }
      const { storageKey, contentType } = await subirComprobante(session.customerId, proofUri);

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

  /* El aviso en espera: el real lo dice el backend; el de demostración, el motor local. */
  const esperandoAlComercio = esInicialReal ? remoto.tipo === 'esperando_al_comercio' : reported || Boolean(claim);

  return (
    <Screen
      footer={
        esperandoAlComercio ? (
          <Button label="Entendido" onPress={() => router.back()} />
        ) : (
          <Button
            label={enviando ? 'Enviando tu aviso…' : 'Ya realicé el pago'}
            onPress={() => reportPayment()}
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
            detail={t.texto('pago.qr_instruccion')}
            divider={false}
          />

          <View style={styles.qrBox}>
            {instruction.qrImageDataUrlSnapshot ? (
              <Image source={{ uri: instruction.qrImageDataUrlSnapshot }} style={{ width: 196, height: 196 }} resizeMode="contain" accessibilityLabel={`QR bancario de ${instruction.beneficiaryNameSnapshot}`} />
            ) : (
              <QRCode value={instruction.qrPayloadSnapshot} size={196} backgroundColor={color.fixed.white} color={color.surface.primary} />
            )}
          </View>

          <Divider />
          <KeyValue label="Beneficiario" value={instruction.beneficiaryNameSnapshot} />
          <KeyValue label="Cuenta" numeric value={instruction.paymentEndpointMaskedSnapshot} />
          <KeyValue label="Vigente hasta" numeric value={formatTime(instruction.expiresAt)} />

          {instruction.qrPayloadSnapshot ? <Button label={copied ? 'Código copiado' : 'Copiar código de pago'} variant="secondary" onPress={copyEndpoint} /> : null}
        </Card>
      ) : !qrError ? (
        /*
          Sin error todavía NO es un fallo: es el QR del comercio que aún viene. Se pintaba un
          «Sin instrucción de pago» con botón de reintentar durante toda la espera, y parecía roto.
        */
        <Card>
          <Skeleton height={220} />
          <Cargando texto="Preparando el QR de pago del comercio…" />
        </Card>
      ) : (
        <ErrorState
          title="No pudimos preparar el pago"
          detail={qrError}
          onRetry={() => {
            if (!itemId) return;
            if (realPos) {
              setQrError(null);
              setQrRetry((current) => current + 1);
            } else {
              sandbox.ensureInstruction(itemId);
            }
          }}
        />
      )}

      {esInicialReal && remoto.tipo === 'rechazado' ? (
        <ErrorState
          title="El comercio no pudo confirmar tu pago"
          detail={`${remoto.motivo} Revisa tu comprobante y vuelve a avisar: tu compra sigue abierta.`}
        />
      ) : null}

      {esperandoAlComercio ? (
        <Card tone="brand">
          <CardHeader
            icon="reloj"
            title="Recibimos tu comprobante"
            trailing={<Badge dot label="esperando al comercio" tone="warning" />}
          />
          {/* Sigue «esperando» hasta que el comercio confirme desde su ERP: el comprobante es evidencia, no confirmación. */}
          <Cargando texto="Esperando que el comercio confirme que recibió tu pago…" />
          <AtlasText variant="body" tone="secondary">
            {t.texto('pago.comprobante_evidencia')}
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
            ayuda="El número de operación que muestra el comprobante de tu banco o billetera, tal como aparece. Ej.: 4839201. Con él el comercio encuentra tu pago en su extracto y lo confirma antes."
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
