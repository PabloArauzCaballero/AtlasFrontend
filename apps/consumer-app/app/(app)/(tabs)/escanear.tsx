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
import { resolveMerchantQr } from '../../../src/api/endpoints/loans';
import { DEMO_TOKEN, REVOKED_DEMO_TOKEN } from '../../../src/sandbox/fixtures';
import { useSandbox } from '../../../src/sandbox/store';
import { DataSourceBadge } from '../../../src/ui/brand';
import { firstBlocker } from '../../../src/ui/blocked';
import { CameraFrame } from '../../../src/ui/camera-frame';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../../src/ui/layout';
import { AtlasText, Button, Card, CardHeader, ErrorState } from '../../../src/ui/primitives';

const REJECTION_COPY: Record<string, { title: string; detail: string }> = {
  QR_NOT_RECOGNIZED: {
    title: 'Este QR no es de Atlas',
    detail: 'Pide al comercio el código QR de Atlas que está pegado en la caja. El QR del banco se usa después.',
  },
  QR_REVOKED: {
    title: 'QR dado de baja',
    detail: 'Este código fue revocado por seguridad. Pide al comercio el código vigente.',
  },
  QR_EXPIRED: { title: 'QR vencido', detail: 'Este código ya no está activo. Pide al comercio el código vigente.' },
};

export default function ScanScreen() {
  const router = useRouter();
  const sandbox = useSandbox();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [rejection, setRejection] = useState<string | null>(null);
  // Un QR permanece en cuadro varios fotogramas: sin este cerrojo se abririan varias sesiones.
  const locked = useRef(false);

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
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setRejection(code);
        release(1500);
      };

      let resolved: Awaited<ReturnType<typeof resolveMerchantQr>> | null = null;
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
          /*
           * El backend manda el codigo en el mensaje del error. Si no se reconoce ninguno, se trata
           * como QR no reconocido: es el mensaje con salida —«pide al comercio el codigo vigente»—
           * y el unico honesto cuando no sabemos por que fallo.
           */
          const raw = error instanceof Error ? error.message : '';
          const known = Object.keys(REJECTION_COPY).find((code) => raw.includes(code));
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

  const copy = rejection ? REJECTION_COPY[rejection] : null;

  return (
    <Screen>
      <Gap size="sm" />
      <ScreenHeader
        title="Escanear"
        subtitle="Apunta al código QR de Atlas del comercio."
        action={<DataSourceBadge />}
      />

      {copy ? <ErrorState title={copy.title} detail={copy.detail} /> : null}

      {permission?.granted ? (
        <CameraFrame ratio={1}>
          {isFocused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => void handleToken(data)}
            />
          ) : null}
        </CameraFrame>
      ) : (
        <Card>
          <CardHeader
            icon="camara"
            title="Necesitamos tu cámara"
            detail="Solo la usamos mientras escaneas. No grabamos video ni guardamos imágenes."
          />
          <Button label="Permitir cámara" onPress={() => void requestPermission()} />
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
          detail="Si el QR no se lee, el comercio puede dictarte el código que aparece debajo del QR."
        />
        <Field
          label="Código del comercio"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="none"
          autoCorrect={false}
          ayuda="El código impreso debajo del QR de la caja, de al menos ocho caracteres. Pídeselo al comercio si la cámara no lee el QR; identifica la caja exacta donde estás comprando."
        />
        <Button
          label="Continuar"
          variant="secondary"
          disabled={manual.trim().length < 8}
          blockedReason={firstBlocker([
            [manual.trim().length >= 8, 'El código del comercio tiene al menos 8 caracteres.'],
          ])}
          onPress={() => {
            locked.current = false;
            handleToken(manual.trim());
          }}
        />
      </Card>

      {/*
        Los codigos de demostracion existen SOLO en sandbox, y hasta ahora la tarjeta se pintaba
        siempre: en una compilacion contra el backend real, la pantalla de escaneo terminaba con dos
        botones que no llevan a ningun sitio y con un rotulo que dice, encima, que no estan
        disponibles. Es la misma condicion que ya gobierna que esos tokens se acepten mas arriba.
      */}
      {isSandboxPurchase ? (
      <Card>
        <CardHeader
          icon="chispa"
          iconTone="neutral"
          title="Códigos de prueba"
          detail="Disponibles solo en el entorno sandbox, para recorrer el flujo sin un QR físico."
        />
        <Button
          label="Comercio válido"
          variant="ghost"
          onPress={() => {
            locked.current = false;
            handleToken(DEMO_TOKEN);
          }}
        />
        <Button
          label="Comercio con QR revocado"
          variant="ghost"
          onPress={() => {
            locked.current = false;
            handleToken(REVOKED_DEMO_TOKEN);
          }}
        />
      </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
