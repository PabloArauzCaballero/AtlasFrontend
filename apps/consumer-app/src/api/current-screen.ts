/**
 * La pantalla que esta abierta cuando sale una peticion, para que el backend sepa de donde viene.
 *
 * ## Para que sirve
 *
 * AtlasBackend guarda `x-atlas-flow` en `system_action_logs.origin_screen` y `x-atlas-product` en
 * `origin_client`. Con los dos, una pantalla del catalogo pasa de «existe en el codigo» a «alguien la
 * uso de verdad».
 *
 * ## Por que se lee del router AL ENVIAR, y no de un componente que la fije
 *
 * La primera version la fijaba un componente en la raiz durante su render, con el argumento de que
 * React renderiza en orden de arbol. Era falso, y lo demostro una revision: la raiz no se vuelve a
 * renderizar al navegar hasta que el contenedor de navegacion avisa, y avisa desde un EFECTO, que corre
 * despues de los efectos de montaje de la pantalla nueva. La primera llamada anonima de cada pantalla
 * salia con la ruta de la anterior.
 *
 * expo-router, en cambio, fija la ruta enfocada DURANTE el render de la propia pantalla
 * (`store.setFocusedState` en `build/useScreens.js`, sin avisar a nadie), antes de cualquier efecto
 * suyo. Leer `store.getRouteInfo()` en el momento de enviar da la pantalla correcta tambien en su
 * primera carga. Leido en el codigo de expo-router 57.0.15; la ruta de importacion es interna del
 * paquete, asi que si una version la mueve, falla la comprobacion de tipos y no el origen en silencio.
 *
 * ## Por que se manda la ruta CONCRETA
 *
 * `/comercio/123`, no `/comercio/:partnerId`: la plantilla la resuelve el backend, que tiene el
 * catalogo. Adivinarla aqui identificaria mal una pantalla en cuanto un id coincida con un segmento fijo.
 *
 * ## Cuando no se manda
 *
 * Antes de que la navegacion este lista el router devuelve `/` por defecto, y eso seria inventar un
 * origen: se devuelve nulo. Y las llamadas que no salen de una pantalla (ubicacion, telemetria,
 * sincronizacion de fondo) lo piden con `sinPantalla` en `request`.
 */
import { store } from 'expo-router/build/global-state/router-store';

/** Formato aceptado por el backend; lo que no encaje se descarta alli, asi que no se manda. */
const RUTA = /^\/[A-Za-z0-9/_:.-]{0,199}$/;

type Fuente = () => string | null | undefined;

const desdeElRouter: Fuente = () => (store.navigationRef?.isReady() ? store.getRouteInfo().pathname : null);

let fuente: Fuente = desdeElRouter;

/** Solo para pruebas: de donde se lee la ruta. `null` vuelve al router. */
export function setScreenSource(nueva: Fuente | null): void {
  fuente = nueva ?? desdeElRouter;
}

export function getCurrentScreen(): string | null {
  let ruta: string | null | undefined;
  try {
    ruta = fuente();
  } catch {
    return null;
  }
  return ruta && RUTA.test(ruta) ? ruta : null;
}
