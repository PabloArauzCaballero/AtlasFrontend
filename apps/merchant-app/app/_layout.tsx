/**
 * Raíz de la app del comercio: fuentes, proveedores, tema y pila de navegación.
 *
 * El aspecto es el de la app del cliente (su hermana): las mismas fuentes (Manrope y Sora), los
 * mismos tokens, el mismo tema de navegación y el MISMO arranque —la marca animada con su órbita y
 * el «ta-dum»— (pedido de Pablo, 2026-10-09). Ver `apps/consumer-app/app/_layout.tsx`.
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
import { useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color, esquema } from '@cliente/theme/tokens';
import { SonidoMarcaProvider } from '@cliente/ui/brand-sound';
import { AnimatedSplash } from '@cliente/ui/splash';
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

  /*
    Igual que en la app del cliente: el splash NATIVO se retira en cuanto hay algo que dibujar, y
    debajo está la capa animada —misma marca, mismo fondo—, así que el relevo no se ve. La animación
    de salida espera a las dos cosas: sesión restaurada y tipografía cargada.
  */
  const listo = session.status !== 'restoring' && fontsReady;
  const [arranqueVisible, setArranqueVisible] = useState(true);
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <>
      {session.status !== 'restoring' ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.surface.primary },
            animation: 'default',
          }}
        />
      ) : null}
      {arranqueVisible ? <AnimatedSplash listo={listo} onDone={() => setArranqueVisible(false)} /> : null}
    </>
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
          {/* El sonido de marca envuelve a la sesión, como en la app del cliente: un solo reproductor por apertura. */}
          <SonidoMarcaProvider>
            <SessionProvider>
              <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
              <NavigationTree fontsReady={fontsLoaded || Boolean(fontError)} />
            </SessionProvider>
          </SonidoMarcaProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
