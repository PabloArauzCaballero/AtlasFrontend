/**
 * El ESMALTE de las insignias: el material de las medallas, el escudo de nivel y la carta de una insignia.
 *
 * Pablo (2026-10-15): «más premium, más serio, y con el MISMO estilo de colores» que el resto de la app. Antes cada rango
 * era un metal de color propio —bronce, plata, oro, platino, diamante— escrito en hex en `palette.metal`: cinco paletas
 * ajenas a la marca, chillonas sobre el blanco y fijas aunque cambiara la marca. Ahora hay UN material, el de la marca:
 * esmalte en el tono de `marca.principal` llevado a una luz fija y oscura (como la tarjeta navy), con filetes en el tono
 * de `marca.acento`. El rango no se distingue por el color sino por las marcas grabadas y su nombre (`ui/trofeo.tsx`).
 *
 * ## Por qué luz FIJA y no la marca tal cual
 *
 * La insignia es un objeto, no interfaz: tiene que verse igual en claro y en oscuro (como una foto) y su texto tiene que
 * leerse con cualquier marca. Con la marca tal cual, un principal claro —un amarillo, un blanco— daba un esmalte claro y
 * la tinta blanca de encima desaparecía. Fijando la luz y limitando el croma, el esmalte es siempre un tono profundo de
 * la marca (un grafito si la marca es negra o blanca) y las tintas se corrigen hasta su contraste con `conContraste`.
 * `__tests__/esmalte-contraste.test.ts` lo comprueba con la marca actual y con las ocho marcas extremas.
 */
import { aOklch, conContraste, desdeOklch } from './color';
import { marca as marcaActual } from './marca';
import type { Marca } from './temas';

/** El tono de un color a una luz dada, con el croma acotado: sobrio, nunca fosforescente. */
function tono(hex: string, l: number, cromaMax: number): string {
  const o = aOklch(hex);
  return desdeOklch({ l, c: Math.min(o.c, cromaMax), h: o.h });
}

export function crearEsmalte(marca: Marca = marcaActual) {
  const cara = tono(marca.principal, 0.27, 0.08);
  const caraAlta = tono(marca.principal, 0.34, 0.08);
  const caraProfunda = tono(marca.principal, 0.19, 0.06);
  const fondos = [cara, caraAlta, caraProfunda];
  return {
    /** La cara del esmalte, de su punto más alto (donde da la luz) al más profundo. */
    cara,
    caraAlta,
    caraProfunda,
    /** El aro satinado: un brillo mate arriba y su sombra abajo. Sin degradado de metal pulido. */
    aroLuz: tono(marca.principal, 0.58, 0.05),
    aroSombra: tono(marca.principal, 0.15, 0.05),
    /** Los filetes, las marcas del rango y el icono: el acento de la marca, claro y legible sobre el esmalte. */
    filete: conContraste(tono(marca.acento, 0.8, 0.09), fondos, 4.5),
    /** El carril de una barra o el hueco de una insignia pendiente, dentro del esmalte. */
    hueco: tono(marca.principal, 0.36, 0.05),
    /** Las tintas del texto sobre el esmalte (la carta). */
    tinta: {
      primaria: conContraste(tono(marca.principal, 0.97, 0.01), fondos, 7),
      secundaria: conContraste(tono(marca.principal, 0.86, 0.02), fondos, 4.5),
      terciaria: conContraste(tono(marca.principal, 0.76, 0.02), fondos, 4.5),
    },
  };
}

export type Esmalte = ReturnType<typeof crearEsmalte>;

/** El esmalte de la marca activa. */
export const esmalte: Esmalte = crearEsmalte();
