/**
 * Subir el extracto bancario para que recalculen la capacidad de pago.
 *
 * ## Que se le esta pidiendo a la persona
 *
 * Sus movimientos bancarios. Es el dato mas sensible que entrega en toda la app —mas que el carnet,
 * porque dice donde compra, cuanto gana y con quien— y la pantalla tiene que ganarse eso ANTES de
 * pedirlo, no despues. Por eso lo primero que se lee no es el boton: es que se hace con el archivo,
 * quien lo ve y para que.
 *
 * ## Que se promete, y que no
 *
 * Un plazo —24 horas— y no un numero al instante. Leer un extracto exige extraer los movimientos y
 * contar los rechazos por fondos insuficientes; prometer el resultado en el acto obligaria a
 * inventarlo. El compromiso lo escribe el servidor con hora concreta, no la pantalla.
 *
 * Tampoco se promete que la linea SUBA. Un extracto con rechazos la baja, y decir lo contrario
 * seria vender la funcion en vez de explicarla.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as creditLineApi from '../../src/api/endpoints/credit-line';
import { describeError } from '../../src/api/errors';
import { readAccessToken } from '../../src/api/client';
import { useSession } from '../../src/session/session';
import { color, radius, space } from '../../src/theme/tokens';
import { Icon, type IconName } from '../../src/ui/icons';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ErrorState } from '../../src/ui/primitives';

/** Lo que se le promete a quien entrega sus movimientos. Cada linea es una obligacion real. */
const PROMESAS: Array<{ icon: IconName; title: string; detail: string }> = [
  {
    icon: 'candado',
    title: 'Viaja cifrado y se guarda cifrado',
    detail: 'El archivo sube directo al almacén cifrado de Atlas. No pasa por la app ni queda en tu teléfono.',
  },
  {
    icon: 'escudo',
    title: 'Solo se usa para calcular tu capacidad de pago',
    detail: 'Es una entrada del cálculo, nada más. No se comparte con comercios, ni con terceros, ni se usa para publicidad.',
  },
  {
    icon: 'ojo-tachado',
    title: 'Nadie lo lee por curiosidad',
    detail: 'El acceso queda registrado y auditado. De tu extracto solo se extraen tus ingresos, tus gastos y los rechazos por fondos insuficientes.',
  },
  {
    icon: 'reloj',
    title: 'Puedes pedir que lo borremos',
    detail: 'Una vez recalculada tu línea, el archivo ya no hace falta. Escríbenos y se elimina.',
  },
];

/** 15 MB es el tope del almacén de evidencia; se comprueba antes de subir para no fallar al final. */
const MAX_BYTES = 15 * 1024 * 1024;

