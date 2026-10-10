/** Las pantallas sin sesión. Con sesión, a Gestión POS: el comercio no vuelve a ver el ingreso. */
import { Redirect, Stack } from 'expo-router';
import { color } from '@cliente/theme/tokens';
import { useSession } from '@/session/session';

export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'authenticated') return <Redirect href="/gestion-pos" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surface.primary } }} />;
}
