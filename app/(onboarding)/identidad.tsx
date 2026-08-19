/**
 * Documento de identidad.
 *
 * Tres capturas —anverso, reverso y selfie— con la camara del dispositivo, subida directa al
 * almacenamiento con URL firmada y, recien al final, el paquete de identidad.
 *
 * El numero de documento se envia en claro SOLO para que el registro estatal pueda responder, y el
 * backend no lo persiste. Ademas se envia su hash con la misma convencion del servidor, que es lo
 * que permite comprobar despues que la verificacion corresponde al documento declarado.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import { describeError } from '../../src/api/errors';
import { hashSensitiveText } from '../../src/device/device';
import { uploadEvidence, type EvidenceKind, type PreparedEvidence } from '../../src/features/evidence-upload';
import { useSession } from '../../src/session/session';
import { color, radius, space } from '../../src/theme/tokens';
import { Field } from '../../src/ui/fields';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, ErrorState } from '../../src/ui/primitives';

const STEPS: { kind: EvidenceKind; title: string; hint: string; facing: 'back' | 'front' }[] = [
  { kind: 'identity_front', title: 'Anverso del carnet', hint: 'Que se lea el numero y tu nombre.', facing: 'back' },
  { kind: 'identity_back', title: 'Reverso del carnet', hint: 'Sin reflejos ni sombras.', facing: 'back' },
  { kind: 'selfie', title: 'Selfie', hint: 'Mira de frente, sin lentes oscuros ni gorra.', facing: 'front' },
];

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export default function Identity() {
  const router = useRouter();
  const session = useSession();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState<EvidenceKind | null>(null);
  const [evidence, setEvidence] = useState<Partial<Record<EvidenceKind, PreparedEvidence>>>({});
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuedIn, setIssuedIn] = useState('Santa Cruz');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const activeStep = STEPS.find((step) => step.kind === capturing) ?? null;
  const allCaptured = STEPS.every((step) => evidence[step.kind]);
  const documentOk = documentNumber.trim().length >= 5;
  const expiryOk = isIsoDate(expiresAt) && new Date(`${expiresAt}T23:59:59.999Z`).getTime() > Date.now();
  const canSubmit = allCaptured && documentOk && expiryOk && !busy;

  const capture = async () => {
    if (!cameraRef.current || !session.customerId || !activeStep) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo?.uri) throw new Error('CAPTURE_FAILED');
      const prepared = await uploadEvidence({ customerId: session.customerId, kind: activeStep.kind, localUri: photo.uri });
      setEvidence((current) => ({ ...current, [activeStep.kind]: prepared }));
      setCapturing(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const number = documentNumber.trim();
      await onboardingApi.submitIdentityPackage(session.customerId, {
        identity: {
          documentType: 'ci',
          documentNumberHash: await hashSensitiveText(number),
          documentNumber: number,
          documentLast4: number.slice(-4),
          countryCode: 'BOL',
          issuedIn: issuedIn.trim() || undefined,
          expiresAt,
        },
        evidence: STEPS.map((step) => {
          const prepared = evidence[step.kind]!;
          return {
            evidenceType: step.kind,
            storageKey: prepared.storageKey,
            mimeType: prepared.mimeType,
            sha256Hash: prepared.sha256Hash,
            fileSizeBytes: String(prepared.sizeBytes),
          };
        }),
      });
      await session.refresh();
      router.replace('/(onboarding)/progreso');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  /* ---------------------------------------------------------------- camara */

  if (activeStep) {
    if (!permission?.granted) {
      return (
        <Screen footer={<Button label="Permitir camara" onPress={() => void requestPermission()} />}>
          <ScreenHeader title="Necesitamos tu camara" subtitle="Solo se usa para fotografiar tu documento." onBack={() => setCapturing(null)} />
          <Card>
            <AtlasText variant="body" tone="secondary">
              La foto se sube cifrada y queda asociada unicamente a tu expediente. No accedemos a tu galeria.
            </AtlasText>
          </Card>
          {permission?.canAskAgain === false ? (
            <AtlasText variant="caption" tone="warning">
              El permiso esta bloqueado. Habilitalo desde los ajustes del sistema para continuar.
            </AtlasText>
          ) : null}
        </Screen>
      );
    }

    return (
      <Screen
        scroll={false}
        footer={
          <>
            <Button label="Tomar foto" onPress={capture} loading={busy} disabled={busy} />
            <Button label="Cancelar" variant="ghost" onPress={() => setCapturing(null)} />
          </>
        }
      >
        <ScreenHeader title={activeStep.title} subtitle={activeStep.hint} onBack={() => setCapturing(null)} />
        <View style={styles.cameraFrame}>
          <CameraView ref={cameraRef} style={styles.camera} facing={activeStep.facing} />
        </View>
        {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}
      </Screen>
    );
  }

  /* ------------------------------------------------------------- formulario */

  return (
    <Screen footer={<Button label="Enviar documento" onPress={submit} loading={busy} disabled={!canSubmit} haptic="success" />}>
      <ScreenHeader title="Tu documento" subtitle="Carnet de identidad vigente." onBack="auto" />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      {STEPS.map((step) => {
        const captured = evidence[step.kind];
        return (
          <Card key={step.kind}>
            <View style={styles.stepHeader}>
              <View style={styles.stepText}>
                <AtlasText variant="bodyStrong">{step.title}</AtlasText>
                <AtlasText variant="caption" tone="secondary">
                  {step.hint}
                </AtlasText>
              </View>
              <Badge label={captured ? 'listo' : 'pendiente'} tone={captured ? 'success' : 'warning'} />
            </View>

            {captured ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: captured.localUri }} style={styles.preview} accessibilityLabel={`Vista previa de ${step.title}`} />
                <View style={styles.previewMeta}>
                  <AtlasText variant="caption" tone="tertiary">
                    {(captured.sizeBytes / 1024).toFixed(0)} KB
                  </AtlasText>
                  <AtlasText variant="caption" tone="tertiary" numberOfLines={1}>
                    SHA-256 {captured.sha256Hash.slice(0, 12)}...
                  </AtlasText>
                  <Button label="Repetir" variant="ghost" onPress={() => setCapturing(step.kind)} />
                </View>
              </View>
            ) : (
              <Button label="Tomar foto" variant="secondary" onPress={() => setCapturing(step.kind)} />
            )}
          </Card>
        );
      })}

      <Field
        label="Numero de carnet"
        value={documentNumber}
        onChangeText={setDocumentNumber}
        keyboardType="number-pad"
        required
        error={documentNumber && !documentOk ? 'Revisa el numero de tu carnet.' : null}
      />
      <Field label="Expedido en" value={issuedIn} onChangeText={setIssuedIn} />
      <Field
        label="Fecha de vencimiento"
        value={expiresAt}
        onChangeText={setExpiresAt}
        placeholder="2031-03-10"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        hint="Formato AAAA-MM-DD."
        required
        error={expiresAt && !expiryOk ? 'El documento debe estar vigente.' : null}
      />

      <Gap size="sm" />
      <AtlasText variant="caption" tone="tertiary">
        No guardamos tu numero de carnet en claro: se usa para consultar el registro y se descarta.
      </AtlasText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraFrame: {
    flex: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border.strong,
    backgroundColor: color.surface.secondary,
  },
  camera: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepText: { flex: 1, gap: space.xxs },
  previewRow: { flexDirection: 'row', gap: space.base, alignItems: 'center' },
  preview: { width: 88, height: 66, borderRadius: radius.md, backgroundColor: color.surface.secondary },
  previewMeta: { flex: 1, gap: space.xxs },
});
