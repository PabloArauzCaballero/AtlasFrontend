/**
 * El icono que acompaña a una acción por lo que DICE su etiqueta.
 *
 * Un botón con sólo texto obliga a leer; con el gesto dibujado al lado se reconoce antes de leer, y
 * eso pesa más en una app de pagos que se usa de pie, con una mano y con prisa. Pero decidirlo
 * pantalla por pantalla dejó la app a medias: «Guardar» con check aquí y sin nada allá, «Cancelar»
 * con equis en una hoja y desnudo en la de al lado. Por eso la decisión vive en UN sitio y `Button`
 * la aplica cuando la pantalla no pasa `icon`.
 *
 * ## Reglas
 *
 * - Casa por el INICIO de la etiqueta, ya sin tildes ni mayúsculas, y gana la primera regla: el
 *   orden importa («cerrar sesión» va antes que «cerrar»).
 * - Una etiqueta que no casa se queda sin icono. Es lo correcto para «Ya tengo cuenta» o para las
 *   opciones que llegan del servidor: inventar un icono para todo es peor que no ponerlo.
 * - Se desactiva con `icon={null}` cuando el icono sobra (un botón de una sola palabra pegado a un
 *   campo, o dos botones seguidos donde sólo uno necesita el dibujo).
 * - Sólo nombres del set propio (`icons.tsx`): aquí no se importa ninguna librería.
 */
import type { IconName } from './icons';

const REGLAS: readonly (readonly [RegExp, IconName])[] = [
  [/^cerrar sesion/, 'salir'],
  [/^(cancelar|cerrar|no, gracias|ahora no)/, 'cerrar'],
  [/^(borrar|eliminar|quitar)/, 'papelera'],
  [/^(volver|anterior|atras)/, 'atras'],
  [/^(continuar|siguiente|seguir|saltar|ir a |ir al )/, 'adelante'],
  [/^(guardar|confirmar|entendido|listo|aceptar|terminar|usar este punto|marcar todo|cuenta copiada|codigo copiado|comprobante adjunto)/, 'check'],
  [/^(copiar)/, 'copiar'],
  [/^(adjuntar)/, 'clip'],
  [/^(subir|enviar documento)/, 'subir'],
  [/^(enviar|enviarme)/, 'enviar'],
  [/^(descargar)/, 'descargar'],
  [/^(escanear|abrir el escaner)/, 'escanear'],
  [/^(permitir camara|tomar foto|repetir la foto)/, 'camara'],
  [/^(abrir ajustes)/, 'ajustes'],
  [/^(actualizar|reintentar|intentar de nuevo|repetir)/, 'refrescar'],
  [/^(editar|corregir|cambiar|rellenar)/, 'editar'],
  [/^(pedir ayuda|reportar|como se calcula)/, 'ayuda'],
  [/^(ver en lista|ver todos)/, 'lista'],
  [/^(pagar|ya realice el pago)/, 'billetera'],
  [/^(usar mi ubicacion|senalar|cambiar el punto)/, 'ubicacion'],
  [/^(crear mi cuenta|elegir de mis contactos|agregar otra referencia)/, 'perfil'],
];

function normalizar(etiqueta: string): string {
  return etiqueta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿¡]/g, '')
    .trim();
}

/** El icono de la acción, o `undefined` si la etiqueta no dice una acción conocida. */
export function iconoDeAccion(etiqueta: string): IconName | undefined {
  const texto = normalizar(etiqueta);
  for (const [regla, icono] of REGLAS) if (regla.test(texto)) return icono;
  return undefined;
}
