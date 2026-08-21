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
import { StyleSheet, View } from 'react-native';
import { isSandboxPurchase } from '../../../src/api/config';
import { resolveMerchantQr } from '../../../src/api/endpoints/loans';
import { DEMO_TOKEN, REVOKED_DEMO_TOKEN } from '../../../src/sandbox/fixtures';
import { useSandbox } from '../../../src/sandbox/store';
import { color, radius, space } from '../../../src/theme/tokens';
import { DataSourceBadge } from '../../../src/ui/brand';
import { firstBlocker } from '../../../src/ui/blocked';
import { Field } from '../../../src/ui/fields';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Button, Card, ErrorState } from '../../../src/ui/primitives';

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

      try {
        await resolveMerchantQr(token.trim());
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

      const result = sandbox.scan(token);
      if (!result.ok) {
        reject(result.rejection.code);
        return;
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRejection(null);
      router.push(`/(app)/compra/monto?sessionId=${result.sessionId}`);
      release(1200);
    },
    [router, sandbox],
  );

  const copy = rejection ? REJECTION_COPY[rejection] : null;

  return (
    <Screen>
      <Gap size="sm" />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AtlasText variant="h1">Escanear</AtlasText>
          <AtlasText variant="body" tone="secondary">
            Apunta al código QR de Atlas del comercio.
          </AtlasText>
        </View>
        <DataSourceBadge />
      </View>

      {copy ? <ErrorState title={copy.title} detail={copy.detail} /> : null}

      {permission?.granted ? (
        <View style={styles.cameraFrame}>
          {isFocused ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => void handleToken(data)}
            />
          ) : null}
          <View style={styles.reticle} pointerEvents="none" />
        </View>
      ) : (
        <Card>
          <AtlasText variant="bodyStrong">Necesitamos tu camara</AtlasText>
          <AtlasText variant="caption" tone="secondary">
            Solo la usamos mientras escaneas. No grabamos video ni guardamos imagenes.
          </AtlasText>
          <Button label="Permitir camara" onPress={() => void requestPermission()} />
          {permission?.canAskAgain === false ? (
            <AtlasText variant="caption" tone="warning">
              El permiso está bloqueado. Habilitalo desde los ajustes del sistema o ingresa el código manualmente.
            </AtlasText>
          ) : null}
        </Card>
      )}

      <Card>
        <AtlasText variant="bodyStrong">Ingresar el código a mano</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          Si el QR no se lee, el comercio puede dictarte el código que aparece debajo del QR.
        </AtlasText>
        <Field label="Código del comercio" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} />
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

      <Card>
        <AtlasText variant="bodyStrong">Códigos de prueba</AtlasText>
        <AtlasText variant="caption" tone="secondary">
          Disponibles solo en el entorno sandbox, para recorrer el flujo sin un QR fisico.
        </AtlasText>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerText: { flex: 1, gap: space.xxs },
  cameraFrame: {
    height: 300,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border.strong,
    backgroundColor: color.surface.secondary,
  },
  camera: { flex: 1 },
  reticle: {
    position: 'absolute',
    top: 60,
    bottom: 60,
    left: 60,
    right: 60,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: color.action.primary,
  },
});
