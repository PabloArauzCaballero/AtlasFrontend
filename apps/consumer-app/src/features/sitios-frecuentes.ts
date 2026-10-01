/**
 * Los SITIOS QUE LA PERSONA FRECUENTA, sacados de las posiciones que el telefono ya mide.
 *
 * ## Que es y de donde sale
 *
 * Quien concede la ubicacion —y, mejor aun, «siempre»— esta dejando que la app vea por donde se
 * mueve. Aqui se agrupan esas posiciones en sitios: donde duerme, donde trabaja, donde compra. El
 * sistema operativo NO entrega el historial de ubicaciones a una app, asi que lo unico que existe es
 * lo que la propia app midio desde que tuvo permiso; por eso crece con los dias, y por eso el
 * historial se guarda en el telefono (`device/historial-ubicaciones.ts`) y no solo se sube.
 *
 * ## Por que es puro
 *
 * Por lo mismo que `agenda.ts` y `rastreo.ts`: el criterio —que radio es «el mismo sitio», cuantas
 * veces hace falta volver para que cuente, que hora se considera de dormir— se prueba sin el modulo
 * nativo.
 *
 * ## El criterio, dicho
 *
 *  - **Mismo sitio = a menos de 150 m.** El GPS en interiores baila 30–80 m; un radio menor partiria
 *    una casa en tres sitios, y uno mayor juntaria la casa con la tienda de la esquina.
 *  - **Frecuentar = volver.** Una posicion suelta es un paso, no un sitio. Cuenta como sitio el que
 *    reune al menos dos VISITAS, y una visita es un tramo de posiciones seguidas: diez medidas
 *    cada cinco minutos en la misma oficina son UNA visita, no diez.
 *  - **De noche = probable casa.** Si la mayoria de las posiciones de un sitio caen entre las 21:00
 *    y las 06:00 se marca como tal; sirve de sugerencia, nunca de dato: la persona decide.
 */

export type PosicionHistorica = { lat: number; lng: number; at: string };

export type SitioFrecuente = {
  lat: number;
  lng: number;
  /** Cuantas veces ha estado: tramos separados por mas de una hora. */
  visitas: number;
  /** Posiciones que lo componen. */
  medidas: number;
  /** ISO de la ultima vez. */
  ultimaVez: string;
  /** La mayoria de lo medido aqui cae de noche: casi seguro donde duerme. */
  nocturno: boolean;
};

export const RADIO_MISMO_SITIO_M = 150;
export const VISITAS_MINIMAS = 2;
export const SEPARACION_VISITAS_MS = 60 * 60 * 1000;
export const MAX_SITIOS = 8;
/** Cuantas posiciones se guardan en el telefono. A una cada 5–15 min son semanas de rastro. */
export const MAX_HISTORIAL = 1500;

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const esDeNoche = (iso: string): boolean => {
  const hora = new Date(iso).getHours();
  return hora >= 21 || hora < 6;
};

/** Valida lo leido del almacenamiento: una version anterior pudo guardar otra forma. */
export function posicionValida(valor: unknown): valor is PosicionHistorica {
  if (typeof valor !== 'object' || valor === null) return false;
  const { lat, lng, at } = valor as Partial<PosicionHistorica>;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    typeof at === 'string' &&
    Number.isFinite(Date.parse(at))
  );
}

/**
 * Agrupa posiciones en sitios, del mas visitado al menos.
 *
 * Agrupacion voraz por centroide: cada posicion se une al primer sitio a menos de `RADIO_MISMO_SITIO_M`
 * de su centro y lo desplaza hacia ella. Para unos centenares de puntos es instantaneo, y a diferencia
 * de una cuadricula no parte un sitio por el borde de una celda.
 */
export function sitiosFrecuentes(posiciones: readonly PosicionHistorica[], max: number = MAX_SITIOS): SitioFrecuente[] {
  const ordenadas = posiciones
    .filter(posicionValida)
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  type Grupo = { lat: number; lng: number; medidas: number; noche: number; visitas: number; ultimoMs: number; ultima: string };
  const grupos: Grupo[] = [];

  for (const posicion of ordenadas) {
    const instante = Date.parse(posicion.at);
    let grupo = grupos.find((candidato) => distanciaM(candidato, posicion) <= RADIO_MISMO_SITIO_M);
    if (!grupo) {
      grupo = { lat: posicion.lat, lng: posicion.lng, medidas: 0, noche: 0, visitas: 0, ultimoMs: Number.NEGATIVE_INFINITY, ultima: posicion.at };
      grupos.push(grupo);
    }
    // Centroide movil: el sitio se asienta donde mas se ha estado.
    grupo.lat += (posicion.lat - grupo.lat) / (grupo.medidas + 1);
    grupo.lng += (posicion.lng - grupo.lng) / (grupo.medidas + 1);
    grupo.medidas += 1;
    if (esDeNoche(posicion.at)) grupo.noche += 1;
    // Visita nueva si hay un hueco largo desde la ultima medida EN este sitio.
    if (instante - grupo.ultimoMs > SEPARACION_VISITAS_MS) grupo.visitas += 1;
    grupo.ultimoMs = instante;
    grupo.ultima = posicion.at;
  }

  return grupos
    .filter((grupo) => grupo.visitas >= VISITAS_MINIMAS)
    .map<SitioFrecuente>((grupo) => ({
      lat: grupo.lat,
      lng: grupo.lng,
      visitas: grupo.visitas,
      medidas: grupo.medidas,
      ultimaVez: grupo.ultima,
      nocturno: grupo.noche / grupo.medidas > 0.5,
    }))
    .sort((a, b) => b.visitas - a.visitas || b.medidas - a.medidas)
    .slice(0, max);
}

/** La etiqueta de un sitio para el mapa y la lista. */
export function etiquetaDeSitio(sitio: SitioFrecuente): string {
  const veces = sitio.visitas === 1 ? '1 vez' : `${sitio.visitas} veces`;
  return sitio.nocturno ? `Donde sueles dormir · ${veces}` : `Sitio frecuente · ${veces}`;
}
