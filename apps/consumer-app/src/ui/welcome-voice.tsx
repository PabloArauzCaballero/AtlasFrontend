/**
 * La bienvenida hablada: se dispara al INGRESAR, no al abrir la app.
 *
 * ## Por que un componente montado en la raiz y no una linea dentro de `signIn`
 *
 * Porque `session/session.tsx` decide quien entra, y eso es todo lo que tiene que decidir. Meterle
 * la reproduccion de un audio le daria una dependencia del reproductor, de la descarga y de la
 * cache de archivos: tres cosas que pueden fallar dentro de la funcion de la que depende poder usar
 * la app. Aqui el saludo observa la sesion desde fuera y no puede estorbarla ni aunque reviente.
 *
 * ## Por que solo al ingresar y no al restaurar
 *
 * Son dos caminos distintos al mismo estado y se distinguen por el estado ANTERIOR:
 *
 * - `restoring` -> `authenticated` es abrir la app con la sesion guardada. No hubo login: nadie
 *   escribio nada, y un «bienvenida, Valeria» cada vez que se mira el saldo desde la cola del
 *   supermercado es exactamente la clase de cosa que hace que se desinstale una app.
 * - `anonymous` -> `authenticated` es un ingreso de verdad —o un alta, que termina ingresando—.
 *   Ahi si hubo un acto deliberado, y ahi es donde el saludo significa algo.
 *
 * ## Por que se cancela al desmontar
 *
 * La descarga espera hasta ocho segundos a que el motor sintetice. En ese rato la persona puede
 * cerrar sesion, o la sesion puede caducar. Sin la senal de cancelacion, la voz llegaria despues y
 * saludaria por su nombre a la pantalla de ingresar de la siguiente persona.
 */
import React from 'react';
import { traerBienvenida } from '../features/welcome-voice';
import { useSession } from '../session/session';
import { useSonidoMarca } from './brand-sound';

export function BienvenidaHablada() {
  const session = useSession();
  const sonido = useSonidoMarca();
  const anterior = React.useRef(session.status);

  React.useEffect(() => {
    const previo = anterior.current;
    anterior.current = session.status;
    if (session.status !== 'authenticated' || previo !== 'anonymous') return;

    const cancelacion = new AbortController();
    void traerBienvenida(cancelacion.signal).then((uri) => {
      if (uri && !cancelacion.signal.aborted) sonido.voz(uri);
    });
    return () => cancelacion.abort();
  }, [session.status, sonido]);

  return null;
}
