/**
 * Raíz de la app del comercio: fuentes, proveedores, tema y pila de navegación.
 *
 * El aspecto es el de la app del cliente (su hermana): las mismas fuentes (Manrope y Sora), los
 * mismos tokens y el mismo tema de navegación. Ver `apps/consumer-app/app/_layout.tsx`.
 */
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color, esquema } from '@cliente/theme/tokens';
import { fijarPantallaActual } from '@/api/client';
import { SessionProvider, useSession } from '@/session/session';

void SplashScreen.preventAutoHideAsync();

const BASE_NAVEGACION = esquema === 'oscuro' ? DarkTheme : DefaultTheme;
const TEMA_NAVEGACION = {
  ...BASE_NAVEGACION,
  dark: esquema === 'oscuro',
  colors: {
    ...BASE_NAVEGACION.colors,
    primary: color.accent.base,
    background: color.surface.primary,
    card: color.surface.secondary,
    text: color.text.primary,
    border: color.border.subtle,
    notification: color.feedback.danger,
  },
};
if (Platform.OS !== 'web') Appearance.setColorScheme(esquema === 'oscuro' ? 'dark' : 'light');

function NavigationTree({ fontsReady }: { fontsReady: boolean }) {
  const session = useSession();
  const pathname = usePathname();

  // Cada petición dice desde qué pantalla sale (`x-atlas-flow`), como el portal web.
  useEffect(() => {
    fijarPantallaActual(pathname);
  }, [pathname]);

  const listo = session.status !== 'restoring' && fontsReady;
  useEffect(() => {
    if (listo) void SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        animation: 'default',
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <SafeAreaProvider>
        <ThemeProvider value={TEMA_NAVEGACION}>
          <SessionProvider>
            <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
            <NavigationTree fontsReady={fontsLoaded || Boolean(fontError)} />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