export default function ExtractoBancario() {
  const router = useRouter();
  const session = useSession();
  const [review, setReview] = useState<creditLineApi.BankStatementReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!session.customerId) return;
    let cancelled = false;
    creditLineApi
      .getLatestBankStatement(session.customerId)
      .then((value) => {
        if (!cancelled) setReview(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.customerId]);

  const pending = review?.status === 'received' || review?.status === 'processing';

  const subir = async () => {
    if (!session.customerId || busy) return;
    setError(null);

    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    const size = asset.size ?? 0;
    if (size <= 0 || size > MAX_BYTES) {
      Alert.alert('Archivo no válido', 'El extracto debe ser un PDF de menos de 15 MB.');
      return;
    }

    setBusy(true);
    try {
      /*
       * Tres pasos: permiso firmado, subida DIRECTA al almacen, y registro del hecho.
       *
       * El archivo no pasa por la API a proposito: un PDF de 15 MB por el mismo canal que las
       * peticiones de negocio castiga a todo lo demas, y ademas obligaria al backend a sostener en
       * memoria el documento mas sensible del expediente.
       */
      const permit = await creditLineApi.createBankStatementUploadUrl(session.customerId, size);

      const file = new File(asset.uri);
      const bytes = file.bytes();
      const response = await fetch(permit.uploadUrl, {
        method: permit.method,
        headers: permit.requiredHeaders,
        body: bytes as unknown as BodyInit,
      });
      if (!response.ok) throw new Error(`No pudimos subir el archivo (${response.status}).`);

      const created = await creditLineApi.submitBankStatement(session.customerId, permit.storageKey);
      setReview(created);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  return (
    <Screen
      footer={
        pending ? undefined : (
          <Button label={review ? 'Subir otro extracto' : 'Subir mi extracto'} onPress={subir} loading={busy} />
        )
      }
    >
      <ScreenHeader
        title="Recalcular mi línea"
        subtitle="Con tu extracto bancario, tu capacidad de pago se calcula con datos reales."
        onBack="auto"
      />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {/* El estado va primero cuando hay uno: es la respuesta a «¿y lo que subí ayer?». */}
      {!loading && review ? (
        <Card style={pending ? styles.pendingCard : undefined}>
          <View style={styles.rowCenter}>
            <Icon
              name={review.status === 'applied' ? 'check' : review.status === 'rejected' ? 'alerta' : 'reloj'}
              size={22}
              tint={
                review.status === 'applied'
                  ? color.feedback.success
                  : review.status === 'rejected'
                    ? color.feedback.danger
                    : color.feedback.warning
              }
            />
            <AtlasText variant="h3">{review.statusLabel}</AtlasText>
          </View>
          <AtlasText variant="body" tone="secondary">
            {review.statusDetail}
          </AtlasText>
          {pending ? (
            <Badge
              label={`Tendrás respuesta antes de las ${new Date(review.promisedBy).toLocaleTimeString('es-BO', {
                hour: '2-digit',
                minute: '2-digit',
              })} del ${new Date(review.promisedBy).toLocaleDateString('es-BO')}`}
              tone="warning"
            />
          ) : null}
          {review.status === 'applied' ? (
            <Button label="Ver mi línea actualizada" variant="secondary" onPress={() => router.push('/(app)/(tabs)')} />
          ) : null}
        </Card>
      ) : null}

      {/*
        Las promesas ANTES del boton, y no en un enlace a la politica.

        Quien va a entregar sus movimientos bancarios decide en esta pantalla, no en un documento
        legal que no va a abrir. Si la confianza no se gana aqui, no se gana.
      */}
      <Card>
        <View style={styles.rowCenter}>
          <Icon name="candado" size={20} tint={color.action.primary} />
          <AtlasText variant="h3">Qué hacemos con tu extracto</AtlasText>
        </View>
        <Divider />
        {PROMESAS.map((promesa, index) => (
          <View key={promesa.title}>
            {index > 0 ? <Gap size="sm" /> : null}
            <View style={styles.promesa}>
              <View style={styles.promesaIcon}>
                <Icon name={promesa.icon} size={18} tint={color.action.primary} />
              </View>
              <View style={styles.flex}>
                <AtlasText variant="bodyStrong">{promesa.title}</AtlasText>
                <AtlasText variant="caption" tone="tertiary">
                  {promesa.detail}
                </AtlasText>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.rowCenter}>
          <Icon name="ayuda" size={20} tint={color.text.secondary} />
          <AtlasText variant="h3">¿Qué pasa después?</AtlasText>
        </View>
        <Divider />
        <AtlasText variant="body" tone="secondary">
          En un máximo de <AtlasText variant="bodyStrong">24 horas</AtlasText> recalculamos tu capacidad de pago con lo que diga tu
          extracto y te avisamos. Tu línea puede subir, quedarse igual o bajar: depende de lo que muestren tus movimientos, no de
          lo que declaraste.
        </AtlasText>
        <AtlasText variant="caption" tone="tertiary">
          Sube el extracto de los últimos 3 meses, en PDF, tal como te lo entrega tu banco. Un PDF editado no sirve: se comprueba.
        </AtlasText>
      </Card>

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pendingCard: { borderColor: color.feedback.warning, borderWidth: 1 },
  promesa: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  promesaIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.sunken,
  },
});
