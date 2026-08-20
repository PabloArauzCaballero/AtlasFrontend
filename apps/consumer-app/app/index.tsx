/**
 * Puerta de entrada.
 *
 * Decide a que area entra la persona segun el estado REAL de su cuenta en el servidor, no segun lo
 * que la app recuerde. Mientras la sesion se restaura no redirige a ningun lado: el splash sigue
 * visible y no se ve ningun parpadeo.
 */
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { areaFor, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';

export default function IndexGate() {
  const session = useSession();

  if (session.status === 'restoring') return <View style={{ flex: 1, backgroundColor: color.surface.primary }} />;

  const area = areaFor(session);
  if (area === 'auth') return <Redirect href="/(public)/bienvenida" />;
  if (area === 'onboarding') return <Redirect href="/(onboarding)/progreso" />;
  return <Redirect href="/(app)/(tabs)" />;
}
