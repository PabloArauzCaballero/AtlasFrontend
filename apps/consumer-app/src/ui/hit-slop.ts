/**
 * `hitSlop` para el navegador.
 *
 * En iOS y Android `hitSlop` agranda el área que responde al dedo sin mover lo dibujado, y la app
 * lo usa en los controles pequeños que van pegados a un texto: el ojo del PIN, el ⓘ de un campo, los
 * puntos del carrusel, «Listo» en las hojas, los chips. react-native-web no lo implementa (0.21.2:
 * no aparece ni en `Pressable` ni en `PressResponder`), así que en la web esos controles medían
 * exactamente lo dibujado —8×8 px los puntos, 20×20 el ojo— y quedaban por debajo del mínimo de
 * 24 px que pide WCAG 2.2 (2.5.8) y muy lejos de los 48 que la app declara en `touch.minSize`.
 *
 * ## Cómo se hace: un pseudoelemento, no relleno
 *
 * La primera versión ponía relleno + margen negativo del mismo tamaño. Es exacto para un elemento
 * que mide lo que mide su contenido, pero el botón de volver mide 48 fijos y el chip 34: ahí el
 * relleno no agranda nada y el margen negativo SÍ desplaza el dibujo (12 px hacia arriba en cada
 * cabecera, medido comparando capturas a 390 px). Un `::before` absoluto con `inset` negativo no
 * toca el flujo: el elemento mide lo mismo, y el clic que cae en el pseudoelemento llega al mismo
 * `Pressable`. Se engancha por `data-toque="<medida>"` y la regla vive en `web/estilo.ts`.
 *
 * ## El catálogo
 *
 * Las reglas CSS se generan una vez al arrancar, así que las medidas posibles son un catálogo y no
 * un número cualquiera. Un valor fuera del catálogo no rompe nada: no agranda y avisa en desarrollo.
 * En el teléfono devuelve `{}` y `hitSlop` sigue mandando.
 */
import { Platform, type Insets } from 'react-native';

/** Medidas de `hitSlop` que usa la app. Uniformes, o «arriba-derecha-abajo-izquierda». */
export const TOQUES = ['4', '6', '8', '10', '11', '12', '8-4-8-4'] as const;

function medida(hitSlop: number | Insets): string {
  if (typeof hitSlop === 'number') return String(hitSlop);
  const t = hitSlop.top ?? 0;
  const r = hitSlop.right ?? 0;
  const b = hitSlop.bottom ?? 0;
  const l = hitSlop.left ?? 0;
  return t === r && r === b && b === l ? String(t) : `${t}-${r}-${b}-${l}`;
}

/** Los cuatro lados de una medida del catálogo, para la hoja de estilo. */
export function ladosDe(toque: string): { top: number; right: number; bottom: number; left: number } {
  const partes = toque.split('-').map(Number);
  if (partes.length === 1) return { top: partes[0]!, right: partes[0]!, bottom: partes[0]!, left: partes[0]! };
  return { top: partes[0]!, right: partes[1]!, bottom: partes[2]!, left: partes[3]! };
}

/**
 * Las props que hacen que un `Pressable` responda en la web al mismo área que su `hitSlop` en el
 * teléfono. Se esparcen junto a `hitSlop`: `<Pressable hitSlop={12} {...toqueWeb(12)}>`.
 */
export function toqueWeb(hitSlop: number | Insets | null | undefined): { dataSet?: { toque: string } } {
  if (Platform.OS !== 'web' || hitSlop === null || hitSlop === undefined) return {};
  const toque = medida(hitSlop);
  if (!(TOQUES as readonly string[]).includes(toque)) {
    if (__DEV__) console.warn(`toqueWeb: la medida ${toque} no está en el catálogo de ui/hit-slop.ts; en la web no agranda.`);
    return {};
  }
  return { dataSet: { toque } };
}

/** Une el `data-toque` con el `dataSet` que el elemento ya traiga (por ejemplo `data-atlas="fila"`). */
export function conToqueWeb<T extends { dataSet?: Record<string, string> }>(
  props: T,
  hitSlop: number | Insets | null | undefined,
): T {
  const toque = toqueWeb(hitSlop).dataSet;
  if (!toque) return props;
  return { ...props, dataSet: { ...(props.dataSet ?? {}), ...toque } };
}
