/**
 * Los ganchos de React que alimentan la bitacora.
 *
 * Son deliberadamente pocos y todos opt-in: un componente sin codigo de bitacora no anota nada.
 *
 * - `useBitacoraDePantalla` en `Screen`: `entra`/`sale` con la ruta leida del router al montar.
 * - `useBitacoraDeApp` en la raiz: segundo plano / primer plano.
 * - `medirToque` en `Button`: la posicion del toque dentro del control y de la pantalla.
 * - `useBitacoraDeCampo` en los campos: foco, cambios (solo longitudes) y desenfoque.
 */
import { useEffect, useRef } from 'react';
import { AppState, Dimensions, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { bitacora, esCampo, esControl, pantallaDeRuta } from './bitacora';
import type { Campo, Control } from './tipos';

/** Entra/sale de la pantalla actual. Solo cuenta si la ruta esta en la lista blanca. */
export function useBitacoraDePantalla(pathname: string | null | undefined): void {
  const pantalla = pantallaDeRuta(pathname);
  useEffect(() => {
    if (!pantalla || !bitacora.estaActiva) return;
    bitacora.entraEnPantalla(pantalla);
    return () => {
      bitacora.saleDePantalla(pantalla);
    };
  }, [pantalla]);
}

/** La app se va al fondo y vuelve. Una sola suscripcion, en la raiz. */
export function useBitacoraDeApp(): void {
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (!bitacora.estaActiva) return;
      if (estado === 'background' || estado === 'inactive') bitacora.segundoPlano();
      else if (estado === 'active') bitacora.primerPlano();
    });
    return () => suscripcion.remove();
  }, []);
}

/**
 * Anota un toque en un control. Se llama desde `onPressIn` con la disposicion medida en `onLayout`.
 *
 * `locationX/Y` es el punto dentro del control y `pageX/Y` dentro de la ventana; los dos existen en
 * iOS, Android y react-native-web. Si faltan (algun evento sintetico raro), se anota el centro: un
 * toque sin posicion sigue siendo un toque.
 */
export function medirToque(control: string | undefined, event: GestureResponderEvent, disposicion: { ancho: number; alto: number } | null): void {
  if (!esControl(control) || !bitacora.estaActiva) return;
  const nativo = event?.nativeEvent as Partial<{ locationX: number; locationY: number; pageX: number; pageY: number }> | undefined;
  const ventana = Dimensions.get('window');
  const ancho = disposicion?.ancho ?? 0;
  const alto = disposicion?.alto ?? 0;
  bitacora.toque(control, {
    x: nativo?.locationX ?? ancho / 2,
    y: nativo?.locationY ?? alto / 2,
    ancho,
    alto,
    pageX: nativo?.pageX ?? ventana.width / 2,
    pageY: nativo?.pageY ?? ventana.height / 2,
    viewport: [ventana.width, ventana.height],
  });
}

/** Guarda la disposicion de un control para poder relativizar sus toques. */
export function useDisposicion(): { actual: { ancho: number; alto: number } | null; onLayout: (event: LayoutChangeEvent) => void } {
  const ref = useRef<{ ancho: number; alto: number } | null>(null);
  return {
    get actual() {
      return ref.current;
    },
    onLayout: (event) => {
      const { width, height } = event.nativeEvent.layout;
      ref.current = { ancho: width, alto: height };
    },
  };
}

/**
 * Foco, cambios y desenfoque de un campo de texto, mirando solo la LONGITUD del valor.
 *
 * Devuelve tres funciones para encadenar con las del componente. Con un `campo` que no esta en la
 * lista blanca no devuelve nada util: se anota nada.
 */
export function ganchosDeCampo(campo: string | undefined, longitudActual: () => number): {
  // El evento se acepta y se ignora: solo importa QUE hubo foco, y asi se encadena con cualquier
  // firma de `onFocus`/`onBlur` (la de RN cambia entre versiones y en web).
  onFocus: (event?: unknown) => void;
  onBlur: (event?: unknown) => void;
  onChangeLength: (longitud: number) => void;
} {
  if (!esCampo(campo)) {
    return { onFocus: () => undefined, onBlur: () => undefined, onChangeLength: () => undefined };
  }
  const codigo: Campo = campo;
  return {
    onFocus: () => bitacora.focoEnCampo(codigo, longitudActual()),
    onBlur: () => bitacora.desenfoqueDeCampo(codigo),
    onChangeLength: (longitud) => bitacora.cambioEnCampo(codigo, longitud),
  };
}

export type { Campo, Control };
