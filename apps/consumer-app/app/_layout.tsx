/**
 * Raiz de la aplicacion: proveedores, tema de sistema y pila de navegacion.
 *
 * El splash se mantiene hasta que la sesion termina de restaurarse. Sin esa espera, la app
 * parpadea entre la pantalla de bienvenida y el area autenticada cada vez que se abre con sesion
 * valida, que es el primer detalle por el que un producto se siente barato.
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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { prepararAvisos } from '../src/device/push';
import { useAbrirAvisoTocado } from '../src/device/push-navigation';
import { SandboxProvider } from '../src/sandbox/store';
import { SonidoMarcaProvider } from '../src/ui/brand-sound';
import { AnimatedSplash } from '../src/ui/splash';
import { Atmosfera } from '../src/web/Atmosfera';
import { inyectarEstiloWeb } from '../src/web/estilo';
import { BienvenidaHablada } from '../src/ui/welcome-voice';
import { SessionProvider, useSession } from '../src/session/session';
import { color } from '../src/theme/tokens';
import { BrandCutProvider } from '../src/ui/brand-cut';
import { TourProvider } from '../src/ui/tour';

// La hoja de estilo web entra antes del primer dibujado; en el teléfono no hace nada.
inyectarEstiloWeb();

void SplashScreen.preventAutoHideAsync();

/**
 * En el navegador la secuencia de marca se ve UNA vez por pestaña.
 *
 * En el teléfono la app arranca pocas veces al día y el intro de 3,5 s es el relevo del splash
 * nativo. En web cada recarga —y cada enlace abierto a mano— vuelve a montar el árbol desde cero;
 * repetir el intro en cada una convierte un F5 en cuatro segundos de espera y se lee como una web
 * lenta, no como una marca. `sessionStorage` vive lo que vive la pestaña: cerrarla y volver a abrir
 * la web vuelve a mostrarlo, que es lo más parecido a «abrir la app».
 */
const CLAVE_ARRANQUE = 'atlas.arranque.visto';

function arranqueYaVisto(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return globalThis.sessionStorage?.getItem(CLAVE_ARRANQUE) === '1';
  } catch {
    return false;
  }
}

function recordarArranque(): void {
  if (Platform.OS !== 'web') return;
  try {
    globalThis.sessionStorage?.setItem(CLAVE_ARRANQUE, '1');
  } catch {
    /* sin almacenamiento de sesión: se verá otra vez, no pasa nada */
  }
}

function NavigationTree({ fontsReady }: { fontsReady: boolean }) {
  const session = useSession();
  const [arranqueVisible, setArranqueVisible] = useState(() => !arranqueYaVisto());

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
  // Tocar un aviso de campaña abre la pantalla que eligió operaciones; sólo con sesión, o el enlace rebota al ingreso.
  useAbrirAvisoTocado(session.status === 'authenticated');

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
    {arranqueVisible ? (
      <AnimatedSplash
        listo={listo}
        onDone={() => {
          recordarArranque();
          setArranqueVisible(false);
        }}
      />
    ) : null}
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
    // El grosor de titular de la marca: la web dibuja sus titulares a 800 y la app se habia
    // quedado en 700. Ver `theme/tokens.ts`.
    Sora_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    // Solo para las versalitas de `type.overline`: a 11 px el 700 no se separa del cuerpo.
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.surface.primary);
    /*
      El canal de avisos se crea al arrancar, no al conceder el permiso. En Android una notificacion
      dirigida a un canal inexistente se descarta en silencio, y el permiso puede venir concedido de
      una sesion anterior sin que nadie vuelva a pasar por la pantalla de avisos.
    */
    void prepararAvisos();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/* La atmósfera de la landing (aurora, grano, malla). Sólo web; en el teléfono no pinta nada. */}
        <Atmosfera />
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
