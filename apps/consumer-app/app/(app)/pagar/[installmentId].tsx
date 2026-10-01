/**
 * Pagar una cuota REAL: el QR del comercio, y el aviso con su comprobante.
 *
 * ## Lo que estaba mal
 *
 * La app tenia dos mitades que no se tocaban. `pago/[itemId]` ensenaba un QR bonito, pero salia del
 * simulador local: un codigo de demostracion que ningun banco sabe leer, de un comercio de mentira.
 * Y el detalle de la cuota real —el de `cuota/[loanId]/[numero]`, el que si viene del backend— decia
 * «se paga al QR bancario del comercio» y no ensenaba NINGUNO, porque no habia forma de pedirlo.
 *
 * El resultado practico: quien tenia un credito de verdad leia una instruccion que no podia seguir.
 *
 * ## Que hace esta pantalla
 *
 * Pide al backend la instruccion de ESTA cuota y pinta el QR bancario que el comercio subio en su
 * portal, con su beneficiario, su cuenta enmascarada y el importe exacto que falta. Despues deja
 * adjuntar el comprobante y avisar; el aviso viaja de verdad y queda esperando al comercio.
 *
 * ## Lo que esta pantalla NO hace
 *
 * No da la cuota por pagada. El comprobante es evidencia de que alguien hizo una transferencia, no
 * de que el comercio la recibio: el dinero entra en la cuenta del comercio y solo el puede mirarla.
 * Decir «pagado» aqui seria mentirle a quien despues reclama.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  getPaymentInstruction,
  requestProofTicket,
  submitPaymentClaim,
  uploadProof,
  type PaymentInstruction,
} from '../../../src/api/endpoints/payment-claims';
import { formatAmount } from '../../../src/features/spending-copy';
import { useSession } from '../../../src/session/session';
import { color, palette, radius, space } from '../../../src/theme/tokens';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, Divider, ErrorState, KeyValue, Overline, Skeleton } from '../../../src/ui/primitives';

/** Por que no hay QR, dicho de forma que se sepa a quien reclamar. */
const SIN_QR: Record<string, { titulo: string; detalle: string }> = {
  LOAN_WITHOUT_PARTNER: {
    titulo: 'Este crédito no tiene comercio asociado',
    detalle: 'Escríbenos desde ayuda y te decimos adónde pagar esta cuota. No la des por vencida mientras lo revisamos.',
  },
  PARTNER_HAS_NO_PAYMENT_QR: {
    titulo: 'El comercio todavía no publicó su QR de cobro',
    detalle: 'Pídeselo directamente: es el único que puede subirlo desde su portal. Tu cuota sigue esperando, no se pierde.',
  },
  /* El comercio ya lo subió; falta que Atlas lo apruebe. Sólo un QR aprobado se enseña aquí. */
  PARTNER_PAYMENT_QR_PENDING_REVIEW: {
    titulo: 'El QR del comercio está pendiente de aprobación',
    detalle: 'El comercio ya lo subió y Atlas lo está revisando. Vuelve en un rato: tu cuota sigue esperando, no se pierde.',
  },
  PAYMENT_QR_OBJECT_MISSING: {
    titulo: 'No pudimos recuperar el QR del comercio',
    detalle: 'Vuelve a intentarlo en un momento. Si sigue igual, avisanos desde ayuda.',
  },
};

