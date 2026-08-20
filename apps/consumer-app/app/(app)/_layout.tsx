/**
 * Area autenticada.
 *
 * Guarda de acceso: nadie entra aqui sin sesion valida y sin cuenta activa. La comprobacion se hace
 * contra el estado que devolvio el servidor, no contra una bandera guardada en el dispositivo.
 *
 * Es defensa en profundidad de interfaz, no de seguridad: la autorizacion real la aplica el backend
 * en cada peticion. Ocultar un boton nunca es un control de acceso.
 */
import { Redirect, Stack } from 'expo-router';
import { areaFor, useSession } from '../../src/session/session';
import { color } from '../../src/theme/tokens';

export default function AppLayout() {
  const session = useSession();

  if (session.status === 'restoring') return null;

  const area = areaFor(session);
  if (area === 'auth') return <Redirect href="/(public)/bienvenida" />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      {/* El flujo de compra se presenta como modal: es una tarea acotada que se abre y se cierra. */}
      <Stack.Screen name="compra/monto" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="compra/[orderId]" />
      <Stack.Screen name="pago/[itemId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
