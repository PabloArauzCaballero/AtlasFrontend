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
import { StyleSheet, type ScrollView } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import * as identityEngine from '../../src/api/endpoints/identity-engine';
import { describeError } from '../../src/api/errors';
import { CARNET_DE_PRUEBA, capturaSimulada, estaDisponible as hayCamaraDePrueba } from '../../src/device/camara-de-prueba';
import { hashSensitiveText } from '../../src/device/device';
import { leerBase64, uploadEvidence, type IdentityEvidenceKind as EvidenceKind, type PreparedEvidence } from '../../src/features/evidence-upload';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { DateField, IconField, SelectField } from '../../src/ui/form-controls';
import { DEPARTAMENTOS } from '../../src/features/geografia';
import { Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, ErrorState } from '../../src/ui/primitives';
import { CameraFrame } from '../../src/ui/camera-frame';
import { ImageSlides, type ImageSlide } from '../../src/ui/image-slides';
import { StepHeader } from '../../src/ui/step-header';
import { TRUST_IDENTIDAD } from '../../src/features/trust-copy';
import { TrustCard } from '../../src/ui/trust-card';
import { bitacora } from '../../src/features/bitacora';
import type { Captura } from '../../src/features/bitacora/tipos';

const STEPS: { kind: EvidenceKind; title: string; hint: string; facing: 'back' | 'front' }[] = [
  { kind: 'identity_front', title: 'Anverso del carnet', hint: 'Que se lea el número y tu nombre.', facing: 'back' },
  { kind: 'identity_back', title: 'Reverso del carnet', hint: 'Sin reflejos ni sombras.', facing: 'back' },
  { kind: 'selfie', title: 'Selfie', hint: 'Mira de frente, sin lentes oscuros ni gorra.', facing: 'front' },
];

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Que captura es cada evidencia, para la bitacora del alta. */
const CAPTURA_DE: Record<EvidenceKind, Captura> = { identity_front: 'carnet_frente', identity_back: 'carnet_reverso', selfie: 'selfie' };

/** Un carnet vigente vence, como mínimo, mañana. El calendario lo impide por construcción. */
const manana = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
})();

