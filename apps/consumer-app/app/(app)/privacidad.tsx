/**
 * Tus datos: que consientes y que puedes pedir.
 *
 * ## Por que esta pantalla existe
 *
 * Porque los consentimientos se aceptaban una sola vez, en el alta, y ahi se quedaban: no habia
 * donde revisarlos ni donde retirar uno. Un consentimiento que solo se puede dar no es un
 * consentimiento, es una casilla. Y los derechos sobre los datos —acceso, correccion, borrado,
 * portabilidad, limitacion— existian en el servidor sin que nadie pudiera ejercerlos desde el
 * telefono, que es donde esta la persona.
 *
 * ## Retirar no borra lo ya hecho, y se dice
 *
 * Revocar corta el tratamiento de ahi en adelante; lo que ya se decidio con ese dato sigue en pie,
 * porque una decision de credito tiene que poder explicarse despues. Callarlo dejaria a la persona
 * creyendo que retiro algo que no retiro. Para el borrado esta la solicitud de derechos, que es
 * otro tramite y tiene otros plazos.
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import * as customerApi from '../../src/api/endpoints/customer';
import * as deviceSignalsApi from '../../src/api/endpoints/device-signals';
import * as privacyApi from '../../src/api/endpoints/privacy';
import { usePrivacidadCopy } from '../../src/features/use-contenido-remoto';
import { describeError } from '../../src/api/errors';
import { marcarPinConfirmado } from '../../src/features/pin-verificado';
import { ConfirmarPinSheet } from '../../src/ui/confirmar-pin-sheet';
import { SolicitudTitularForm } from '../../src/features/solicitud-titular-form';
import {
  desactivarSeñalesDelDispositivo,
  FINALIDAD_AGENDA,
  FINALIDAD_UBICACION,
} from '../../src/session/device-signals';
import { useSession } from '../../src/session/session';
import { space } from '../../src/theme/tokens';
import { Gap, Screen, ScreenHeader } from '../../src/ui/layout';
import { CheckRow, OptionGroup } from '../../src/ui/fields';
import {
  AtlasText,
  Button,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  Skeleton,
} from '../../src/ui/primitives';

export default function Privacidad() {
  const session = useSession();
  const router = useRouter();
  // «Ver mis datos» es SIEMPRE posible, pero pide el PIN otra vez antes de enseñar nada.
  const [pidiendoPin, setPidiendoPin] = useState(false);
  // Los textos salen del portal; los de fábrica quedan de respaldo (`features/privacidad-copy.ts`).
  const copy = usePrivacidadCopy();
  const [documentos, setDocumentos] = useState<customerApi.ConsentDocument[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, boolean>>({});
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    customerApi
      .listActiveConsents()
      .then((valor) => {
        if (cancelado) return;
        const items = Array.isArray(valor) ? valor : [];
        setDocumentos(items);
        /*
          Se parte de «concedido» porque son los documentos que la persona acepto al darse de alta:
          empezar en falso pintaria como retirados unos permisos que estan vigentes, y bastaria con
          guardar sin tocar nada para revocarlos todos sin querer.
        */
        setDecisiones(Object.fromEntries(items.map((documento) => [documento.id, true])));
      })
      .catch((capturado) => {
        if (!cancelado) setError(capturado);
      })
      .finally(() => {
        if (!cancelado) setListo(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const hayCambios = useMemo(
    () => documentos.some((documento) => decisiones[documento.id] === false),
    [documentos, decisiones],
  );

  async function guardar() {
    if (!session.customerId) return;
    setGuardando(true);
    setGuardado(false);
    setError(null);
    try {
      await privacyApi.registrarDecisiones(
        session.customerId,
        documentos.map((documento) => ({
          consentDocumentId: documento.id,
          purposeCode: documento.documentCode,
          decision: decisiones[documento.id] === false ? 'revoked' : 'granted',
          decidedAt: new Date().toISOString(),
        })),
      );

      /*
        Retirar estos dos NO es solo dejar de recoger: es borrar y apagar.

        El texto de los dos documentos lo promete —«borramos la que tengamos guardada», «dejamos de
        registrar posiciones»— y una promesa que solo cambia una fila de consentimiento la
        incumpliria en silencio: la agenda seguiria en el servidor y el rastreo seguiria instalado en
        el sistema, despertando la app con la app cerrada. Se hace DESPUES de registrar la decision,
        para que la revocacion quede escrita aunque el borrado falle.
      */
      const revocado = (codigo: string) =>
        documentos.some((documento) => documento.documentCode === codigo && decisiones[documento.id] === false);

      if (revocado(FINALIDAD_AGENDA)) await deviceSignalsApi.borrarAgenda(session.customerId);
      if (revocado(FINALIDAD_UBICACION)) await desactivarSeñalesDelDispositivo();

      setGuardado(true);
    } catch (capturado) {
      setError(capturado);
    } finally {
      setGuardando(false);
    }
  }

  const detalle = error ? describeError(error) : null;

  return (
    <Screen>
      <ScreenHeader
        onBack="auto"
        eyebrow="Privacidad"
        title={copy.titulo}
        subtitle={copy.subtitulo}
      />

      {detalle ? (
        <ErrorState title={detalle.title} detail={detalle.detail} reference={detalle.reference} />
      ) : null}

      <Card>
        <CardHeader
          title={copy.permisosTitulo}
          detail={copy.permisosDetalle}
        />
        {!listo ? (
          <View style={{ gap: space.sm }}>
            <Skeleton height={44} />
            <Skeleton height={44} />
          </View>
        ) : documentos.length === 0 ? (
          <EmptyState title="Sin permisos registrados" detail="Todavia no aceptaste ningun documento." />
        ) : (
          documentos.map((documento, indice) => (
            <View key={documento.id}>
              {indice > 0 ? <Divider inset /> : null}
              <CheckRow
                label={documento.title ?? documento.documentCode}
                detail={documento.summary ?? `Version ${documento.versionCode}`}
                ayuda={`Marcado, sigue vigente el permiso que diste al aceptar «${documento.title ?? documento.documentCode}». Si lo desmarcas y guardas, deja de usarse desde ese momento; lo que ya se hizo con él antes no se deshace.`}
                checked={decisiones[documento.id] !== false}
                onToggle={(siguiente) =>
                  setDecisiones((actual) => ({ ...actual, [documento.id]: siguiente }))
                }
              />
            </View>
          ))
        )}
        <Gap size="sm" />
        <Button
          label={guardando ? 'Guardando…' : 'Guardar mis permisos'}
          onPress={() => guardar()}
          disabled={!listo || guardando || documentos.length === 0}
        />
        {guardado ? (
          <AtlasText variant="caption" tone="secondary">
            {hayCambios ? copy.permisosRetirados : copy.permisosIgual}
          </AtlasText>
        ) : null}
      </Card>

      <Gap />

      {/*
        Ver mis datos: siempre disponible, sin solicitud ni espera. Se vuelve a pedir el PIN: la sesión
        dice quién abrió la app, no que quien la tiene en la mano sea esa persona.
      */}
      <Card padding="none">
        <ListRow
          icon="ojo"
          title="Ver mis datos"
          subtitle="Siempre disponible. Te pediremos tu PIN otra vez."
          onPress={() => setPidiendoPin(true)}
          accessibilityHint="Abre la confirmación del PIN y después tus datos"
        />
      </Card>
      <ConfirmarPinSheet
        visible={pidiendoPin}
        onClose={() => setPidiendoPin(false)}
        onVerificado={() => {
          marcarPinConfirmado();
          setPidiendoPin(false);
          router.push('/(app)/mis-datos');
        }}
        motivo="Vas a ver tus datos personales. Escribe tu PIN para continuar."
      />

      <Gap />

      {/* Corregir un dato o borrar la cuenta: con qué dato y el valor correcto, o qué implica borrar. Pide el PIN. */}
      <SolicitudTitularForm customerId={session.customerId} copy={copy} />
    </Screen>
  );
}
