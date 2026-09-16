/**
 * El sonido de la marca.
 *
 * ## Que es y que no es
 *
 * Son dos sonidos con reglas opuestas, y por eso viven en la misma pieza: para que nadie los
 * confunda ni los deje sonar a la vez.
 *
 * - **El «ta-dum»** (`assets/audio/atlas-marca.mp3`): un activo fijo, el mismo para todo el mundo,
 *   que acompana al logotipo del arranque. Suena UNA vez por apertura de la app y nunca mas.
 * - **La bienvenida**: una locucion que dice el nombre de quien acaba de entrar. La genera el
 *   worker del motor con la plantilla `onboarding.welcome.named`, asi que cambia por persona y no
 *   se puede empaquetar. Ver `features/welcome-voice.ts`.
 *
 * ## Como se consigue que impacte sin molestar
 *
 * Un sonido de marca en una app de dinero tiene un margen estrecho: es la primera impresion, pero
 * tambien es lo que suena cuando alguien abre la app en una reunion. Cinco reglas, todas
 * deliberadas:
 *
 * 1. **El interruptor de silencio manda** (`playsInSilentMode: false`). Es la regla que hace que
 *    esto no sea spam: quien puso el telefono en silencio ya dijo que no quiere sonidos, y una app
 *    que lo ignora se desinstala. Netflix hace exactamente lo mismo.
 * 2. **Agacha, no interrumpe** (`interruptionMode: 'duckOthers'`). Si hay musica sonando, baja de
 *    volumen tres segundos y vuelve. Un sonido que PARA la musica de alguien es un sonido que se
 *    recuerda mal.
 * 3. **Una vez por apertura.** No por pantalla, no por navegacion: por apertura. Lo que convierte
 *    un sonido de marca en una molestia es la repeticion, no el volumen.
 * 4. **Al 70 %.** El activo esta normalizado alto para que tenga cuerpo en un altavoz de telefono;
 *    a volumen completo, con auriculares, sobresalta. Se atenua en reproduccion y no en el archivo
 *    para no perder margen dinamico en el altavoz, que es donde hace falta.
 * 5. **Nunca en segundo plano** (`shouldPlayInBackground: false`). Si la app se va mientras suena,
 *    el sonido se va con ella.
 *
 * ## Por que un proveedor y no un `require` en cada pantalla
 *
 * Porque el reproductor es un recurso NATIVO: cada `createAudioPlayer` reserva un decodificador y
 * hay que soltarlo. Montarlo una vez en la raiz y compartirlo es lo que evita que abrir y cerrar el
 * arranque veinte veces deje veinte reproductores vivos. Ademas es el unico sitio desde el que se
 * puede garantizar la regla 3, que necesita memoria entre pantallas.
 *
 * ## Por que todo falla en silencio
 *
 * Ninguna de estas llamadas puede tumbar nada. Un telefono sin salida de audio, un permiso raro, un
 * archivo que no decodifica: todo eso termina en «no suena», que es un desenlace perfectamente
 * aceptable. Un arranque que se queda a medias porque el decodificador no estaba listo, no.
 */
import React from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * En el navegador el audio solo puede arrancar despues de un gesto de la persona.
 *
 * Sin gesto, `play()` rechaza con «the user didn't interact with the document first», y como el
 * reproductor web de expo-audio no devuelve esa promesa, el rechazo llega como error de pagina,
 * no al `catch` de aqui abajo. `navigator.userActivation` dice si ya hubo un gesto en esta pagina;
 * si no lo hubo, se calla: es mejor que la marca no suene a que la primera pantalla arranque con
 * un error en consola. En iOS y Android no aplica.
 */
function elNavegadorDejaSonar(): boolean {
  if (Platform.OS !== 'web') return true;
  const nav = (globalThis as { navigator?: { userActivation?: { hasBeenActive?: boolean } } }).navigator;
  return nav?.userActivation?.hasBeenActive === true;
}

/** El activo de marca. Se genera con `tools/generar-sonido-marca.mjs`. */
const MARCA = require('../../assets/audio/atlas-marca.mp3');

/**
 * Volumen del ta-dum. Ver la regla 4.
 *
 * La bienvenida va mas alta (0.9) porque es HABLA: una voz al 70 % sobre el altavoz de un telefono
 * en la calle no se entiende, y una locucion que no se entiende es peor que ninguna.
 */
