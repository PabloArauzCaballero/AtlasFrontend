/**
 * Documento de identidad.
 *
 * Cinco capturas —anverso, reverso y la selfie en tres poses— con la camara del dispositivo, subida directa al
 * almacenamiento con URL firmada y, recien al final, el paquete de identidad.
 *
 * Con la bandera `EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO` encendida, el anverso y el reverso se toman
 * con el escaner de documentos DEL SISTEMA (VisionKit / ML Kit, `device/escaner-documento.ts`), que
 * sigue el carnet con su recuadro y devuelve el recorte; si no esta disponible, se abre la camara de
 * siempre. La selfie no cambia. Con la bandera apagada, la captura es la de siempre.
 *
 * El numero de documento se envia en claro SOLO para que el registro estatal pueda responder, y el
 * backend no lo persiste. Ademas se envia su hash con la misma convencion del servidor, que es lo
 * que permite comprobar despues que la verificacion corresponde al documento declarado.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ScrollView } from 'react-native';
import * as onboardingApi from '../../src/api/endpoints/onboarding';
import * as identityEngine from '../../src/api/endpoints/identity-engine';
import { AtlasApiError, describeError } from '../../src/api/errors';
import { CARNET_DE_PRUEBA, capturaSimulada, estaDisponible as hayCamaraDePrueba } from '../../src/device/camara-de-prueba';
import { hashSensitiveText } from '../../src/device/device';
import { escanearDocumento, escanerHabilitado } from '../../src/device/escaner-documento';
import { comprobarCaptura, PROPORCION_CARNET, siguientePendiente } from '../../src/features/captura-del-carnet';
import {
  esSubidaCancelada,
  leerBase64,
  plazoDeSubidaMs,
  SUBIDA_VENCIDA,
  uploadEvidence,
  type IdentityEvidenceKind as EvidenceKind,
  type PreparedEvidence,
} from '../../src/features/evidence-upload';
import type { OrigenCaptura } from '../../src/features/origen-de-captura';
import { cuerpoDeVerificacion, evidenciasDelPaquete } from '../../src/features/paquete-de-identidad';
import { useSession } from '../../src/session/session';
import { firstBlocker } from '../../src/ui/blocked';
import { DateField, IconField, SelectField } from '../../src/ui/form-controls';
import { DEPARTAMENTOS } from '../../src/features/geografia';
import { Screen, ScreenHeader, useScrollToError } from '../../src/ui/layout';
import { AtlasText, Badge, Button, Card, CardHeader, ErrorState } from '../../src/ui/primitives';
import { CameraFrame } from '../../src/ui/camera-frame';
import { ConsejosFoto } from '../../src/ui/consejos-foto';
import { space } from '../../src/theme/tokens';
import { BottomSheet } from '../../src/ui/help-sheet';
import { EstadoDeSubidaVista, type EstadoDeSubida } from '../../src/ui/estado-de-subida';
import { ImageSlides, type ImageSlide, type PeticionDeLamina } from '../../src/ui/image-slides';
import { StepHeader } from '../../src/ui/step-header';
import { TRUST_IDENTIDAD } from '../../src/features/trust-copy';
import { TrustCardRemoto } from '../../src/features/use-contenido-remoto';
import { bitacora } from '../../src/features/bitacora';
import type { Captura } from '../../src/features/bitacora/tipos';

/** `que` es como se nombra la captura en una frase: «Subiendo el anverso…». */
const STEPS: { kind: EvidenceKind; title: string; hint: string; facing: 'back' | 'front'; que: string }[] = [
  { kind: 'identity_front', title: 'Anverso del carnet', hint: 'Que se lea el número y tu nombre.', facing: 'back', que: 'el anverso' },
  { kind: 'identity_back', title: 'Reverso del carnet', hint: 'Sin reflejos ni sombras.', facing: 'back', que: 'el reverso' },
  /*
    La prueba de vida en TRES fotos: de frente y girando la cabeza a cada lado. Una sola foto de
    frente se puede sacar de una red social; tres poses coherentes del mismo rostro, no. Las decide
    una persona en el Motor (revisión humana obligatoria), que las ve juntas en el caso del alta.
  */
  { kind: 'selfie', title: 'Selfie de frente', hint: 'Mira de frente a la cámara, sin lentes oscuros ni gorra.', facing: 'front', que: 'la selfie de frente' },
  { kind: 'selfie_left', title: 'Selfie: perfil izquierdo', hint: 'Gira la cabeza hacia tu IZQUIERDA hasta que se vea tu oreja derecha.', facing: 'front', que: 'la selfie de tu lado izquierdo' },
  { kind: 'selfie_right', title: 'Selfie: perfil derecho', hint: 'Gira la cabeza hacia tu DERECHA hasta que se vea tu oreja izquierda.', facing: 'front', que: 'la selfie de tu lado derecho' },
];

