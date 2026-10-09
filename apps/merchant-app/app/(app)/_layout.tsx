/** El área del comercio. Sin sesión —o cuando el refresh la rechaza— vuelve a «Ingresar». */
import { Redirect, Stack } from 'expo-router';
import { color } from '@cliente/theme/tokens';
import { useSession } from '@/session/session';

export default function AppLayout() {
  const { status } = useSession();
  if (status !== 'authenticated') return <Redirect href="/ingresar" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surface.primary } }} />;
}
