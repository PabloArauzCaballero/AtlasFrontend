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
import { useSession } from '../../../src/session/session';
import { Gap, Screen } from '../../../src/ui/layout';
import { AtlasText, Badge, Button, Card, Divider, ListRow } from '../../../src/ui/primitives';

export default function Profile() {
  const router = useRouter();
  const session = useSession();
  const sandbox = useSandbox();
  const [signingOut, setSigningOut] = useState(false);

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
          right={<Badge label={me?.customer.status ?? 'desconocido'} tone={me?.customer.status === 'active' ? 'success' : 'warning'} />}
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
