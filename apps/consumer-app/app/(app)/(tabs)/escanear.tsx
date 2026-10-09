/**
 * Escaneo del QR interno del comercio.
 *
 * El QR NO lleva datos del comercio ni de la cuenta bancaria: lleva un token opaco. La app lo envia
 * tal cual y el servidor resuelve organizacion, sucursal y caja. Por eso fotografiar un QR ajeno no
 * permite cambiar a quien se le paga.
 *
 * Este QR tampoco mueve dinero: el QR bancario aparece despues, ya con el monto confirmado.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { AtlasApiError } from '../../../src/api/errors';
import { resolveMerchantQr } from '../../../src/api/endpoints/loans';
import { rechazoVigente, type RechazoDeQr } from '../../../src/features/qr-rechazado';
import { DEMO_TOKEN, REVOKED_DEMO_TOKEN } from '../../../src/sandbox/fixtures';
import { useSandbox } from '../../../src/sandbox/store';
import { firstBlocker } from '../../../src/ui/blocked';
import { CameraFrame } from '../../../src/ui/camera-frame';
import { CodigoCajaField } from '../../../src/ui/codigo-caja-field';
import { LARGO_CODIGO_CAJA } from '../../../src/features/codigo-caja';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Button, Card, CardHeader, ErrorState } from '../../../src/ui/primitives';
import { useCopy } from '../../../src/features/use-contenido-remoto';
import { marca } from '../../../src/theme/tokens';

/** Qué clave del catálogo explica cada rechazo del QR (el texto vive en `copy-catalog.ts`). */
const REJECTION_KEYS = {
  QR_NOT_RECOGNIZED: 'escanear.qr.no_reconocido',
  QR_REVOKED: 'escanear.qr.revocado',
  QR_EXPIRED: 'escanear.qr.vencido',
  /* No son rechazos del QR sino del camino hasta el servidor: el QR pudo ser perfecto. */
  SERVICE_UNREACHABLE: 'escanear.qr.sin_conexion',
  SESSION_EXPIRED: 'escanear.qr.sesion',
} as const;

/**
 * Por qué falló la consulta, cuando NO es que el servidor haya dicho «ese QR no vale».
 *
 * Antes cualquier error se contaba como «Este QR no es de Atlas»: con la red caída o el API
 * redesplegándose, un QR válido salía acusado de falso, y además se anotaba como rechazado, con lo
 * que la cámara lo ignoraba diez segundos. La persona se quedaba apuntando a un QR bueno sin que
 * nada le dijera que lo que fallaba era la conexión.
 */
function fallaDelCamino(error: unknown): 'SERVICE_UNREACHABLE' | 'SESSION_EXPIRED' | null {
  if (!(error instanceof AtlasApiError)) return null;
  if (error.kind === 'auth') return 'SESSION_EXPIRED';
  if (error.fromGateway || ['network', 'timeout', 'unavailable', 'server'].includes(error.kind)) return 'SERVICE_UNREACHABLE';
  return null;
}

