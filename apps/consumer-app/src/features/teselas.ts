/**
 * Las cuentas de un mapa de teselas (Web Mercator), sin nada de pantalla.
 *
 * Existen para `ui/mapa-teselas.tsx`, el mapa de respaldo de los iPhone con iOS 16 o anterior:
 * `expo-maps` dibuja el mapa de Apple con SwiftUI `Map`, que sólo existe desde iOS 17, y en un
 * teléfono más viejo deja la vista VACÍA —un rectángulo negro— sin avisar (Pablo, 2026-10-08: «al
 * abrir el mapa sale negro en algunos celulares»). Aparte y puras para poder probarlas: un error de
 * signo aquí pone la casa de alguien a cien metros, y eso no se ve mirando el mapa.
 */

export const TESELA_PX = 256;
export const ZOOM_MIN = 5;
export const ZOOM_MAX = 19;

export type Coordenada = { lat: number; lng: number };
/** Un punto en píxeles del mundo, a un zoom dado. */
export type PuntoMundo = { x: number; y: number };

/** Mercator deja de estar definido en los polos; las teselas se cortan en ±85,0511°. */
const LAT_MAX = 85.05112878;

const anchoDelMundo = (zoom: number) => TESELA_PX * 2 ** zoom;

export function aMundo({ lat, lng }: Coordenada, zoom: number): PuntoMundo {
  const latitud = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat));
  const seno = Math.sin((latitud * Math.PI) / 180);
  const ancho = anchoDelMundo(zoom);
  return {
    x: ((lng + 180) / 360) * ancho,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * ancho,
  };
}

export function deMundo({ x, y }: PuntoMundo, zoom: number): Coordenada {
  const ancho = anchoDelMundo(zoom);
  const lng = (x / ancho) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / ancho;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export type Tesela = { clave: string; x: number; y: number; z: number; izquierda: number; arriba: number };

/**
 * Las teselas que cubren una vista de `ancho × alto` centrada en `centro`, con `margen` teselas de
 * más por cada lado: mientras se arrastra el mapa, lo que entra por el borde ya está cargado.
 *
 * `izquierda`/`arriba` son la posición de cada tesela relativa a la esquina de la vista.
 */
export function teselasVisibles(centro: PuntoMundo, zoom: number, ancho: number, alto: number, margen = 1): Tesela[] {
  const porLado = 2 ** zoom;
  const origenX = centro.x - ancho / 2;
  const origenY = centro.y - alto / 2;
  const desdeX = Math.floor(origenX / TESELA_PX) - margen;
  const hastaX = Math.floor((origenX + ancho) / TESELA_PX) + margen;
  const desdeY = Math.max(0, Math.floor(origenY / TESELA_PX) - margen);
  const hastaY = Math.min(porLado - 1, Math.floor((origenY + alto) / TESELA_PX) + margen);
  const teselas: Tesela[] = [];
  for (let ty = desdeY; ty <= hastaY; ty += 1) {
    for (let tx = desdeX; tx <= hastaX; tx += 1) {
      // El mundo da la vuelta en horizontal: la tesela -1 es la última de la fila.
      const x = ((tx % porLado) + porLado) % porLado;
      teselas.push({ clave: `${zoom}/${tx}/${ty}`, x, y: ty, z: zoom, izquierda: tx * TESELA_PX - origenX, arriba: ty * TESELA_PX - origenY });
    }
  }
  return teselas;
}

export type Estilo = 'calles' | 'satelite';

/**
 * De dónde sale cada tesela. Las dos fuentes van por https (ATS) y a doble densidad o con detalle
 * suficiente para ver el tejado de una casa: «elige el punto exacto» no se cumple con un mapa borroso.
 */
export function urlDeTesela(estilo: Estilo, { x, y, z }: Pick<Tesela, 'x' | 'y' | 'z'>): string {
  if (estilo === 'satelite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  const servidor = 'abcd'[(x + y) % 4];
  return `https://${servidor}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`;
}

export const ATRIBUCION: Record<Estilo, string> = {
  calles: '© OpenStreetMap · © CARTO',
  satelite: '© Esri · Maxar',
};

/**
 * Si este teléfono necesita el mapa propio. `Platform.Version` en iOS es una cadena («16.7.10»);
 * se lee la versión mayor y, si no se entiende, se usa el propio: un mapa de teselas en un iOS
 * moderno se ve bien, uno nativo en un iOS viejo se ve negro.
 */
export function iosSinMapaNativo(version: string | number): boolean {
  const mayor = Number.parseInt(String(version), 10);
  return !(Number.isFinite(mayor) && mayor >= 17);
}