const ORDEN: readonly EvidenceKind[] = STEPS.map((step) => step.kind);

/** A partir de cuando una subida «tarda mas de lo normal»: una foto de 1-3 MB sube en 2-5 s. */
const AVISO_DE_SUBIDA_LENTA_MS = 10_000;

/** Una subida en curso o que no salio, con lo necesario para reintentarla sin repetir la foto. */
type Subida = { kind: EvidenceKind; vista: EstadoDeSubida; reintento?: { uri: string; origen: OrigenCaptura } };

/** El texto de una subida que no salio. «Reintentar» solo cuando repetir puede arreglarlo. */
function vistaDeFallo(error: unknown): EstadoDeSubida {
  if (error instanceof AtlasApiError && error.code === SUBIDA_VENCIDA) {
    return {
      fase: 'fallo',
      titulo: 'La foto no terminó de subirse',
      detalle: 'Puede ser la señal. La foto sigue en tu teléfono: vuelve a intentarlo sin repetirla.',
      puedeReintentar: true,
    };
  }
  const descrito = describeError(error);
  const firmaVencida = error instanceof AtlasApiError && error.code === 'UPLOAD_URL_EXPIRED';
  return {
    fase: 'fallo',
    titulo: descrito.title,
    detalle: descrito.detail,
    referencia: descrito.reference,
    puedeReintentar: descrito.canRetry || firmaVencida,
  };
}

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Que captura es cada evidencia, para la bitacora del alta. */
const CAPTURA_DE: Record<EvidenceKind, Captura> = {
  identity_front: 'carnet_frente',
  identity_back: 'carnet_reverso',
  selfie: 'selfie',
  // Las dos poses de perfil son la parte de «prueba de vida»; la bitácora ya tenía ese código.
  selfie_left: 'liveness',
  selfie_right: 'liveness',
};

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
  const [subida, setSubida] = useState<Subida | null>(null);
  const [enfocar, setEnfocar] = useState<PeticionDeLamina | null>(null);
  const cancelarSubida = useRef<AbortController | null>(null);
  const escaneando = useRef(false);
  /*
    La hoja de consejo antes del escaner, UNA vez por visita a la pantalla: la segunda cara ya se
    hace sabiendo lo que se hizo con la primera. `consejoPara` es la cara que espera el consejo.
  */
  const consejoVisto = useRef(false);
  const [consejoPara, setConsejoPara] = useState<(typeof STEPS)[number] | null>(null);
  /** Al volver de la camara, la pantalla se monta de nuevo: hay que llevarla hasta las capturas. */
  const llevarALasCapturas = useRef(false);

  const subiendo = subida?.vista.fase === 'subiendo';

  const activeStep = STEPS.find((step) => step.kind === capturing) ?? null;
  const allCaptured = STEPS.every((step) => evidence[step.kind]);
  const documentOk = documentNumber.trim().length >= 5;
  const expiryOk = isIsoDate(expiresAt) && new Date(`${expiresAt}T23:59:59.999Z`).getTime() > Date.now();
  const canSubmit = allCaptured && documentOk && expiryOk && !busy && !subiendo;

  /*
    Las tres capturas se nombran una a una. Decir "faltan fotos" obliga a repasar las tres tarjetas
    para descubrir cual, cuando la pantalla ya sabe exactamente cual es.
  */
  const blockedReason = firstBlocker([
    [!subiendo, 'Espera a que termine de subirse la foto.'],
    [Boolean(evidence.identity_front), 'Falta la foto del anverso del carnet.'],
    [Boolean(evidence.identity_back), 'Falta la foto del reverso del carnet.'],
    [Boolean(evidence.selfie), 'Falta la selfie de frente.'],
    [Boolean(evidence.selfie_left), 'Falta la selfie de tu perfil izquierdo.'],
    [Boolean(evidence.selfie_right), 'Falta la selfie de tu perfil derecho.'],
    [documentOk, 'Falta el número de tu carnet.'],
    [isIsoDate(expiresAt), 'Falta la fecha de vencimiento del carnet: elígela en el calendario.'],
    [expiryOk, 'El carnet está vencido: solo aceptamos documentos vigentes.'],
  ]);

  // Una subida no sobrevive a la pantalla: si la persona se va, se corta.
  useEffect(() => () => cancelarSubida.current?.abort(), []);

  // «Tarda mas de lo normal» a los diez segundos, sin esperar a que venza el plazo.
  const subidaEnCurso = subiendo ? subida?.kind : null;
  useEffect(() => {
    if (!subidaEnCurso) return;
    const temporizador = setTimeout(() => {
      setSubida((actual) =>
        actual && actual.kind === subidaEnCurso && actual.vista.fase === 'subiendo'
          ? { ...actual, vista: { ...actual.vista, lenta: true } }
          : actual,
      );
    }, AVISO_DE_SUBIDA_LENTA_MS);
    return () => clearTimeout(temporizador);
  }, [subidaEnCurso]);

  /*
    Sube una captura y, si sale bien, la guarda y pasa a la SIGUIENTE pendiente.

    Es el unico camino de subida de la camara y del escaner, asi que los dos tienen el mismo estado
    (subiendo, tarda, fallo), la misma salida (cancelar, reintentar con la misma foto) y el mismo
    plazo (`plazoDeSubidaMs`). Antes el boton giraba ~60 s y acababa en «Sin conexion», sin salida.
  */
  const subir = async (kind: EvidenceKind, localUri: string, origen: OrigenCaptura) => {
    if (!session.customerId) return;
    const step = STEPS.find((candidato) => candidato.kind === kind)!;
    const controlador = new AbortController();
    cancelarSubida.current = controlador;
    setError(null);
    setSubida({ kind, vista: { fase: 'subiendo', que: step.que, lenta: false } });
    try {
      const prepared = await uploadEvidence({
        customerId: session.customerId,
        kind,
        localUri,
        captureSource: origen,
        signal: controlador.signal,
        plazo: plazoDeSubidaMs,
      });
      setEvidence((current) => ({ ...current, [kind]: prepared }));
      setEnfocar((anterior) => ({
        clave: siguientePendiente(ORDEN, { ...evidence, [kind]: prepared }, kind),
        pedido: (anterior?.pedido ?? 0) + 1,
      }));
      setSubida(null);
      if (capturing) llevarALasCapturas.current = true;
      setCapturing(null);
    } catch (caught) {
      if (esSubidaCancelada(caught)) setSubida(null);
      else setSubida({ kind, vista: vistaDeFallo(caught), reintento: { uri: localUri, origen } });
    } finally {
      if (cancelarSubida.current === controlador) cancelarSubida.current = null;
    }
  };

  const reintentarSubida = () => {
    if (!subida?.reintento || subiendo) return;
    void subir(subida.kind, subida.reintento.uri, subida.reintento.origen);
  };

  /** La camara de la app: la de siempre, y el respaldo cuando el escaner del sistema no esta. */
  const capture = async () => {
    if (!cameraRef.current || !session.customerId || !activeStep || subiendo) return;
    const kind = activeStep.kind;
    setBusy(true);
    setError(null);
    setSubida(null);
    let uri: string;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo?.uri) throw new Error('CAPTURE_FAILED');
      uri = photo.uri;
    } catch (caught) {
      setError(caught);
      return;
    } finally {
      setBusy(false);
    }
    bitacora.captura(CAPTURA_DE[kind], evidence[kind] ? 'repite' : 'toma');
    await subir(kind, uri, 'camera');
  };

  /*
    «Tomar foto» / «Repetir» en una lamina.

    Con el escaner encendido, el anverso y el reverso van al escaner del sistema, que trae su propio
    recuadro, su disparador y su propia revision; lo que devuelve se enseña grande en la lamina con
    «Repetir», asi que aqui no se añade otra confirmacion. Si el escaner no esta (Expo Go, simulador,
    Android sin Play Services, fallo), se abre la camara de la app como siempre: para la persona no
    es un error. Si cancela, no pasa nada.
  */
  const abrirCaptura = async (step: (typeof STEPS)[number]) => {
    const que = CAPTURA_DE[step.kind];
    const conEscaner = step.facing === 'back' && escanerHabilitado();
    if (conEscaner && (escaneando.current || subiendo)) return;
    if (conEscaner && !consejoVisto.current) {
      setConsejoPara(step);
      return;
    }
    bitacora.captura(que, 'abre');
    if (!conEscaner) {
      setCapturing(step.kind);
      return;
    }
    escaneando.current = true;
    setError(null);
    setSubida(null);
    try {
      bitacora.captura(que, 'escanea');
      const resultado = await escanearDocumento();
      if (resultado.tipo === 'cancelado') {
        bitacora.captura(que, 'cancela');
        return;
      }
      if (resultado.tipo === 'no_disponible') {
        bitacora.captura(que, 'respaldo_camara');
        setCapturing(step.kind);
        return;
      }
      bitacora.captura(que, evidence[step.kind] ? 'repite' : 'toma');
      const comprobacion = comprobarCaptura(resultado);
      if (!comprobacion.ok) {
        bitacora.validacion(`captura_${comprobacion.motivo}`);
        setSubida({ kind: step.kind, vista: { fase: 'rechazada', mensaje: comprobacion.mensaje } });
        return;
      }
      await subir(step.kind, resultado.uri, 'system_scanner');
    } finally {
      escaneando.current = false;
    }
  };

  /*
    «Abrir el escaner» en la hoja de consejo: ya no se vuelve a enseñar en esta visita.

    El escaner se abre cuando la hoja TERMINO de irse (`alCerrarse`), no al pulsar. Abrirlo en el
    mismo toque lo presentaba encima de la hoja que se estaba cerrando, y al acabar de cerrarse iOS se
    lo llevaba con ella: parpadeaba, devolvia a la pantalla y la promesa del escaner no volvia nunca,
    asi que `escaneando` quedaba en verdadero y los toques siguientes no hacian nada (TestFlight,
    2026-09-28).
  */
  const escaneoTrasElConsejo = useRef<(typeof STEPS)[number] | null>(null);
  const escanearTrasElConsejo = () => {
    escaneoTrasElConsejo.current = consejoPara;
    consejoVisto.current = true;
    setConsejoPara(null);
  };
  const alCerrarseElConsejo = () => {
    const step = escaneoTrasElConsejo.current;
    escaneoTrasElConsejo.current = null;
    if (step) void abrirCaptura(step);
  };

  /** Deja la camara de la app. Si habia una subida en curso, se corta. */
  const salirDeLaCamara = () => {
    cancelarSubida.current?.abort();
    setSubida(null);
    setCapturing(null);
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
        // Las imagenes de prueba hacen de foto de camara: asi el origen tambien se declara y se prueba.
        subidas[step.kind] = await uploadEvidence({ customerId: session.customerId, kind: step.kind, localUri, captureSource: 'camera' });
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
      const vista = await identityEngine.startIdentityVerification(
        cuerpoDeVerificacion({ documentFront: frente, documentBack: reverso, selfie }, customerId, evidence),
      );
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
        // El origen de cada captura viaja solo con la bandera del escaner: `paquete-de-identidad.ts`.
        evidence: evidenciasDelPaquete(ORDEN, evidence),
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

  /*
    El formulario tiene su propio desplazamiento, aparte del de la pantalla de permiso. Solo sirve
    para una cosa: al volver de la camara la pantalla se monta de nuevo y empezaba arriba del todo,
    lejos de la lamina que toca. Se mide la tarjeta de capturas y se lleva la vista hasta ella.
  */
  const scrollDelFormulario = useRef<ScrollView>(null);
  const tarjetaDeCapturas = useRef<View>(null);
  const alMedirCapturas = () => {
    if (!llevarALasCapturas.current) return;
    llevarALasCapturas.current = false;
    const contenedor = scrollDelFormulario.current?.getNativeScrollRef?.();
    if (!contenedor || !tarjetaDeCapturas.current) return;
    try {
      tarjetaDeCapturas.current.measureLayout(
        contenedor,
        (_x, y) => scrollDelFormulario.current?.scrollTo({ y: Math.max(0, y - 16), animated: false }),
        () => {},
      );
    } catch {
      // Sin medida no se mueve nada: la pantalla queda arriba, como antes.
    }
  };

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
          <TrustCardRemoto grupo="identidad" base={TRUST_IDENTIDAD} />
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
            <Button label="Tomar foto" bitacora="tomar_foto" onPress={capture} loading={busy || subiendo} disabled={busy || subiendo} />
            {/* El simulador no tiene camara: sin esto, el paso de identidad no se puede recorrer. */}
            {hayCamaraDePrueba() ? (
              <Button label="Usar el carnet de prueba" bitacora="usar_carnet_de_prueba" variant="secondary" onPress={usarCarnetDePrueba} disabled={busy || subiendo} />
            ) : null}
            {/* Con una subida en curso, «Cancelar» corta la subida y deja la camara abierta. */}
            <Button
              label={subiendo ? 'Cancelar la subida' : 'Cancelar'}
              bitacora="cancelar"
              variant="ghost"
              onPress={() => {
                if (subiendo) {
                  cancelarSubida.current?.abort();
                  return;
                }
                bitacora.captura(CAPTURA_DE[activeStep.kind], 'cancela');
                setCapturing(null);
              }}
            />
          </>
        }
      >
        <ScreenHeader title={activeStep.title} subtitle={activeStep.hint} onBack={salirDeLaCamara} />
        {/* La misma mira de cuatro esquinas que el escaner de QR: dos superficies de captura que no
            se parecen se leen como dos apps distintas. Para el carnet, las esquinas tienen su forma
            —apaisada, 1,586— y el visor sigue llenando el hueco. Ver `ui/camera-frame.tsx`. */}
        {/* Los consejos se superponen al visor, no lo encogen: ver `ui/consejos-foto.tsx`. */}
        <ConsejosFoto tipo={activeStep.facing === 'back' ? 'carnet' : activeStep.kind === 'selfie' ? 'selfie' : 'perfil'}>
          <CameraFrame mira={activeStep.facing === 'back' ? PROPORCION_CARNET : undefined}>
            <CameraView ref={cameraRef} style={styles.camera} facing={activeStep.facing} />
          </CameraFrame>
        </ConsejosFoto>
        {described ? <ErrorState title={described.title} detail={described.detail} reference={described.reference} /> : null}
        {subida && subida.kind === activeStep.kind ? (
          <EstadoDeSubidaVista estado={subida.vista} onReintentar={reintentarSubida} onRepetir={() => setSubida(null)} />
        ) : null}

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
      onPress: () => void abrirCaptura(step),
      actionLabel: captured ? 'Repetir' : 'Tomar foto',
    };
  });


  return (
    <Screen
      scrollRef={scrollDelFormulario}
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
            detail={`Rellena las capturas y los datos con un documento sintético (${CARNET_DE_PRUEBA.titular}). Solo en desarrollo.`}
            trailing={<Badge label="prueba" tone="warning" />}
            divider={false}
          />
          <Button label="Rellenar con el carnet de prueba" bitacora="usar_carnet_de_prueba" variant="secondary" onPress={usarCarnetDePrueba} disabled={busy || subiendo} />
        </Card>
      ) : null}

      {/*
        Las tres capturas, en slides que se pasan de lado.

        Eran tres tarjetas apiladas con una miniatura de 88x66 cada una, y con ese tamaño nadie
        puede comprobar lo unico que hay que comprobar antes de enviar: si se lee el numero, si hay
        un reflejo sobre la fecha, si la cara sale entera. Se enviaba a ciegas y el rechazo llegaba
        despues, cuando las fotos ya no estaban delante. Ver `ui/image-slides.tsx`.
      */}
      <View ref={tarjetaDeCapturas} onLayout={alMedirCapturas} collapsable={false}>
        <Card>
          <CardHeader
            icon="camara"
            title={`Tus capturas (${capturadas} de ${STEPS.length})`}
            detail="Deslizá de lado para revisar cada foto antes de enviarla."
            trailing={<Badge dot label={allCaptured ? 'listo' : 'pendiente'} tone={allCaptured ? 'success' : 'warning'} />}
          />
          <ImageSlides slides={slides} enfocar={enfocar} ocupado={subiendo} />
          {/*
            Lo que pasa con la captura del escaner, junto a la lamina y no arriba del todo: la persona
            esta mirando aqui, y un aviso fuera de la vista es un aviso que no existe.
          */}
          {subida ? (
            <EstadoDeSubidaVista
              estado={subida.vista}
              onCancelar={() => cancelarSubida.current?.abort()}
              onReintentar={reintentarSubida}
              onRepetir={() => {
                const step = STEPS.find((candidato) => candidato.kind === subida.kind);
                if (step) void abrirCaptura(step);
              }}
            />
          ) : null}
        </Card>
      </View>

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

      {/*
        El consejo antes del escaner del sistema.

        El escaner lo pinta el sistema, no la app: una vez abierto no podemos decir nada. Y en iPhone
        VisionKit deja elegir un filtro —color, escala de grises, blanco y negro, foto— sin API para
        fijarlo; en blanco y negro se pierden justo los detalles que el Motor mira para saber si el
        carnet es autentico. Esta hoja es el unico control que tenemos sobre eso (plan del escaner,
        §4). Cerrarla sin mas no abre nada: es un «ahora no».
      */}
      <BottomSheet visible={consejoPara !== null} titulo="Antes de escanear" cierre="Cerrar" onClose={() => setConsejoPara(null)} alCerrarse={alCerrarseElConsejo}>
        <View style={styles.consejo}>
          <AtlasText variant="body" tone="secondary">Pon el carnet sobre una mesa lisa y de color oscuro, con buena luz y sin reflejos. El recuadro lo encuentra solo y dispara cuando lo tiene entero.</AtlasText>
        {Platform.OS === 'ios' ? (
          <AtlasText variant="body" tone="secondary">
            Si arriba ves «Filtros» (o «Filters»), deja «Color» o «Foto». En gris o en blanco y negro se pierden detalles que
            necesitamos para verificar tu carnet.
          </AtlasText>
        ) : null}
          <Button label="Abrir el escáner" bitacora="abrir_camara" onPress={escanearTrasElConsejo} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  consejo: { gap: space.md, padding: space.lg, paddingBottom: space.xl },
});