export default function ScanScreen() {
  const t = useCopy();
  const router = useRouter();
  const sandbox = useSandbox();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [rejection, setRejection] = useState<string | null>(null);
  // Mientras el servidor confirma el código la pantalla lo dice: sin esto, leer un QR no hacía NADA visible.
  const [verificando, setVerificando] = useState(false);
  // El código técnico de la respuesta (p. ej. «404 QR_NOT_RECOGNIZED»), para que quien prueba y soporte vean POR QUÉ.
  const [referencia, setReferencia] = useState<string | null>(null);
  // Un QR permanece en cuadro varios fotogramas: sin este cerrojo se abririan varias sesiones.
  const locked = useRef(false);
  // Y sin este, un QR rechazado se reenviaria cada 1,5 s mientras siga delante. Ver `qr-rechazado.ts`.
  const ultimoRechazo = useRef<RechazoDeQr | null>(null);

  /*
   * La camara SOLO existe mientras esta pestana esta en pantalla.
   *
   * `CameraView` monta una superficie nativa que sigue capturando aunque la pestana quede detras:
   * al volver, esa superficie y la nueva se pisan y el visor aparece en negro, congelado o encima
   * del contenido de otra pantalla. Es el defecto que se ve como «la vista se buguea».
   *
   * Desmontarla al perder el foco tambien libera la camara para el paso de identidad, que la usa
   * para el carnet: dos superficies pidiendo el mismo sensor no es un problema de rendimiento, es
   * una de las dos sin imagen.
   */
  const isFocused = useIsFocused();

  /*
   * Y al volver se suelta el cerrojo. Sin esto, quien escanea, vuelve atras y lo intenta otra vez
   * se encuentra una camara que ya no reacciona: el cerrojo quedo echado del intento anterior y no
   * hay nada en pantalla que explique por que no pasa nada.
   */
  useEffect(() => {
    if (isFocused) {
      locked.current = false;
      ultimoRechazo.current = null;
      setRejection(null);
    }
  }, [isFocused]);

  /**
   * Quien decide de que comercio es este QR es el SERVIDOR.
   *
   * Antes lo resolvia `sandbox.scan` en el telefono. Un identificador de comercio que decide el
   * dispositivo no identifica a nadie: basta editar la respuesta local para comprar «en» cualquier
   * comercio, y de ese identificador cuelga despues la categoria del gasto y quien tiene que
   * aceptar la operacion.
   *
   * `merchant-qr/resolve` comprueba tres cosas que aqui no se pueden comprobar: que el terminal
   * existe, que esta ACTIVO y que el expediente del comercio esta aprobado. Los tres codigos de
   * rechazo que devuelve son los que esta pantalla ya sabe explicar.
   *
   * El motor local sigue llevando la SESION de compra —el dominio V3 no existe todavia en el
   * backend—, pero ya no decide a quien se le paga.
   */
  const handleToken = useCallback(
    async (token: string) => {
      if (locked.current) return;
      locked.current = true;

      const release = (delayMs: number) =>
        setTimeout(() => {
          locked.current = false;
        }, delayMs);

      const reject = (code: string) => {
        ultimoRechazo.current = { token: token.trim(), en: Date.now() };
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setRejection(code);
        release(1500);
      };

      let resolved: Awaited<ReturnType<typeof resolveMerchantQr>> | null = null;
      setRejection(null);
      setReferencia(null);
      setVerificando(true);
      void Haptics.selectionAsync();
      try {
        resolved = await resolveMerchantQr(token.trim());
      } catch (error) {
        /*
         * Los dos codigos de demostracion no existen como terminal en el backend, y no deberian:
         * son fixtures del motor local para recorrer el flujo sin un QR fisico. Se les deja pasar
         * SOLO cuando la compra corre en sandbox, que es donde esos botones estan disponibles. Un
         * QR real que el servidor rechace se rechaza siempre, tambien en sandbox.
         */
        const isDemoFixture = token === DEMO_TOKEN || token === REVOKED_DEMO_TOKEN;
        if (!(isSandboxPurchase && isDemoFixture)) {
          setVerificando(false);
          if (error instanceof AtlasApiError) setReferencia(`${error.status ?? 'sin respuesta'} · ${error.code}`);
          const delCamino = fallaDelCamino(error);
          if (delCamino) {
            // No se anota como rechazo: el mismo QR, un segundo después, puede funcionar.
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setRejection(delCamino);
            release(1500);
            return;
          }
          /*
           * El backend manda el codigo en el mensaje del error. Si no se reconoce ninguno, se trata
           * como QR no reconocido: es el mensaje con salida —«pide al comercio el codigo vigente»—
           * y el unico honesto cuando no sabemos por que fallo.
           */
          const raw = error instanceof Error ? error.message : '';
          const known = (['QR_NOT_RECOGNIZED', 'QR_REVOKED', 'QR_EXPIRED'] as const).find(
            (code) => raw.includes(code) || (error instanceof AtlasApiError && error.code === code),
          );
          reject(known ?? 'QR_NOT_RECOGNIZED');
          return;
        }
      }

      /*
       * Un comercio que el servidor SI reconocio abre la sesion con los datos del expediente. Antes
       * se volvia a preguntar por el token a `sandbox.scan`, que solo conoce los dos QR de
       * demostracion: un serial real resolvia bien y moria aqui con «QR no reconocido», acusando al
       * comercio de un limite del motor local.
       *
       * `sandbox.scan` queda para los codigos de demostracion, que son los unicos que el servidor
       * no reconoce y aun asi deben poder recorrer el flujo.
       */
      setVerificando(false);
      const sessionId = resolved ? sandbox.scanResolved(resolved).sessionId : null;
      if (!sessionId) {
        const result = sandbox.scan(token);
        if (!result.ok) {
          reject(result.rejection.code);
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRejection(null);
        router.push(`/(app)/compra/monto?sessionId=${result.sessionId}`);
        release(1200);
        return;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRejection(null);
      router.push(`/(app)/compra/monto?sessionId=${sessionId}`);
      release(1200);
    },
    [router, sandbox],
  );

  const rejectionKey = rejection ? REJECTION_KEYS[rejection as keyof typeof REJECTION_KEYS] : undefined;
  const copy = rejectionKey ? { title: t.titulo(rejectionKey), detail: t.texto(rejectionKey) } : null;

  return (
    <Screen>
      <Gap size="sm" />
      <ScreenHeader title="Escanear" subtitle={`Apunta al código QR de ${marca.nombre} del comercio.`} />

      {verificando ? (
        <Card>
          <CardHeader icon="camara" title="Verificando el código…" detail={`Estamos confirmando el comercio con ${marca.nombre}.`} />
        </Card>
      ) : null}

      {copy ? <ErrorState title={copy.title} detail={copy.detail} reference={referencia} /> : null}

      {permission?.granted ? (
        <CameraFrame ratio={1}>
          {isFocused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (rechazoVigente(ultimoRechazo.current, data, Date.now())) return;
                void handleToken(data);
              }}
            />
          ) : null}
        </CameraFrame>
      ) : (
        <Card>
          <CardHeader
            icon="camara"
            title={t.titulo('escanear.camara')}
            detail={t.texto('escanear.camara')}
          />
          <Button label="Permitir cámara" onPress={() => requestPermission()} />
          {permission?.canAskAgain === false ? (
            <AtlasText variant="caption" tone="warning">
              El permiso está bloqueado. Habilitalo desde los ajustes del sistema o ingresa el código manualmente.
            </AtlasText>
          ) : null}
        </Card>
      )}

      <Card>
        <CardHeader
          icon="editar"
          iconTone="neutral"
          title="Ingresar el código a mano"
          detail="Si el QR no se lee, escribe el código que está debajo."
        />
        <CodigoCajaField
          label="Código de la caja"
          value={manual}
          onChangeText={setManual}
          onComplete={(codigo) => {
            locked.current = false;
            void handleToken(codigo);
          }}
          ayuda="El código de 8 caracteres impreso debajo del QR de la caja (por ejemplo K7M2-9QXD). Sólo lleva letras y números sin confusión: no hay 0, O, 1, I, L, U ni V. Pídeselo al comercio si la cámara no lee el QR; identifica la caja exacta donde estás comprando."
        />
        <Button
          label="Continuar"
          variant="secondary"
          disabled={manual.length < LARGO_CODIGO_CAJA}
          blockedReason={firstBlocker([[manual.length >= LARGO_CODIGO_CAJA, 'El código de la caja tiene 8 caracteres.']])}
          onPress={() => {
            locked.current = false;
            void handleToken(manual);
          }}
        />
      </Card>

    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
