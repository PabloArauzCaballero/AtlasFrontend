/**
 * Raiz de la aplicacion: proveedores, tema de sistema y pila de navegacion.
 *
 * El splash se mantiene hasta que la sesion termina de restaurarse. Sin esa espera, la app
 * parpadea entre la pantalla de bienvenida y el area autenticada cada vez que se abre con sesion
 * valida, que es el primer detalle por el que un producto se siente barato.
 */
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

void SplashScreen.preventAutoHideAsync();

function NavigationTree() {
  const session = useSession();

  useEffect(() => {
    if (session.status !== 'restoring') void SplashScreen.hideAsync();
  }, [session.status]);

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
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.surface.primary);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SessionProvider>
          <SandboxProvider>
            <NavigationTree />
          </SandboxProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
