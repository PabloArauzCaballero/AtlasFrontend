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
 *
 * ## Dos puertas, una pantalla
 *
 * Vivia sólo en `(app)/extracto-bancario`, y el area `(app)` devuelve a `progreso` a quien no tiene
 * la cuenta activa: el boton «Subir mi extracto» del alta rebotaba y el extracto sólo podia subirse
 * DESPUES de habilitado. Ahora es tambien el ultimo paso del alta (`(onboarding)/extracto`, con
 * `enAlta`): lo mas sensible de toda la lista se pide al final, cuando la persona ya invirtio en el
 * registro, y se puede dejar para despues sin bloquear el envio.
 */
import * as DocumentPicker from "expo-document-picker";
import { borrarCopiaLocal, leerBytes } from "../../device/archivos";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as creditLineApi from "../../api/endpoints/credit-line";
import { describeError } from "../../api/errors";
import { fetchAlAlmacen } from "../../api/almacen";
import { useSession } from "../../session/session";
import { space } from "../../theme/tokens";
import type { IconName } from "../../ui/icons";
import { Gap, Screen, ScreenHeader } from "../../ui/layout";
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
  Stat,
  StatRow,
} from "../../ui/primitives";

/** Lo que se le promete a quien entrega sus movimientos. Cada linea es una obligacion real. */
const PROMESAS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "candado",
    title: "Viaja por una conexión segura",
    detail:
      "El archivo sube directo al almacén de Atlas por una conexión segura. Para subirlo, la app lo lee de una copia temporal en tu teléfono y la borra al terminar.",
  },
  {
    icon: "escudo",
    title: "Solo se usa para calcular tu capacidad de pago",
    detail:
      "Es una entrada del cálculo, nada más. No se comparte con comercios, ni con terceros, ni se usa para publicidad.",
  },
  {
    icon: "ojo-tachado",
    title: "Nadie lo lee por curiosidad",
    detail:
      "El acceso queda registrado y auditado. De tu extracto solo se extraen tus ingresos, tus gastos y los rechazos por fondos insuficientes.",
  },
  {
    icon: "reloj",
    title: "Puedes pedir que lo borremos",
    detail:
      "Una vez recalculada tu línea, el archivo ya no hace falta. Pídelo desde Privacidad, en tu perfil, como solicitud de supresión de datos: queda registrada con un plazo de resolución de 15 días.",
  },
];

/**
 * 10 MB: el tope del worker de extractos del Motor (`BANK_STATEMENT_MAX_UPLOAD_BYTES`). El almacén
 * admite 15, pero un PDF entre 10 y 15 subía bien, el Motor lo rechazaba y el backend lo trataba
 * como Motor caído: reintento eterno y una revisión que nunca avanza. Se corta aquí, con un mensaje.
 */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Que hacer con cada rechazo, dicho como una instruccion.
 *
 * El servidor ya manda una frase explicativa; esto es el TITULO y el paso concreto. Van juntos
 * porque una persona que acaba de ver «no pudimos usarlo» necesita las dos cosas en el mismo golpe
 * de vista: que paso, y que tiene que hacer ahora.
 *
 * Sin esto, los seis motivos del motor llegaban al telefono y se pintaban todos igual — que es
 * exactamente el defecto que se vino a arreglar, sobreviviendo una capa mas adentro.
 */
const RECHAZO: Record<string, { titulo: string; accion: string }> = {
  NO_ES_EXTRACTO: {
    titulo: "Ese archivo no es un extracto",
    accion:
      "Entra a tu banca por internet y descarga el extracto de tu cuenta, no una factura ni un comprobante.",
  },
  EMISOR_NO_RECONOCIDO: {
    titulo: "No es de un banco boliviano",
    accion:
      "Necesitamos el extracto de una cuenta en una entidad supervisada por ASFI.",
  },
  DOCUMENTO_MANIPULADO: {
    titulo: "Ese PDF no es el original",
    accion:
      "Descarga el extracto otra vez y súbelo sin abrirlo ni volver a guardarlo.",
  },
  PERIODO_INSUFICIENTE: {
    titulo: "Faltan meses",
    accion:
      "En tu banca por internet elige el periodo de los últimos 3 meses completos y vuelve a subirlo.",
  },
  // El vencido es la contraria del anterior: no le faltan meses hacia atras, le falta el presente.
  // Con un solo motivo, a quien sube doce meses cerrados en marzo se le pedia «mas meses».
  EXTRACTO_VENCIDO: {
    titulo: "Ese extracto ya venció",
    accion:
      "Su último movimiento es de hace demasiado. Descarga el extracto hasta la fecha de hoy y vuelve a subirlo.",
  },
  ARCHIVO_ILEGIBLE: {
    titulo: "No pudimos abrir el archivo",
    accion:
      "Vuelve a descargarlo de tu banca por internet, sin contraseña, y súbelo de nuevo.",
  },
  LECTURA_INSUFICIENTE: {
    titulo: "No pudimos leerlo completo",
    accion:
      "Sube el extracto completo de los últimos 3 meses, tal como lo descargas de tu banco.",
  },
};

