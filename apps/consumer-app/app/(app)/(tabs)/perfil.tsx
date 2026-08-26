/**
 * Perfil y ajustes.
 *
 * Datos de la cuenta, seguridad y cierre de sesion. Los identificadores sensibles se muestran
 * enmascarados: la app no necesita el correo completo en pantalla para que la persona reconozca su
 * propia cuenta.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as contentApi from '../../../src/api/endpoints/app-content';
import { ContentActionButton } from '../../../src/ui/content';
import { describeCustomerStatus } from '../../../src/features/onboarding-map';
import { useSession } from '../../../src/session/session';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS } from '../../../src/features/tour-inicio';
import { resetTour, useTour } from '../../../src/ui/tour';
import { Gap, Screen } from '../../../src/ui/layout';
import {
  AtlasText,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  ListRow,
  Overline,
  ProgressBar,
} from '../../../src/ui/primitives';
import { DelinquencyImpact, ScoringPanel } from '../../../src/ui/scoring-panel';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { color, radius, space } from '../../../src/theme/tokens';

export default function Profile() {
  const router = useRouter();
  const session = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const tour = useTour();

  /*
   * El contacto de soporte sale del servidor, no del codigo. Si soporte cambia de numero —o si un
   * dia hay que atender por otro canal— se edita desde el portal y llega a todo el mundo a la vez,
   * en lugar de esperar a que cada persona actualice la app.
   */
  const [helpAction, setHelpAction] = useState<contentApi.ContentAction | null>(null);
  useEffect(() => {
    let cancelled = false;
    void contentApi.getContent('help').then((entries) => {
      if (cancelled) return;
      const whatsapp = entries.find((entry) => entry.action?.kind === 'whatsapp');
      setHelpAction(whatsapp?.action ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const book = useCreditBook(session.customerId);
  const rating = book.rating;
  const creditLine = book.creditLine;
  // Lo vencido sale del reparto por rubro, que ya lo mide contra el calendario en el servidor.
  const overdue = book.spending?.totals.overdue ?? 0;

  const me = session.me;
  const fullName = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || 'Tu cuenta';

  const confirmSignOut = () => {
    // Cerrar sesión es reversible pero interrumpe: se confirma antes, con el patron nativo.
    Alert.alert('Cerrar sesión', 'Tendrás que ingresar de nuevo con tu PIN.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await session.signOut();
          setSigningOut(false);
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <Screen onRefresh={() => void session.refresh()}>
      <Gap size="sm" />
      {/*
        La identidad, en un bloque y no en dos textos sueltos.

        El nombre y el codigo de cliente estaban uno debajo del otro pegados al borde izquierdo, con
        el mismo aspecto que el titulo de cualquier otra pantalla. Perfil es la unica pantalla que
        habla de la PERSONA, y no lo decia por ningun sitio: entrar aqui se parecia a entrar en
        Ajustes.
      */}
      <View style={styles.identidad}>
        <Avatar name={fullName} />
        <View style={styles.identidadTexto}>
          <AtlasText variant="h1" numberOfLines={2}>
            {fullName}
          </AtlasText>
          {me?.customer.customerCode ? <Overline>Cliente {me.customer.customerCode}</Overline> : null}
        </View>
      </View>

      {/*
        EL PUNTAJE ATLAS, primero.

        Es el que decide cuanto puede gastar, sale del motor y lo puede mover la persona pagando.
        Va por encima de la calificacion de deuda —que es como se clasifica su cartera para la
        provision contable— porque esa responde a otra pregunta y no es accionable para el cliente.
      */}
      {creditLine ? (
        <Card>
          <ScoringPanel line={creditLine} />
        </Card>
      ) : null}

      {creditLine && overdue > 0 ? (
        <DelinquencyImpact line={creditLine} overdueAmount={overdue} currency={creditLine.currencyCode} />
      ) : null}

      {/*
        La calificacion crediticia, del modulo `credit-rating` del backend.

        Se ensena la POSICION en la escala y no solo la letra: «A» no significa nada para quien no
        conoce la matriz, «1 de 6» si. Y no se muestra ni la exposicion ni la prevision, que son la
        medida del riesgo que asume Atlas y no un dato del cliente.
      */}
      {rating ? (
        <Card>
          <CardHeader
            icon="estrella"
            title="Tu calificación"
            trailing={<Badge dot label={rating.gradeLabel} tone={rating.worstDaysPastDue > 0 ? 'warning' : 'success'} />}
          />

          <View style={styles.gradeRow}>
            <View style={styles.gradeBox}>
              <AtlasText variant="amount">{rating.grade}</AtlasText>
            </View>
            <View style={styles.gradeText}>
              <AtlasText variant="title">
                {rating.position && rating.scaleSize
                  ? 'Categoría ' + rating.position + ' de ' + rating.scaleSize
                  : rating.gradeLabel}
              </AtlasText>
              {/*
                La barra se invierte a proposito: la mejor categoría llena la barra. Una barra que
                sube cuando el cliente empeora se lee al reves de como todo el mundo lee una barra.
              */}
              {rating.position && rating.scaleSize ? (
                <ProgressBar
                  value={((rating.scaleSize - rating.position + 1) / rating.scaleSize) * 100}
                  label={'Calificación ' + rating.position + ' de ' + rating.scaleSize}
                />
              ) : null}
              <AtlasText variant="caption" tone="tertiary">
                {rating.ratedLoanCount} {rating.ratedLoanCount === 1 ? 'crédito calificado' : 'créditos calificados'} ·
                actualizada el {new Date(rating.ratedAt).toLocaleDateString('es-BO')}
              </AtlasText>
            </View>
          </View>

          <AtlasText variant="caption" tone="secondary">
            {rating.worstDaysPastDue > 0
              ? 'Tu peor atraso registrado es de ' + rating.worstDaysPastDue + ' días. Ponerte al día mejora tu categoría.'
              : 'No tienes atrasos registrados. Pagar a tiempo mantiene tu categoría.'}
          </AtlasText>
          <Button label="¿Cómo se calcula?" variant="secondary" onPress={() => router.push('/(app)/politica-mora')} />
        </Card>
      ) : null}

      <Card padding="tight">
        <CardHeader icon="perfil" iconTone="neutral" title="Tu cuenta" />
        <ListRow
          title="Estado"
          icon="escudo"
          subtitle="Determina qué puedes hacer en la app"
          right={
            <Badge
              label={describeCustomerStatus(me?.customer.status)}
              tone={me?.customer.status === 'active' ? 'success' : 'warning'}
            />
          }
        />
        <Divider inset />
        <ListRow
          icon="telefono"
          title="Teléfono" subtitle={me?.customer.phoneLast4 ? `Termina en ${me.customer.phoneLast4}` : 'Sin registrar'} />
        <Divider />
        {/*
          «@atlas.bo» a secas se lee como un valor cortado a medias, no como una decision.

          El backend guarda solo el dominio del correo a proposito —minimizacion de datos— y esa
          decision esta bien; lo que estaba mal era enseñarla sin decirla. Con «Termina en» la fila
          queda en paralelo con la del telefono y se entiende que falta el principio porque no se
          guarda, no porque se haya roto algo.
        */}
        <ListRow
          icon="sobre"
          title="Correo"
          subtitle={me?.customer.emailDomain ? `Termina en @${me.customer.emailDomain}` : 'Sin registrar'}
        />
        <Divider inset />
        <ListRow
          icon="documento"
          title="Recalcular mi línea"
          subtitle="Sube tu extracto bancario y la recalculamos en 24 h"
          onPress={() => router.push('/(app)/extracto-bancario')}
          accessibilityHint="Abrir para subir tu extracto bancario"
        />
        <Divider inset />
        <ListRow
          icon="sobre"
          title="Cómo te avisamos"
          subtitle="Elige por dónde recibes cada aviso"
          onPress={() => router.push('/(app)/preferencias-avisos')}
          accessibilityHint="Abrir las preferencias de avisos"
        />
        <Divider inset />
        <ListRow
          icon="editar"
          title="Editar mis datos"
          subtitle="Idioma, género y avisos"
          onPress={() => router.push('/(app)/editar-perfil')}
          accessibilityHint="Abrir para cambiar tus preferencias"
        />
      </Card>

      <Card padding="tight">
        <CardHeader icon="candado" iconTone="neutral" title="Seguridad" />
        <ListRow
          title="Cambiar mi PIN"
          icon="candado"
          subtitle="Te enviamos un código por correo"
          onPress={() => router.push('/(auth)/recuperar')}
        />
        <Divider inset />
        <ListRow title="Sesión" subtitle="Tus tokens se guardan cifrados en este dispositivo" />
      </Card>

      <Card padding="tight">
        <CardHeader icon="ayuda" iconTone="neutral" title="Ayuda" />
        {/*
          Antes aqui habia dos filas con la respuesta metida en el subtitulo, a diez palabras cada
          una. Eso no responde: es un titular. Las preguntas que la gente se hace de verdad —«¿como
          deciden cuanto me prestan?», «¿que pasa si me atraso?»— no caben en una linea, y
          contestarlas a medias cierra la pregunta sin resolverla. Ahora llevan a su pantalla, con la
          respuesta entera y editable desde el portal.
        */}
        <ListRow
          icon="ayuda"
          title="Preguntas frecuentes"
          subtitle="Cómo funciona Atlas, cómo se calcula tu línea y qué pasa si te atrasas"
          onPress={() => router.push('/(app)/ayuda')}
          accessibilityHint="Abrir las preguntas frecuentes"
        />
        <Divider />
        {/*
          El recorrido tiene que poder repetirse. Quien lo salto el primer día porque tenia prisa no
          deberia quedarse sin el para siempre; y quien lo vio, lo necesita justo cuando le surge la
          duda, no cuando instalo la app.

          Se olvida que ya se vio ANTES de lanzarlo para que al cerrarlo vuelva a marcarse: si no,
          el estado quedaria en "visto" y el boton no tendria nada que restablecer la vez siguiente.
        */}
        <ListRow
          title="Ver el recorrido de nuevo"
          subtitle="Los tres puntos que conviene saber antes de comprar"
          icon="refrescar"
          onPress={() => {
            void resetTour(TOUR_INICIO_KEY).then(() => {
              router.push('/(app)/(tabs)');
              tour.start(TOUR_INICIO_STEPS, TOUR_INICIO_KEY);
            });
          }}
        />
        {/*
          El boton de WhatsApp sale del contenido del servidor —numero, texto del boton y mensaje
          previo incluidos— para que soporte pueda cambiar de numero sin publicar una version.
          Si el servidor no responde, sencillamente no se pinta: un boton de ayuda roto es peor que
          su ausencia justo cuando alguien lo necesita.
        */}
        {helpAction ? (
          <>
            <Gap size="sm" />
            <ContentActionButton action={helpAction} />
          </>
        ) : null}
      </Card>

      <Button label="Cerrar sesión" variant="destructive" onPress={confirmSignOut} loading={signingOut} haptic="warning" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identidad: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  identidadTexto: { flex: 1, gap: space.xs },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  /*
    La letra de la calificacion, en su propia caja.

    Lleva contorno y no solo fondo: sobre la tarjeta, un cuadrado un 7 % mas claro no se distingue
    lo bastante como para leerse como una insignia, y esa letra es el resumen de todo el bloque.
  */
  gradeBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.sunken,
    borderWidth: 1,
    borderColor: color.border.subtle,
    borderTopColor: color.surface.edge,
  },
  gradeText: { flex: 1, gap: space.sm },
});
