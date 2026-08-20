/**
 * Raiz de la aplicacion: proveedores, tema de sistema y pila de navegacion.
 *
 * El splash se mantiene hasta que la sesion termina de restaurarse. Sin esa espera, la app
 * parpadea entre la pantalla de bienvenida y el area autenticada cada vez que se abre con sesion
 * valida, que es el primer detalle por el que un producto se siente barato.
 */
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SandboxProvider } from '../src/sandbox/store';
import { SessionProvider, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';
import { TourProvider } from '../src/ui/tour';

void SplashScreen.preventAutoHideAsync();

function NavigationTree({ fontsReady }: { fontsReady: boolean }) {
  const session = useSession();

  // El splash se retira cuando coinciden las DOS esperas: sesion restaurada y tipografia cargada.
  // Descontar solo la sesion dejaba entrar la app dibujada con la fuente del sistema y cambiarla
  // a Sora un instante despues, con el consiguiente salto de todos los textos.
  useEffect(() => {
    if (session.status !== 'restoring' && fontsReady) void SplashScreen.hideAsync();
  }, [session.status, fontsReady]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        // Transicion nativa por plataforma: deslizar en iOS, entrada desde abajo en Android.
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  // `error` se trata como «listo» a proposito: si una fuente no llega, la app arranca con la del
  // sistema. Quedarse en el splash indefinidamente por un problema tipografico dejaria al cliente
  // sin poder pagar su cuota, que importa bastante mas que la fuente.
  const [fontsLoaded, fontError] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.surface.primary);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SessionProvider>
          <SandboxProvider>
            {/*
              El recorrido guiado envuelve a la navegacion, no a una pantalla: su capa se dibuja
              sobre la ventana completa —incluida la barra de pestanas, que es uno de los objetivos
              que senala— y una capa montada dentro de una pantalla queda recortada por ella.
            */}
            <TourProvider>
              <NavigationTree fontsReady={fontsLoaded || Boolean(fontError)} />
            </TourProvider>
          </SandboxProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