/** Cifras en bolivianos, con el formato que la persona reconoce en su banca. */
function bolivianos(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PantallaExtracto({ enAlta = false }: { enAlta?: boolean }) {
  const router = useRouter();
  const alEnvio = () => router.push("/(onboarding)/revision");
  const session = useSession();
  const [review, setReview] =
    useState<creditLineApi.BankStatementReview | null>(null);
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

  const pending =
    review?.status === "received" || review?.status === "processing";

  const subir = async () => {
    if (!session.customerId || busy) return;
    setError(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    const size = asset.size ?? 0;
    if (size <= 0 || size > MAX_BYTES) {
      Alert.alert(
        "Archivo no válido",
        "El extracto debe ser un PDF de menos de 10 MB.",
      );
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
      const permit = await creditLineApi.createBankStatementUploadUrl(
        session.customerId,
        size,
      );

      // `bytes()` es ASÍNCRONO en expo-file-system 57 (la síncrona es `bytesSync`). Sin el `await` se
      // mandaba una Promise como cuerpo: el PDF nunca llegaba y el `content-length` firmado no cuadraba.
      const bytes = await leerBytes(asset.uri);
      if (bytes.length !== size) {
        throw new Error('El archivo cambió de tamaño mientras se leía. Vuelve a elegirlo.');
      }
      const response = await fetchAlAlmacen(permit.uploadUrl, {
        method: permit.method,
        headers: permit.requiredHeaders,
        body: bytes as unknown as BodyInit,
      });
      if (!response.ok)
        throw new Error(`No pudimos subir el archivo (${response.status}).`);

      const created = await creditLineApi.submitBankStatement(
        session.customerId,
        permit.storageKey,
      );
      setReview(created);
    } catch (caught) {
      setError(caught);
    } finally {
      // La copia temporal ya cumplió: no se deja el extracto en la caché del teléfono.
      borrarCopiaLocal(asset.uri);
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  return (
    <Screen
      footer={
        enAlta ? (
          /*
            En el alta el extracto no bloquea el envío: sin él, la capacidad se calcula con lo
            declarado. Subido (aunque siga en revisión), lo que toca es seguir, no esperar.
          */
          <View style={styles.pie}>
            {review && review.status !== "rejected" ? (
              <Button label="Continuar" onPress={alEnvio} haptic="success" />
            ) : (
              <Button label={review ? "Subir otro extracto" : "Subir mi extracto"} bitacora="subir_extracto" onPress={subir} loading={busy} />
            )}
            {review && review.status !== "rejected" ? null : (
              <Button label="Lo subo después" variant="ghost" bitacora="extracto_despues" onPress={alEnvio} disabled={busy} />
            )}
          </View>
        ) : pending ? undefined : (
          <Button
            label={review ? "Subir otro extracto" : "Subir mi extracto"}
            onPress={subir}
            loading={busy}
          />
        )
      }
    >
      <ScreenHeader
        title={enAlta ? "Tu extracto bancario" : "Recalcular mi línea"}
        subtitle={
          enAlta
            ? "Último paso. Con tus movimientos reales calculamos cuánto puedes pagar cómodamente."
            : "Con tu extracto bancario, tu capacidad de pago se calcula con datos reales."
        }
        onBack="auto"
      />

      {described ? (
        <ErrorState
          title={described.title}
          detail={described.detail}
          reference={described.reference}
        />
      ) : null}

      {/* El estado va primero cuando hay uno: es la respuesta a «¿y lo que subí ayer?». */}
      {!loading && review ? (
        <Card
          tone={
            review.status === "applied"
              ? "success"
              : review.status === "rejected"
                ? "danger"
                : "warning"
          }
        >
          <CardHeader
            icon={
              review.status === "applied"
                ? "check"
                : review.status === "rejected"
                  ? "alerta"
                  : "reloj"
            }
            iconTone={
              review.status === "applied"
                ? "success"
                : review.status === "rejected"
                  ? "danger"
                  : "warning"
            }
            eyebrow="Tu extracto"
            title={review.statusLabel}
            divider={false}
          />
          <AtlasText variant="body" tone="secondary">
            {review.statusDetail}
          </AtlasText>

          {/*
            El paso concreto va SEPARADO de la explicacion y con su propio peso.

            La explicacion dice que paso; esto dice que hacer. Fundirlas en un parrafo hace que la
            instruccion se pierda al final de la frase, que es donde deja de leerse.
          */}
          {review.status === "rejected" && review.rejectionCategory ? (
            <>
              <Divider />
              <AtlasText variant="h3">
                {RECHAZO[review.rejectionCategory]?.titulo ??
                  "No pudimos usarlo"}
              </AtlasText>
              <AtlasText variant="body" tone="secondary">
                {RECHAZO[review.rejectionCategory]?.accion ?? ""}
              </AtlasText>
            </>
          ) : null}

          {/*
            Lo que el extracto demostro, cuando se pudo medir.

            Es SU dinero medido con SUS movimientos, y ver la resta es lo que convierte un limite en
            algo que se entiende en vez de un veredicto. No viaja ningun movimiento individual —eso
            es justo lo que se le prometio que no circula— sino las cifras del calculo.
          */}
          {review.capacity ? (
            <>
              <Divider />
              <StatRow>
                <Stat
                  label="Ingreso mensual"
                  value={bolivianos(review.capacity.monthlyIncome)}
                  hint={`mediana de ${String(review.capacity.monthsAnalyzed ?? 3)} meses`}
                />
                <Stat
                  label="Cuota que sostienes"
                  value={bolivianos(review.capacity.maxAffordableInstallment)}
                  hint="al mes, con margen"
                  tone="success"
                />
              </StatRow>
              <KeyValue
                label="Gastos que no puedes dejar de pagar"
                value={bolivianos(review.capacity.committedExpenses)}
                numeric
              />
              <KeyValue
                label="Cuotas y seguros que ya pagas"
                value={bolivianos(review.capacity.monthlyObligations)}
                numeric
              />
              {review.institutionName ? (
                <KeyValue label="Banco" value={review.institutionName} />
              ) : null}
              {review.capacity.reasons.slice(0, 3).map((motivo) => (
                <AtlasText key={motivo.code} variant="caption" tone="tertiary">
                  {motivo.message}
                </AtlasText>
              ))}
            </>
          ) : null}

          {pending ? (
            <Badge
              label={`Tendrás respuesta antes de las ${new Date(
                review.promisedBy,
              ).toLocaleTimeString("es-BO", {
                hour: "2-digit",
                minute: "2-digit",
              })} del ${new Date(review.promisedBy).toLocaleDateString("es-BO")}`}
              tone="warning"
            />
          ) : null}
          {review.status === "applied" && !enAlta ? (
            <Button
              label="Ver mi línea actualizada"
              variant="secondary"
              onPress={() => router.push("/(app)/(tabs)")}
            />
          ) : null}
        </Card>
      ) : null}

      {/*
        Las promesas ANTES del boton, y no en un enlace a la politica.

        Quien va a entregar sus movimientos bancarios decide en esta pantalla, no en un documento
        legal que no va a abrir. Si la confianza no se gana aqui, no se gana.
      */}
      <Card>
        <CardHeader icon="candado" title="Qué hacemos con tu extracto" />
        {PROMESAS.map((promesa) => (
          <View key={promesa.title} style={styles.promesa}>
            <IconChip name={promesa.icon} />
            <View style={styles.flex}>
              <AtlasText variant="title">{promesa.title}</AtlasText>
              <AtlasText variant="caption" tone="tertiary">
                {promesa.detail}
              </AtlasText>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <CardHeader
          icon="ayuda"
          iconTone="neutral"
          title="¿Qué pasa después?"
        />
        <AtlasText variant="body" tone="secondary">
          En un máximo de <AtlasText variant="bodyStrong">24 horas</AtlasText>{" "}
          recalculamos tu capacidad de pago con lo que diga tu extracto. Hoy no
          te enviamos un aviso al terminar: vuelve a esta pantalla para ver el
          resultado. Tu línea puede subir, quedarse igual o bajar: depende de lo
          que muestren tus movimientos, no de lo que declaraste.
        </AtlasText>
        <AtlasText variant="caption" tone="tertiary">
          Sube el extracto de los{" "}
          <AtlasText variant="captionStrong">
            últimos 3 meses completos
          </AtlasText>
          , en PDF, tal como te lo entrega tu banco. Pedimos 3 meses porque con
          menos, un mes bueno o uno malo desvía el cálculo entero. Un PDF
          editado no sirve: se comprueba.
        </AtlasText>
      </Card>

      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pie: { gap: space.xs },
  flex: { flex: 1, gap: space.xxs },
  promesa: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
});
