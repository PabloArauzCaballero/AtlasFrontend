/**
 * Perfil y ajustes.
 *
 * Datos de la cuenta, seguridad y cierre de sesion. Los identificadores sensibles se muestran
 * enmascarados: la app no necesita el correo completo en pantalla para que la persona reconozca su
 * propia cuenta.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { apiConfig, purchaseDataSource } from '../../../src/api/config';
import { useSandbox } from '../../../src/sandbox/store';
import { describeCustomerStatus } from '../../../src/features/onboarding-map';
import { useSession } from '../../../src/session/session';
import { TOUR_INICIO_KEY, TOUR_INICIO_STEPS } from '../../../src/features/tour-inicio';
import { resetTour, useTour } from '../../../src/ui/tour';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ListRow } from '../../../src/ui/primitives';

export default function Profile() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();
  const [signingOut, setSigningOut] = useState(false);
  const tour = useTour();

  const me = session.me;
  const fullName = [me?.profile.firstName, me?.profile.lastName].filter(Boolean).join(' ') || 'Tu cuenta';

  const confirmSignOut = () => {
    // Cerrar sesion es reversible pero interrumpe: se confirma antes, con el patron nativo.
    Alert.alert('Cerrar sesion', 'Tendras que ingresar de nuevo con tu contrasena.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
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

      <Card>
        <AtlasText variant="h3">Tu cuenta</AtlasText>
        <Divider />
        <ListRow
          title="Estado"
          subtitle="Determina que puedes hacer en la app"
          right={
            <Badge
              label={describeCustomerStatus(me?.customer.status)}
              tone={me?.customer.status === 'active' ? 'success' : 'warning'}
            />
          }
        />
        <Divider />
        <ListRow title="Telefono" subtitle={me?.customer.phoneLast4 ? `Termina en ${me.customer.phoneLast4}` : 'Sin registrar'} />
        <Divider />
        <ListRow title="Correo" subtitle={me?.customer.emailDomain ? `@${me.customer.emailDomain}` : 'Sin registrar'} />
      </Card>

      <Card>
        <AtlasText variant="h3">Seguridad</AtlasText>
        <Divider />
        <ListRow
          title="Cambiar contrasena"
          subtitle="Te enviamos un codigo por correo"
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

      <Button label="Cerrar sesion" variant="destructive" onPress={confirmSignOut} loading={signingOut} haptic="warning" />
    </Screen>
  );
}