/** Con qué año abre el calendario cuando aún no hay fecha: los carnets suelen durar cinco años. */
const dentroDeCincoAnos = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d;
})();

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

  /*
    Las tres capturas se nombran una a una. Decir "faltan fotos" obliga a repasar las tres tarjetas
    para descubrir cual, cuando la pantalla ya sabe exactamente cual es.
  */
  const blockedReason = firstBlocker([
    [Boolean(evidence.identity_front), 'Falta la foto del anverso del carnet.'],
    [Boolean(evidence.identity_back), 'Falta la foto del reverso del carnet.'],
    [Boolean(evidence.selfie), 'Falta la selfie.'],
    [documentOk, 'Falta el número de tu carnet.'],
    [isIsoDate(expiresAt), 'Falta la fecha de vencimiento del carnet, en formato AAAA-MM-DD.'],
    [expiryOk, 'El carnet está vencido: solo aceptamos documentos vigentes.'],
  ]);

  const capture = async () => {
    if (!cameraRef.current || !session.customerId || !activeStep) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo?.uri) throw new Error('CAPTURE_FAILED');
      bitacora.captura(CAPTURA_DE[activeStep.kind], evidence[activeStep.kind] ? 'repite' : 'toma');
      const prepared = await uploadEvidence({ customerId: session.customerId, kind: activeStep.kind, localUri: photo.uri });
      setEvidence((current) => ({ ...current, [activeStep.kind]: prepared }));
      setCapturing(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  /*
    Las tres capturas y los datos del carnet, sin camara delante. Solo en desarrollo.

    Toma el mismo camino que una foto de verdad: cada imagen se sube con su URL firmada y entra al
    estado por `setEvidence`, asi que lo que se prueba despues —el paquete, el motor, la pantalla de
    revision— es el codigo real y no una rama de mentira. Lo unico que cambia es de donde salen los
    bytes. Ver `device/camara-de-prueba.ts`.

    Los campos tecleados se rellenan con lo que el carnet lleva IMPRESO: el motor lee la tarjeta, y
    un numero distinto del que ve seria una discrepancia de verdad, detectada de verdad.
  */
  const usarCarnetDePrueba = async () => {
    if (!session.customerId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const subidas: Partial<Record<EvidenceKind, PreparedEvidence>> = {};
      // En serie y no en paralelo: son tres subidas firmadas y el backend cuenta los intentos.
      for (const step of STEPS) {
        const localUri = await capturaSimulada(step.kind);
        subidas[step.kind] = await uploadEvidence({ customerId: session.customerId, kind: step.kind, localUri });
      }
      setEvidence((current) => ({ ...current, ...subidas }));
      setDocumentNumber(CARNET_DE_PRUEBA.numero);
      setExpiresAt(CARNET_DE_PRUEBA.expiraEn);
      setIssuedIn(CARNET_DE_PRUEBA.emitidoEn);
      setCapturing(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  /*
    Le pregunta al MOTOR si esta persona es quien dice ser.

    ## Por que no bloquea el envio

    El expediente tiene que quedar guardado pase lo que pase con esta llamada: las fotos ya estan
    subidas y el numero declarado, y perder eso porque el motor no conteste seria hacerle repetir
    todo a quien menos culpa tiene. Si el motor no esta disponible, el documento sigue su camino
    normal —revision humana—, que es exactamente lo que ocurria antes de que esta pieza existiera.

    ## Por que aqui ya NO se espera al veredicto

    Se esperaba: se preguntaba en bucle hasta ocho veces y el resultado se pintaba en una tarjeta al
    pie de este formulario. Tenia dos defectos y el segundo es el grave.

    El primero es que ocho segundos de espera con el boton bloqueado es una pantalla colgada para el
    caso mayoritario, que se resuelve en dos.

    El segundo es que un caso derivado a revision humana tarda HORAS, asi que la tarjeta se quedaba
    en «lo esta revisando una persona» y esa frase moria con la pantalla: quien cerraba la app no
    tenia forma de volver a preguntarlo. El estado de un tramite que dura horas necesita una
    direccion propia, y ahora la tiene (`verificacion.tsx`).

    Aqui solo se ARRANCA y se devuelve el identificador. Quien espera es la pantalla siguiente, que
    ademas puede volver a consultarse mañana.
  */
  const arrancarVerificacion = async (customerId: string): Promise<string | null> => {
    try {
      const [frente, reverso, selfie] = await Promise.all([
        leerBase64(evidence.identity_front!.localUri),
        leerBase64(evidence.identity_back!.localUri),
        leerBase64(evidence.selfie!.localUri),
      ]);
      const vista = await identityEngine.startIdentityVerification({
        documentFront: frente,
        documentBack: reverso,
        selfie,
        customerId,
      });
      return vista.verificationId;
    } catch {
      // Silencio deliberado: el veredicto es informacion adicional, no el resultado del paso. Sin
      // motor, el documento sigue su camino normal y el registro continua.
      return null;
    }
  };

  const submit = async () => {
    if (!session.customerId || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const number = documentNumber.trim();
      const documentNumberHash = await hashSensitiveText(number);
      await bitacora.medirEnvio(() => onboardingApi.submitIdentityPackage(session.customerId!, {
        identity: {
          documentType: 'ci',
          documentNumberHash,
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
            // Las capturas del carnet son siempre fotos; el tipo ancho es de las evidencias de apoyo.
            mimeType: prepared.mimeType as onboardingApi.IdentityEvidence['mimeType'],
            sha256Hash: prepared.sha256Hash,
            fileSizeBytes: String(prepared.sizeBytes),
          };
        }),
      }));

      // El expediente ya esta guardado: ahora la pregunta. En este orden porque el registro no
      // puede depender de que el motor conteste.
      const verificationId = await arrancarVerificacion(session.customerId);
      await session.refresh();

      /*
        Se sale SIEMPRE de esta pantalla, y a donde se sale depende de si hay caso que seguir.

        Con caso, a la pantalla de estado: es donde se espera el veredicto y donde estan las dos
        salidas del rechazo —reintentar y pedir ayuda—. Sin caso —el motor no contesto— al indice del
        registro, porque no hay nada que consultar y dejar a alguien mirando una pantalla de estado
        vacia seria peor que no enseñarsela.
      */
      router.replace(
        verificationId ? `/(onboarding)/verificacion?id=${encodeURIComponent(verificationId)}` : '/(onboarding)/progreso',
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const described = error ? describeError(error) : null;

  // El fallo se pinta arriba y el boton esta abajo: hay que llevar la vista hasta el.

  const scroll = useRef<ScrollView>(null);

  useScrollToError(error, scroll);

  /* ---------------------------------------------------------------- camara */

  if (activeStep) {
    if (!permission?.granted) {
      return (
        <Screen scrollRef={scroll} footer={<Button label="Permitir cámara" bitacora="permitir" onPress={() => void requestPermission()} />}>
          <ScreenHeader title="Necesitamos tu cámara" subtitle="Solo se usa para fotografiar tu documento." onBack={() => setCapturing(null)} />
          <Card>
            <AtlasText variant="body" tone="secondary">
              La foto se sube cifrada y queda asociada unicamente a tu expediente. No accedemos a tu galeria.
            </AtlasText>
          </Card>
          {permission?.canAskAgain === false ? (
            <AtlasText variant="caption" tone="warning">
              El permiso está bloqueado. Habilitalo desde los ajustes del sistema para continuar.
            </AtlasText>
          ) : null}
          {/* Al final del formulario: ver `ui/trust-card.tsx`. */}
          <TrustCard items={TRUST_IDENTIDAD} />
        </Screen>
      );
    }

    return (
      <Screen
        scroll={false}
        // El visor ocupa la pantalla: no hay bloques que escalonar, y envolverlo en una vista
        // animada le quitaria el `flex: 1` del que depende para llenar el hueco.
        animate={false}
        footer={
          <>
            <Button label="Tomar foto" bitacora="tomar_foto" onPress={capture} loading={busy} disabled={busy} />
            {/* El simulador no tiene camara: sin esto, el paso de identidad no se puede recorrer. */}
            {hayCamaraDePrueba() ? (
              <Button label="Usar el carnet de prueba" bitacora="usar_carnet_de_prueba" variant="secondary" onPress={usarCarnetDePrueba} disabled={busy} />
            ) : null}
            <Button
              label="Cancelar"
              bitacora="cancelar"
              variant="ghost"
              onPress={() => {
                bitacora.captura(CAPTURA_DE[activeStep.kind], 'cancela');
                setCapturing(null);
              }}
            />
          </>
        }
      >
        <ScreenHeader title={activeStep.title} subtitle={activeStep.hint} onBack={() => setCapturing(null)} />
        {/* La misma mira de cuatro esquinas que el escaner de QR: dos superficies de captura que no
            se parecen se leen como dos apps distintas. Ver `ui/camera-frame.tsx`. */}
        <CameraFrame>
          <CameraView ref={cameraRef} style={styles.camera} facing={activeStep.facing} />
        </CameraFrame>
        {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}

      </Screen>
    );
  }

  /* ------------------------------------------------------------- formulario */

  /*
    Las slides se derivan de los pasos y de lo capturado; no hay estado propio del carrusel.

    Es lo que garantiza que «repetir» y «tomar foto» sean el MISMO camino: los dos abren la camara
    en ese paso. Un carrusel con su propia lista se habria desincronizado en cuanto una captura
    fallara a medias.
  */
  const capturadas = STEPS.filter((step) => evidence[step.kind]).length;
  const slides: ImageSlide[] = STEPS.map((step) => {
    const captured = evidence[step.kind];
    return {
      key: step.kind,
      title: step.title,
      hint: step.hint,
      uri: captured?.localUri ?? null,
      meta: captured
        ? `${(captured.sizeBytes / 1024).toFixed(0)} KB · SHA-256 ${captured.sha256Hash.slice(0, 12)}…`
        : null,
      done: Boolean(captured),
      onPress: () => {
        bitacora.captura(CAPTURA_DE[step.kind], 'abre');
        setCapturing(step.kind);
      },
      actionLabel: captured ? 'Repetir' : 'Tomar foto',
    };
  });


  return (
    <Screen
      footer={
        <Button
          bitacora="continuar"
          label="Enviar documento"
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          blockedReason={blockedReason}
          haptic="success"
        />
      }
    >
      <StepHeader code="identity_documents" title="Tu documento" subtitle="Carnet de identidad vigente." />

      {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}


      {/*
        Atajo de desarrollo, con su etiqueta puesta.

        Va ANTES de las tres tarjetas y no escondido al final: quien abre esta pantalla en un
        simulador se topa con la camara a la primera, y una salida que hay que buscar no es una
        salida. Se anuncia como lo que es —datos de prueba— para que nadie lo confunda con haber
        verificado a alguien.
      */}
      {hayCamaraDePrueba() ? (
        <Card>
          <CardHeader
            icon="chispa"
            iconTone="warning"
            title="Sin cámara: usar el carnet de prueba"
            detail={`Rellena las tres capturas y los datos con un documento sintético (${CARNET_DE_PRUEBA.titular}). Solo en desarrollo.`}
            trailing={<Badge label="prueba" tone="warning" />}
            divider={false}
          />
          <Button label="Rellenar con el carnet de prueba" bitacora="usar_carnet_de_prueba" variant="secondary" onPress={usarCarnetDePrueba} disabled={busy} />
        </Card>
      ) : null}

      {/*
        Las tres capturas, en slides que se pasan de lado.

        Eran tres tarjetas apiladas con una miniatura de 88x66 cada una, y con ese tamaño nadie
        puede comprobar lo unico que hay que comprobar antes de enviar: si se lee el numero, si hay
        un reflejo sobre la fecha, si la cara sale entera. Se enviaba a ciegas y el rechazo llegaba
        despues, cuando las fotos ya no estaban delante. Ver `ui/image-slides.tsx`.
      */}
      <Card>
        <CardHeader
          icon="camara"
          title={`Tus capturas (${capturadas} de ${STEPS.length})`}
          detail="Deslizá de lado para revisar cada foto antes de enviarla."
          trailing={<Badge dot label={allCaptured ? 'listo' : 'pendiente'} tone={allCaptured ? 'success' : 'warning'} />}
        />
        <ImageSlides slides={slides} />
      </Card>

      <IconField icon="documento" bitacora="documento_numero"
        label="Número de carnet"
        value={documentNumber}
        onChangeText={setDocumentNumber}
        keyboardType="number-pad"
        ayuda="El número de tu cédula de identidad, solo los dígitos y sin el complemento alfanumérico. Ej.: 8452136. Tiene que ser el mismo que se lee en la foto que acabas de tomar."
        required
        error={documentNumber && !documentOk ? 'Revisa el número de tu carnet.' : null}
      />
      {/*
        El carnet boliviano se expide POR DEPARTAMENTO, y en el propio documento aparece así. Como
        texto libre entraban «Santa Cruz», «SC», «Sta. Cruz» y «santa cruz de la sierra» —que además
        es la ciudad, no el departamento— para el mismo dato, y ninguna consulta por lugar de emisión
        volvía a ser fiable. La lista es la misma de `geografia.ts`, que es la que ya usa el domicilio.
      */}
      <SelectField
        label="Expedido en"
        value={issuedIn || null}
        onChange={setIssuedIn}
        ayuda="El departamento que emitió tu carnet, tal como aparece impreso en él. No tiene por qué ser donde vives hoy: es el lugar donde te lo dieron."
        // sin-ayuda: los nueve departamentos de Bolivia son nombres propios, igual que en el domicilio.
        opciones={DEPARTAMENTOS.map((departamento) => ({ valor: departamento.nombre, etiqueta: departamento.nombre }))}
        placeholder="Elige el departamento"
      />
      {/*
        El vencimiento se ELIGE en un calendario, no se teclea.

        Pedía `AAAA-MM-DD` a mano: es el formato de una base de datos, y la mitad de los rechazos de
        esta pantalla eran de formato y no de dato. Con `minimumDate` en mañana, además, deja de ser
        posible teclear un carnet ya vencido — que era una validación que sólo saltaba al final.
      */}
      <DateField
        label="Fecha de vencimiento"
        value={expiresAt}
        onChange={setExpiresAt}
        placeholder="Elige la fecha del carnet"
        minimumDate={manana}
        initialDate={dentroDeCincoAnos}
        hint="La que figura en tu carnet."
        ayuda="La fecha de caducidad impresa en tu carnet. Un documento vencido no sirve para verificar tu identidad, así que el calendario no deja elegir una fecha que ya pasó."
        required
        error={expiresAt && !expiryOk ? 'El documento debe estar vigente.' : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
