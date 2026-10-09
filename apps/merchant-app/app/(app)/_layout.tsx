/**
 * El área del comercio. Sin sesión —o cuando el refresh la rechaza— vuelve a «Ingresar». Toda ella
 * vive dentro del cierre por inactividad de 15 minutos, como el portal web.
 */
import { Redirect, Stack } from 'expo-router';
import { color } from '@cliente/theme/tokens';
import { ZonaConCierrePorInactividad } from '@/session/cierre-por-inactividad';
import { useSession } from '@/session/session';

export default function AppLayout() {
  const { status } = useSession();
  if (status !== 'authenticated') return <Redirect href="/ingresar" />;
  return (
    <ZonaConCierrePorInactividad>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surface.primary } }} />
    </ZonaConCierrePorInactividad>
  );
}