const VOLUMEN_MARCA = 0.7;
const VOLUMEN_VOZ = 0.9;

export type SonidoMarca = {
  /**
   * Toca el ta-dum. Idempotente por apertura de app: la segunda llamada no hace nada.
   *
   * Es `void` y no `Promise` a proposito: se llama desde el callback de una animacion que corre en
   * el hilo de UI, y ese sitio no puede esperar a nadie.
   */
  marca(): void;
  /** Reproduce una locucion ya descargada al almacenamiento local. */
  voz(uri: string): void;
  /** Corta lo que este sonando. Se usa al cerrar sesion y al irse la app a segundo plano. */
  callar(): void;
};

const SonidoContext = React.createContext<SonidoMarca | null>(null);

/**
 * Devuelve siempre algo usable.
 *
 * Fuera del proveedor —en una prueba que monta una pantalla suelta, por ejemplo— las tres funciones
 * no hacen nada. Ninguna pantalla tiene que preguntar si hay sonido disponible antes de pedirlo:
 * ese `if` acabaria copiado en seis sitios y olvidado en el septimo.
 */
export function useSonidoMarca(): SonidoMarca {
  return React.useContext(SonidoContext) ?? MUDO;
}

const MUDO: SonidoMarca = { marca: () => {}, voz: () => {}, callar: () => {} };

export function SonidoMarcaProvider({ children }: { children: React.ReactNode }) {
  const marcaRef = React.useRef<AudioPlayer | null>(null);
  const vozRef = React.useRef<AudioPlayer | null>(null);
  /*
    La regla 3 vive aqui, en una referencia y no en estado: que el ta-dum ya haya sonado no cambia
    nada de lo que se dibuja, y guardarlo en estado repintaria el arbol entero de la app en el
    fotograma exacto en que arranca la animacion del logotipo.
  */
  const yaSono = React.useRef(false);

  React.useEffect(() => {
    let vivo = true;

    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    }).catch(() => undefined);

    try {
      const marca = createAudioPlayer(MARCA);
      marca.volume = VOLUMEN_MARCA;
      const voz = createAudioPlayer();
      voz.volume = VOLUMEN_VOZ;
      if (!vivo) {
        marca.remove();
        voz.remove();
        return;
      }
      marcaRef.current = marca;
      vozRef.current = voz;
    } catch {
      // Sin reproductores el resto del modulo sigue funcionando: `marca()` y `voz()` comprueban.
    }

    return () => {
      vivo = false;
      // Soltar los recursos nativos. Sin esto, un recargado en caliente durante el desarrollo deja
      // un decodificador por recarga y el simulador acaba sin canales de audio.
      try {
        marcaRef.current?.remove();
        vozRef.current?.remove();
      } catch {
        /* el reproductor ya estaba liberado */
      }
      marcaRef.current = null;
      vozRef.current = null;
    };
  }, []);

  const valor = React.useMemo<SonidoMarca>(
    () => ({
      marca: () => {
        if (!elNavegadorDejaSonar()) return;
        if (yaSono.current) return;
        const reproductor = marcaRef.current;
        if (!reproductor) return;
        yaSono.current = true;
        try {
          /*
            `seekTo(0)` antes de tocar, aunque sea la primera vez.

            El reproductor conserva la posicion del final de la reproduccion anterior, y en un
            recargado en caliente esa posicion sobrevive al remontaje del proveedor. Sin rebobinar,
            el sonido «no suena» —esta tocando los ultimos cero milisegundos— y el sintoma no se
            parece en nada a la causa.
          */
          void reproductor.seekTo(0).catch(() => undefined);
          reproductor.play();
        } catch {
          /* no suena; no pasa nada */
        }
      },
      voz: (uri: string) => {
        const reproductor = vozRef.current;
        if (!reproductor || !elNavegadorDejaSonar()) return;
        try {
          reproductor.replace({ uri });
          reproductor.volume = VOLUMEN_VOZ;
          reproductor.play();
        } catch {
          /* no suena; no pasa nada */
        }
      },
      callar: () => {
        try {
          marcaRef.current?.pause();
          vozRef.current?.pause();
        } catch {
          /* ya estaba parado */
        }
      },
    }),
    [],
  );

  return <SonidoContext.Provider value={valor}>{children}</SonidoContext.Provider>;
}
