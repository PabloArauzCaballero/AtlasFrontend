/**
 * Sacar coordenadas de un enlace de Google Maps.
 *
 * ## Por que hace falta
 *
 * El domicilio se confirmaba de dos maneras: escribiendo zona y ciudad, o dando el permiso de
 * ubicacion **en el momento**. Las dos fallan en el mismo caso, que ademas es el habitual: alguien
 * que rellena el alta desde el trabajo o desde casa de un familiar. Ahi el GPS dice donde esta, no
 * donde vive, y la zona escrita a mano no ubica un domicilio para una visita de cobranza.
 *
 * Un enlace de Maps es la forma en que la gente ya comparte una direccion en Bolivia —por WhatsApp,
 * a diario— y no depende de estar en el sitio ni de conceder ningun permiso.
 *
 * ## Que se acepta
 *
 * Los formatos que produce Google al compartir, que son varios y ninguno documentado:
 *
 * ```
 * https://www.google.com/maps/@-17.7834,-63.1821,17z
 * https://www.google.com/maps/place/Equipetrol/@-17.7834,-63.1821,17z/data=...
 * https://maps.google.com/?q=-17.7834,-63.1821
 * https://www.google.com/maps/search/?api=1&query=-17.7834%2C-63.1821
 * -17.7834, -63.1821            (pegar las coordenadas a secas tambien vale)
 * ```
 *
 * Los cortos (`https://maps.app.goo.gl/…`) no llevan las coordenadas dentro: hay que preguntarle al
 * servidor a donde llevan. Eso lo resuelve `coordenadasDeEnlaceCorto`, que es asincrono y puede
 * fallar sin red — por eso va aparte y la pantalla puede seguir sin el.
 *
 * ## Lo que NO hace
 *
 * No llama a ninguna API de Google ni necesita clave: solo lee el texto del enlace. Un alta no
 * puede depender de un servicio de pago de terceros para registrar donde vive alguien.
 */

export type Coordenadas = { lat: number; lng: number };

/** Rango valido de coordenadas. Fuera de esto no es un punto: es un enlace mal pegado. */
function valida(lat: number, lng: number): Coordenadas | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Coordenadas exactamente en (0,0) son el «isla nula» del Atlantico: casi siempre un valor por
  // defecto que se colo, nunca un domicilio.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Lee las coordenadas de un texto pegado. Devuelve `null` si no hay ninguna reconocible.
 *
 * El orden de los intentos importa: `@lat,lng` es el que aparece en la barra de direcciones y el
 * mas fiable; `q=`/`query=` son los de los enlaces compartidos; y el ultimo recurso es buscar dos
 * numeros separados por coma en cualquier parte, que es lo que queda cuando alguien pega solo las
 * cifras.
 */
export function coordenadasDeTexto(texto: string): Coordenadas | null {
  const limpio = decodeURIComponent(texto.trim());

  const arroba = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(limpio);
  if (arroba) return valida(Number(arroba[1]), Number(arroba[2]));

  const consulta = /[?&](?:q|query|ll|daddr)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(limpio);
  if (consulta) return valida(Number(consulta[1]), Number(consulta[2]));

  const sueltas = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(limpio);
  if (sueltas) return valida(Number(sueltas[1]), Number(sueltas[2]));

  return null;
}

/** Los enlaces cortos que Google genera al pulsar «Compartir». */
export function esEnlaceCorto(texto: string): boolean {
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(texto.trim());
}

/**
 * Resuelve un enlace corto siguiendo su redireccion y lee las coordenadas del destino.
 *
 * Se usa `fetch` con el metodo `GET` y se mira `response.url`, que es la direccion FINAL tras las
 * redirecciones. No se descarga la pagina para nada mas: lo que interesa es a donde apunta.
 *
 * Devuelve `null` ante cualquier problema —sin red, enlace caducado, formato inesperado— porque
 * esto es una comodidad opcional dentro de un formulario, y un formulario no puede quedarse
 * bloqueado esperando a un servidor ajeno.
 */
export async function coordenadasDeEnlaceCorto(enlace: string, timeoutMs = 8000): Promise<Coordenadas | null> {
  const control = new AbortController();
  const alarma = setTimeout(() => control.abort(), timeoutMs);
  try {
    const respuesta = await fetch(enlace.trim(), { method: 'GET', signal: control.signal });
    return coordenadasDeTexto(respuesta.url ?? '');
  } catch {
    return null;
  } finally {
    clearTimeout(alarma);
  }
}

/** Lo que la pantalla llama: intenta leerlo del texto y, si es corto, va a buscarlo. */
export async function coordenadasDeEnlace(texto: string): Promise<Coordenadas | null> {
  const directas = coordenadasDeTexto(texto);
  if (directas) return directas;
  if (esEnlaceCorto(texto)) return coordenadasDeEnlaceCorto(texto);
  return null;
}
