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
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import * as customerApi from '../../src/api/endpoints/customer';
import * as deviceSignalsApi from '../../src/api/endpoints/device-signals';
import * as privacyApi from '../../src/api/endpoints/privacy';
import { describeError } from '../../src/api/errors';
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
  Skeleton,
} from '../../src/ui/primitives';

const DERECHOS: { value: privacyApi.DataSubjectRequestType; label: string; detalle: string }[] = [
  { value: 'access', label: 'Ver mis datos', detalle: 'Que se sabe de mi y de donde salio.' },
  { value: 'rectification', label: 'Corregir un dato', detalle: 'Algo esta mal escrito o desactualizado.' },
  { value: 'portability', label: 'Llevarme mis datos', detalle: 'Recibirlos en un archivo que pueda usar en otro sitio.' },
  { value: 'restriction', label: 'Limitar el uso', detalle: 'Que dejen de usarse para algo concreto.' },
  { value: 'revocation', label: 'Retirar consentimientos', detalle: 'Dejar sin efecto los permisos que di.' },
  { value: 'deletion', label: 'Borrar mi cuenta', detalle: 'Se revisa: hay datos que la ley obliga a conservar.' },
];

export default function Privacidad() {
  const session = useSession();
  const [documentos, setDocumentos] = useState<customerApi.ConsentDocument[]>([]);
  const [decisiones, setDecisiones] = useState<Record<string, boolean>>({});
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [derecho, setDerecho] = useState<privacyApi.DataSubjectRequestType | null>(null);
  const [enviandoDerecho, setEnviandoDerecho] = useState(false);
  const [derechoEnviado, setDerechoEnviado] = useState(false);

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

  async function pedirDerecho() {
    if (!session.customerId || !derecho) return;
    setEnviandoDerecho(true);
    setDerechoEnviado(false);
    setError(null);
    try {
      await privacyApi.solicitarDerecho(session.customerId, derecho);
      setDerechoEnviado(true);
      setDerecho(null);
    } catch (capturado) {
      setError(capturado);
    } finally {
      setEnviandoDerecho(false);
    }
  }

  const detalle = error ? describeError(error) : null;

  return (
    <Screen>
      <ScreenHeader
        onBack="auto"
        eyebrow="Privacidad"
        title="Tus datos"
        subtitle="Que permisos diste, cuales puedes retirar y que puedes pedir sobre tu informacion."
      />

      {detalle ? (
        <ErrorState title={detalle.title} detail={detalle.detail} reference={detalle.reference} />
      ) : null}

      <Card>
        <CardHeader
          title="Permisos que diste"
          detail="Retirar uno corta su uso de aqui en adelante. Lo que ya se decidio con ese dato se conserva, porque una decision de credito tiene que poder explicarse despues."
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
          onPress={() => void guardar()}
          disabled={!listo || guardando || documentos.length === 0}
        />
        {guardado ? (
          <AtlasText variant="caption" tone="secondary">
            {hayCambios
              ? 'Listo. Los permisos que retiraste dejan de usarse desde ahora.'
              : 'Listo. Tus permisos quedan como estaban.'}
          </AtlasText>
        ) : null}
      </Card>

      <Gap />

      <Card>
        <CardHeader
          title="Pedir algo sobre tus datos"
          detail="Cada solicitud queda registrada con su fecha y te responderemos por los avisos que tengas activos."
        />
        <OptionGroup
          label="Que quieres pedir"
          ayuda="Elige qué derecho quieres ejercer sobre tus datos personales. La solicitud queda registrada con su fecha y te respondemos por los avisos que tengas activos; puedes enviar otra distinta después."
          options={DERECHOS}
          value={derecho}
          onChange={setDerecho}
        />
        <Gap size="sm" />
        <Button
          label={enviandoDerecho ? 'Enviando…' : 'Enviar solicitud'}
          onPress={() => void pedirDerecho()}
          disabled={!derecho || enviandoDerecho}
        />
        {derechoEnviado ? (
          <AtlasText variant="caption" tone="secondary">
            Tu solicitud quedo registrada. Te avisaremos cuando haya respuesta.
          </AtlasText>
        ) : null}
      </Card>
    </Screen>
  );
}
