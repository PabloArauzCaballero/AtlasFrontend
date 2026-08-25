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
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SandboxProvider } from '../src/sandbox/store';
import { SonidoMarcaProvider } from '../src/ui/brand-sound';
import { AnimatedSplash } from '../src/ui/splash';
import { BienvenidaHablada } from '../src/ui/welcome-voice';
import { SessionProvider, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';
import { BrandCutProvider } from '../src/ui/brand-cut';
import { TourProvider } from '../src/ui/tour';

void SplashScreen.preventAutoHideAsync();

function NavigationTree({ fontsReady }: { fontsReady: boolean }) {
  const session = useSession();
  const [arranqueVisible, setArranqueVisible] = useState(true);

  /*
    El splash NATIVO se retira en cuanto hay algo que dibujar, y lo que se ve debajo es la capa
    animada —misma marca, mismo navy—, no la app. El relevo no se percibe porque no cambia nada en
    pantalla; lo que cambia es que a partir de ese fotograma la marca ya se puede mover, cosa que
    una imagen nativa no puede hacer.

    Las DOS esperas siguen mandando sobre cuando ARRANCA la animacion de salida: sesion restaurada y
    tipografia cargada. Descontar solo la sesion dejaba entrar la app dibujada con la fuente del
    sistema y cambiarla a Sora un instante despues, con el salto de todos los textos a la vista.
  */
  const listo = session.status !== 'restoring' && fontsReady;

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
        /*
          `default`, no `slide_from_right`.

          `slide_from_right` esta documentado como **solo Android** en Expo 57
          (https://docs.expo.dev/versions/v57.0.0/sdk/router/). Forzarlo aqui no daba «deslizar en
          iOS» como decia este comentario: renunciaba al empuje nativo de UIKit, que es bastante
          mas que un deslizamiento —la pantalla de abajo acompana con paralaje a un tercio de la
          distancia, la de arriba proyecta sombra sobre ella y el gesto de volver es INTERACTIVO,
          con la animacion enganchada al dedo y cancelable a medio camino—.

          Nada de eso se puede reimplementar con una animacion declarada, y es justo lo que un
          usuario de iOS reconoce como «nativo» sin saber nombrarlo. `default` lo devuelve, y en
          Android sigue dando la transicion propia del sistema.
        */
        animation: 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(app)" />
    </Stack>
    <BienvenidaHablada />
    {arranqueVisible ? <AnimatedSplash listo={listo} onDone={() => setArranqueVisible(false)} /> : null}
    </>
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
        {/*
          El sonido de marca envuelve a la sesion, no al reves.

          Lo usan tres piezas que viven en niveles distintos —el arranque, el corte de marca y el
          saludo posterior al login—, y el reproductor tiene que ser el MISMO para las tres: es un
          recurso nativo, y ademas la regla de «el ta-dum suena una vez por apertura» necesita una
          memoria por encima de todo lo que se monta y se desmonta debajo.
        */}
        <SonidoMarcaProvider>
          <SessionProvider>
            <SandboxProvider>
              {/*
                El recorrido guiado envuelve a la navegacion, no a una pantalla: su capa se dibuja
                sobre la ventana completa —incluida la barra de pestanas, que es uno de los objetivos
                que senala— y una capa montada dentro de una pantalla queda recortada por ella.
              */}
              <TourProvider>
                {/*
                  El corte de marca envuelve a la navegacion por el mismo motivo que el recorrido
                  guiado: su capa tiene que cubrir la ventana COMPLETA. Montado dentro de la
                  bienvenida quedaria recortado por ella y, peor, se desmontaria con la propia
                  pantalla justo a la mitad de la animacion —que es exactamente cuando se navega—.
                */}
                <BrandCutProvider>
                  <NavigationTree fontsReady={fontsLoaded || Boolean(fontError)} />
                </BrandCutProvider>
              </TourProvider>
            </SandboxProvider>
          </SessionProvider>
        </SonidoMarcaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
