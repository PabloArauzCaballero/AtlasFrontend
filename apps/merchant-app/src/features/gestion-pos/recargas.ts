/**
 * Quién vuelve a pedir sus datos, y cuándo, en Gestión POS.
 *
 * En la web cada panel tiene su botón «Actualizar» y nada más. En el teléfono hay tres momentos más
 * en los que los datos tienen que estar al día, y los tres afectan a VARIAS pestañas a la vez:
 *
 *  - tirar hacia abajo (`Screen.onRefresh`): recarga todo lo de la pantalla;
 *  - volver a la pantalla (`useFocusEffect`): el cajero fue a «Cartera» y vuelve con el cliente
 *    delante, y lo que había en la cola hace dos minutos ya no es lo que hay;
 *  - decidir en una pestaña: aceptar una solicitud o confirmar un pago mueve la fila al Historial,
 *    y el Historial (montado, pero escondido) seguiría enseñando la foto de antes.
 *
 * Por eso cada panel REGISTRA aquí su función de recarga, y la pantalla las llama sin saber qué hay
 * dentro de cada panel. Es un registro y no un contador de «vueltas» que los paneles escuchan
 * porque así la pantalla puede ESPERAR a que terminen: el círculo de «tirar para recargar» se queda
 * mientras de verdad se está recargando, no un instante fijo.
 */
import { useEffect, useRef } from 'react';

export type Recarga = () => Promise<void>;

export interface Recargas {
  /** Devuelve la función que lo da de baja (para el `return` de un efecto). */
  registrar(id: string, recarga: Recarga): () => void;
  /** Recarga todas las registradas menos `excepto` (la que acaba de recargarse sola), y espera a todas. */
  recargar(excepto?: string): Promise<void>;
}

export function crearRecargas(): Recargas {
  const registradas = new Map<string, Recarga>();
  return {
    registrar(id, recarga) {
      registradas.set(id, recarga);
      return () => {
        // Sólo se borra si sigue siendo ESA: un panel que se vuelve a registrar con su función nueva
        // (cambió el expediente) no puede quedar dado de baja por la limpieza de la vieja.
        if (registradas.get(id) === recarga) registradas.delete(id);
      };
    },
    async recargar(excepto) {
      // `allSettled`: que falle una pestaña no deja a las otras sin recargar ni al círculo girando.
      // Cada panel ya enseña su propio error.
      await Promise.allSettled([...registradas].filter(([id]) => id !== excepto).map(([, recarga]) => recarga()));
    },
  };
}

/** El registro de la pantalla: uno por montaje, estable entre renders. */
export function useRecargas(): Recargas {
  const ref = useRef<Recargas | null>(null);
  if (!ref.current) ref.current = crearRecargas();
  return ref.current;
}

/** Un panel se apunta con su recarga mientras está montado. */
export function useRegistrarRecarga(recargas: Recargas, id: string, recarga: Recarga): void {
  useEffect(() => recargas.registrar(id, recarga), [recargas, id, recarga]);
}
