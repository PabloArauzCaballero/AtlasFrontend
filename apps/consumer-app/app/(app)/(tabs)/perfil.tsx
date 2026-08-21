/**
 * Perfil y ajustes.
 *
 * Datos de la cuenta, seguridad y cierre de sesion. Los identificadores sensibles se muestran
 * enmascarados: la app no necesita el correo completo en pantalla para que la persona reconozca su
 * propia cuenta.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { apiConfig, purchaseDataSource } from '../../../src/api/config';
import { useSandbox } from '../../../src/sandbox/store';
import { describeCustomerStatus } from '../../../src/features/onboarding-map';
import { useSession } from '../../../src/session/session';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS } from '../../../src/features/tour-inicio';
import { resetTour, useTour } from '../../../src/ui/tour';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ListRow, ProgressBar } from '../../../src/ui/primitives';
import { Icon } from '../../../src/ui/icons';
import { useCreditBook } from '../../../src/features/use-credit-book';
import { color, radius, space } from '../../../src/theme/tokens';

export default function Profile() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();
  const [signingOut, setSigningOut] = useState(false);
  const tour = useTour();

  const book = useCreditBook(session.customerId);
  const rating = book.rating;

  const me = session.me;
  const fullName = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || 'Tu cuenta';

  const confirmSignOut = () => {
    // Cerrar sesión es reversible pero interrumpe: se confirma antes, con el patron nativo.
    Alert.alert('Cerrar sesión', 'Tendrás que ingresar de nuevo con tu contraseña.', [
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
      <AtlasText variant="h1">{fullName}</AtlasText>
      <AtlasText variant="body" tone="secondary">
        Cliente {me?.customer.customerCode ?? ''}
      </AtlasText>

      {/*
        La calificacion crediticia, del modulo `credit-rating` del backend.

        Se ensena la POSICION en la escala y no solo la letra: «A» no significa nada para quien no
        conoce la matriz, «1 de 6» si. Y no se muestra ni la exposicion ni la prevision, que son la
        medida del riesgo que asume Atlas y no un dato del cliente.
      */}
      {rating ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.rowCenter}>
              <Icon name="estrella" size={20} tint={color.action.primary} />
              <AtlasText variant="h3">Tu calificacion</AtlasText>
            </View>
            <Badge label={rating.gradeLabel} tone={rating.worstDaysPastDue > 0 ? 'warning' : 'success'} />
          </View>
          <Divider />

          <View style={styles.gradeRow}>
            <View style={styles.gradeBox}>
              <AtlasText variant="amount">{rating.grade}</AtlasText>
            </View>
            <View style={styles.gradeText}>
              <AtlasText variant="bodyStrong">
                {rating.position && rating.scaleSize
                  ? 'Categoria ' + rating.position + ' de ' + rating.scaleSize
                  : rating.gradeLabel}
              </AtlasText>
              {/*
                La barra se invierte a proposito: la mejor categoria llena la barra. Una barra que
                sube cuando el cliente empeora se lee al reves de como todo el mundo lee una barra.
              */}
              {rating.position && rating.scaleSize ? (
                <ProgressBar
                  value={((rating.scaleSize - rating.position + 1) / rating.scaleSize) * 100}
                  label={'Calificacion ' + rating.position + ' de ' + rating.scaleSize}
                />
              ) : null}
              <AtlasText variant="caption" tone="tertiary">
                {rating.ratedLoanCount} {rating.ratedLoanCount === 1 ? 'credito calificado' : 'creditos calificados'} ·
                actualizada el {new Date(rating.ratedAt).toLocaleDateString('es-BO')}
              </AtlasText>
            </View>
          </View>

          <AtlasText variant="caption" tone="secondary">
            {rating.worstDaysPastDue > 0
              ? 'Tu peor atraso registrado es de ' + rating.worstDaysPastDue + ' dias. Ponerte al dia mejora tu categoria.'
              : 'No tienes atrasos registrados. Pagar a tiempo mantiene tu categoria.'}
          </AtlasText>
          <Button label="Como se calcula" variant="secondary" onPress={() => router.push('/(app)/politica-mora')} />
        </Card>
      ) : null}

      <Card>
        <AtlasText variant="h3">Tu cuenta</AtlasText>
        <Divider />
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
        <Divider />
        <ListRow
          icon="ubicacion"
          title="Teléfono" subtitle={me?.customer.phoneLast4 ? `Termina en ${me.customer.phoneLast4}` : 'Sin registrar'} />
        <Divider />
        <ListRow
          icon="sobre"
          title="Correo" subtitle={me?.customer.emailDomain ? `@${me.customer.emailDomain}` : 'Sin registrar'} />
      </Card>

      <Card>
        <AtlasText variant="h3">Seguridad</AtlasText>
        <Divider />
        <ListRow
          title="Cambiar contraseña"
          icon="candado"
          subtitle="Te enviamos un código por correo"
          onPress={() => router.push('/(auth)/recuperar')}
        />
        <Divider />
        <ListRow title="Sesion" subtitle="Tus tokens se guardan cifrados en este dispositivo" />
      </Card>

      <Card>
        <AtlasText variant="h3">Ayuda</AtlasText>
        <Divider />
        <ListRow title="Como funciona Atlas" subtitle="Pagas 60% hoy y el resto en 3 cuotas cada 14 dias" />
        <Divider />
        <ListRow title="Donde pago mis cuotas" subtitle="Siempre al QR bancario del comercio donde compraste" />
        <Divider />
        {/*
          El recorrido tiene que poder repetirse. Quien lo salto el primer dia porque tenia prisa no
          deberia quedarse sin el para siempre; y quien lo vio, lo necesita justo cuando le surge la
          duda, no cuando instalo la app.

          Se olvida que ya se vio ANTES de lanzarlo para que al cerrarlo vuelva a marcarse: si no,
          el estado quedaria en "visto" y el boton no tendria nada que restablecer la vez siguiente.
        */}
        <ListRow
          title="Ver el recorrido de nuevo"
          subtitle="Los tres puntos que conviene saber antes de comprar"
          icon="ayuda"
          onPress={() => {
            void resetTour(TOUR_INICIO_KEY).then(() => {
              router.push('/(app)/(tabs)');
              tour.start(TOUR_INICIO_STEPS, TOUR_INICIO_KEY);
            });
          }}
        />
      </Card>

      <Card>
        <AtlasText variant="h3">Entorno</AtlasText>
        <Divider />
        <ListRow title="Servidor" subtitle={apiConfig.baseUrl} />
        <Divider />
        <ListRow title="Origen de compras" subtitle={purchaseDataSource === 'sandbox' ? 'Sandbox local (dominio V3)' : 'Backend Atlas'} />
        <Divider />
        <ListRow title="Version" subtitle={apiConfig.appVersion} />
        {purchaseDataSource === 'sandbox' ? (
          <>
            <Divider />
            <View>
              <Button label="Reiniciar datos del sandbox" variant="ghost" onPress={sandbox.reset} />
            </View>
          </>
        ) : null}
      </Card>

      <Button label="Cerrar sesión" variant="destructive" onPress={confirmSignOut} loading={signingOut} haptic="warning" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gradeBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.raisedStrong,
  },
  gradeText: { flex: 1, gap: space.xxs },
});