export default function PayInstallmentScreen() {
  const router = useRouter();
  const session = useSession();
  const { installmentId } = useLocalSearchParams<{ installmentId: string }>();

  const [instruction, setInstruction] = useState<PaymentInstruction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [reportado, setReportado] = useState(false);

  const cargar = useCallback(async () => {
    if (!installmentId || !session.customerId) return;
    setError(null);
    try {
      setInstruction(await getPaymentInstruction(session.customerId, String(installmentId)));
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No pudimos cargar las instrucciones de pago.');
    }
  }, [installmentId, session.customerId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!session.customerId) {
    return (
      <Screen>
        <ScreenHeader title="Pagar cuota" onBack="auto" />
        <ErrorState title="Sesión no iniciada" detail="Vuelve a entrar para ver cómo pagar esta cuota." />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Pagar cuota" onBack="auto" />
        <ErrorState title="No pudimos preparar el pago" detail={error} onRetry={() => void cargar()} />
      </Screen>
    );
  }

  if (!instruction) {
    return (
      <Screen>
        <ScreenHeader title="Pagar cuota" onBack="auto" />
        <Card>
          <Skeleton height={18} width="40%" />
          <Skeleton height={32} width="60%" />
          <Skeleton height={196} />
        </Card>
      </Screen>
    );
  }

  const pendiente = Number(instruction.amountOutstanding);
  const yaAvisado = reportado || instruction.openClaim?.status === 'pending_verification';
  const rechazado = instruction.openClaim?.status === 'rejected';

  const copiarCuenta = async () => {
    const cuenta = instruction.paymentQr?.accountNumberMasked;
    if (!cuenta) return;
    await Clipboard.setStringAsync(cuenta);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const adjuntar = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return;
    const elegida = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!elegida.canceled && elegida.assets[0]) setProofUri(elegida.assets[0].uri);
  };

  /**
   * El aviso sale de verdad hacia el backend, con el id de la cuota REAL.
   *
   * Si el envio falla NO se marca como avisado: decirle a alguien que su pago esta reportado cuando
   * no salio de su telefono es la unica forma de que deje de intentarlo.
   */
  const avisar = async () => {
    if (!session.customerId) return;
    if (!proofUri) {
      setFallo('Adjunta el comprobante de tu transferencia antes de avisar.');
      return;
    }

    setEnviando(true);
    setFallo(null);
    try {
      const contentType = 'image/jpeg';
      const blob = await (await fetch(proofUri)).blob();
      const ticket = await requestProofTicket(session.customerId, { contentType, sizeBytes: blob.size });
      await uploadProof(ticket, proofUri, contentType);

      await submitPaymentClaim(session.customerId, {
        installmentId: instruction.installmentId,
        amount: instruction.amountOutstanding,
        payerReference: reference.trim() || undefined,
        storageKey: ticket.storageKey,
        contentType,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReportado(true);
      await cargar();
    } catch (problema) {
      setFallo(problema instanceof Error ? problema.message : 'No pudimos enviar tu aviso. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen
      footer={
        yaAvisado ? (
          <Button label="Entendido" onPress={() => router.back()} />
        ) : (
          <Button
            label={enviando ? 'Enviando tu aviso…' : 'Ya realicé el pago'}
            onPress={() => avisar()}
            disabled={enviando || pendiente <= 0}
            blockedReason={pendiente <= 0 ? 'Esta cuota ya está saldada.' : null}
            haptic="success"
          />
        )
      }
    >
      <ScreenHeader
        title={`Cuota ${instruction.installmentNumber}`}
        subtitle={instruction.merchant?.displayName ?? instruction.loanCode}
        onBack="auto"
      />

      <Card tone={pendiente > 0 ? 'default' : 'success'}>
        <View style={styles.rowBetween}>
          <Overline>Monto a pagar</Overline>
          <Badge dot label={pendiente > 0 ? 'pendiente' : 'pagada'} tone={pendiente > 0 ? 'warning' : 'success'} />
        </View>
        {/* La cifra que se viene a mirar: `amountHero`, igual que en `pago/[itemId]`. */}
        <AtlasText variant="amountHero">{formatAmount(pendiente, instruction.currencyCode)}</AtlasText>
        <AtlasText variant="body" tone="secondary">
          Vence el {instruction.dueDate}
        </AtlasText>
      </Card>

      {instruction.paymentQr ? (
        <Card>
          <CardHeader
            icon="escanear"
            title={`Paga con el QR de ${instruction.merchant?.displayName ?? 'tu comercio'}`}
            detail="Abre la app de tu banco, escanea este código y paga el monto exacto."
            divider={false}
          />

          {/*
            El QR llega EMBEBIDO en la respuesta (`data:`), no como enlace. Un `<Image source={{uri}}>`
            no manda cabeceras, asi que una ruta autenticada daria 401 y una URL prefirmada seria un
            enlace que funciona sin sesion: el destino del dinero de alguien no debe quedar accesible
            a quien tenga el enlace.
          */}
          <View style={styles.qrBox}>
            <Image
              source={{ uri: instruction.paymentQr.imageDataUrl }}
              style={styles.qr}
              resizeMode="contain"
              accessibilityLabel={`QR bancario de ${instruction.merchant?.displayName ?? 'el comercio'}`}
            />
          </View>

          <Divider />
          <KeyValue label="Beneficiario" value={instruction.merchant?.displayName ?? '—'} />
          <KeyValue label="Entidad" value={instruction.paymentQr.bankInstitutionCode ?? '—'} />
          {/* La cuenta en cifras tabulares: es un número que se compara contra el de la app del
              banco dígito a dígito, y con cifras proporcionales hay que releerlo. */}
          <KeyValue label="Cuenta" numeric value={instruction.paymentQr.accountNumberMasked ?? '—'} />

          {instruction.paymentQr.accountNumberMasked ? (
            <Button
              label={copied ? 'Cuenta copiada' : 'Copiar cuenta'}
              variant="secondary"
              onPress={() => copiarCuenta()}
            />
          ) : null}
        </Card>
      ) : (
        <ErrorState
          title={SIN_QR[instruction.paymentQrUnavailableReason ?? '']?.titulo ?? 'Sin QR de cobro'}
          detail={
            SIN_QR[instruction.paymentQrUnavailableReason ?? '']?.detalle ??
            'No pudimos preparar el destino de cobro de esta cuota.'
          }
          onRetry={() => void cargar()}
        />
      )}

      {yaAvisado ? (
        <Card tone="brand">
          <CardHeader
            icon="reloj"
            title="Recibimos tu reporte"
            trailing={<Badge dot label="en verificación" tone="info" />}
          />
          <AtlasText variant="body" tone="secondary">
            Tu comprobante es evidencia, no confirma el pago por sí solo. Lo damos por pagado cuando el comercio confirma
            que recibió el dinero. Te avisamos apenas ocurra.
          </AtlasText>
        </Card>
      ) : (
        <Card tone={rechazado ? 'danger' : 'default'}>
          <CardHeader
            icon="documento"
            title="Ya pagaste"
            detail="Adjunta el comprobante de tu transferencia. Es lo que el comercio mira para confirmarla."
            divider={false}
          />
          {rechazado ? (
            <>
              <Badge dot label="aviso anterior rechazado" tone="danger" />
              <AtlasText variant="body" tone="secondary">
                {instruction.openClaim?.rejectionReason ?? 'El comercio no reconoció el pago anterior.'}
              </AtlasText>
            </>
          ) : null}
          <Field
            label="Número de transacción"
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder="Ej. 4839201"
            ayuda="El número de operación que muestra el comprobante de tu banco o billetera, tal como aparece. Ej.: 4839201. Con él el comercio encuentra tu pago en su extracto y lo confirma antes."
          />
          <Button
            label={proofUri ? 'Comprobante adjunto' : 'Adjuntar comprobante'}
            variant="secondary"
            onPress={() => adjuntar()}
          />
          {proofUri ? <Image source={{ uri: proofUri }} style={styles.preview} resizeMode="contain" /> : null}
          {fallo ? (
            <>
              <Gap size="sm" />
              <AtlasText variant="body" tone="danger">
                {fallo}
              </AtlasText>
            </>
          ) : null}
        </Card>
      )}

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        Atlas nunca recibe este dinero: va directo a la cuenta de {instruction.merchant?.displayName ?? 'tu comercio'}.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  /*
    El QR sobre blanco, con aire alrededor y su propio filo. La zona tranquila —el margen blanco de
    al menos cuatro modulos— no es estetica: sin ella muchos lectores no enganchan el codigo, y esta
    es la pantalla donde un fallo de lectura significa que alguien no puede pagar su cuota. El
    contorno separa el blanco del papel navy para que la tarjeta no parezca tener un agujero.
  */
  qrBox: {
    alignSelf: 'center',
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: color.border.subtle,
  },
  qr: { width: 220, height: 220 },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border.subtle,
    backgroundColor: color.surface.sunken,
  },
});
