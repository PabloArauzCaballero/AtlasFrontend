/**
 * Mover la pantalla desde DENTRO de ella.
 *
 * `Screen` lo ofrece a lo que pinta debajo: hoy lo usa el recorrido guiado, que necesita llevar a la
 * vista un objetivo que está bajo el pliegue —«Tus cuotas se pagan al comercio» señala un bloque que
 * en un teléfono pequeño queda debajo de la barra de pestañas—. Sin esto el foco apuntaba fuera de
 * la ventana y la tarjeta del paso se iba con él.
 *
 * `null` fuera de un `Screen` desplazable: quien lo usa tiene que saber vivir sin él.
 */
import React from 'react';

/** Desplaza la pantalla `dy` píxeles respecto de donde está ahora (positivo = hacia abajo). */
export type Desplazar = (dy: number) => void;

export const DesplazamientoContext = React.createContext<Desplazar | null>(null);
