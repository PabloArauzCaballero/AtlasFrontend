/**
 * El cartel de una caja: lo que el comercio imprime y pega en el mostrador.
 *
 * Es el porte de `AtlasERPFrontend/lib/cartelQr.ts`. Lleva tres cosas y las tres son la misma caja:
 * el QR (que lee la cámara de la app), el código corto debajo (que se teclea cuando la cámara no
 * puede) y el nombre del local y de la caja, para que quien lo pega sepa en qué mostrador va.
 *
 * ## Por qué un plano y no un dibujo
 *
 * La web dibuja en un `<canvas>` y mide cada texto con `measureText` para encogerlo hasta que quepa.
 * En el teléfono el cartel se compone como UN SVG (`ui/empresa/cartel.tsx`) y se convierte en PNG
 * con `toDataURL` de react-native-svg, sin capturar la pantalla (react-native-view-shot no está en
 * la app). Aquí se calcula el PLANO —qué va dónde y a qué tamaño— con las MISMAS medidas, colores y
 * posiciones de la web, y el componente sólo lo pinta. Así el plano se prueba sin dibujar nada.
 *
 * SVG no sabe medir un texto antes de pintarlo, así que el ancho se ESTIMA por el número de
 * caracteres. La estimación es conservadora (un poco más ancha que la real) para que un nombre largo
 * encoja de más y no se salga del papel: un cartel recortado se reimprime, uno con el nombre cortado
 * se pega igual y confunde.
 *
 * El logo de la cabecera no va: la web lo carga como imagen y, si no puede, escribe la marca. Aquí
 * se escribe siempre la marca —un SVG que incrusta imágenes es justo lo que más falla al pasar a PNG—.
 */
import { qrMatrix } from './qr';

export interface DatosCartel {
  /** Lo que lleva el QR: el serial de la caja. */
  serial: string;
  /** El código que se teclea, ya con su guion (`K7M2-9QXD`). Sin él no se imprime el cartel. */
  codigoManual: string;
  comercio: string;
  sucursal: string;
  caja: string;
}

export const ANCHO = 1200;
export const ALTO = 1900;

export const COLORES = {
  noche: '#06121f',
  menta: '#2ee6b0',
  acento: '#006a61',
  lavado: '#f0f8f7',
  tinta: '#1d1d1f',
  tenue: '#5a5a63',
  modulo: '#0f172a',
} as const;

export const SIN_CODIGO_MANUAL = 'Esta caja todavía no tiene código manual: recarga la pantalla e inténtalo de nuevo.';

/** Un nombre de archivo que cualquier sistema acepte: sin tildes, sin espacios, sin signos. */
export function nombreArchivoCartel(datos: Pick<DatosCartel, 'comercio' | 'sucursal' | 'caja'>): string {
  const limpio = [datos.comercio, datos.sucursal, datos.caja]
    .map((parte) =>
      parte
        .normalize('NFD')
        .replace(/[̀-ͯ]/gu, '')
        .replace(/[^A-Za-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, ''),
    )
    .filter(Boolean)
    .join('_');
  return `atlas-qr_${limpio || 'caja'}.png`;
}

export interface TextoDelCartel {
  texto: string;
  x: number;
  y: number;
  tamano: number;
  peso: '500' | '600' | '800';
  color: string;
  ancla: 'start' | 'middle';
  mono?: boolean;
}

export interface PlanoDelCartel {
  textos: TextoDelCartel[];
  qr: { x0: number; y0: number; modulo: number; lado: number; quiet: number; matriz: boolean[][] };
  marcoQr: { x: number; y: number; lado: number; radio: number };
  cajaCodigo: { x: number; y: number; ancho: number; alto: number; radio: number };
}

/** Ancho aproximado de un texto: 0,6 em por carácter (mono) o 0,58 em (texto en negrita). */
export function anchoEstimado(texto: string, tamano: number, mono = false): number {
  return [...texto].length * tamano * (mono ? 0.6 : 0.58);
}

/** El tamaño al que un texto cabe en `ancho`, encogiendo de 2 en 2 hasta `minimo` (como la web). */
export function tamanoQueCabe(texto: string, tamano: number, ancho: number, minimo = 28, paso = 2, mono = false): number {
  let actual = tamano;
  while (anchoEstimado(texto, actual, mono) > ancho && actual > minimo) actual -= paso;
  return actual;
}

/** Si ni encogido cabe, se recorta con «…» (como `textoQueCabe` de la web). */
export function recortarQueCabe(texto: string, tamano: number, ancho: number): string {
  let mostrado = texto;
  while (anchoEstimado(mostrado, tamano) > ancho && mostrado.length > 4) mostrado = `${mostrado.slice(0, -2)}…`;
  return mostrado;
}

function textoQueCabe(texto: string, y: number, tamano: number, peso: TextoDelCartel['peso'], color: string, ancho = ANCHO - 160): TextoDelCartel {
  const actual = tamanoQueCabe(texto, tamano, ancho);
  return { texto: recortarQueCabe(texto, actual, ancho), x: ANCHO / 2, y, tamano: actual, peso, color, ancla: 'middle' };
}

/** El nombre del comercio en una o dos líneas, partido por palabras. Devuelve cuánto baja el resto. */
function nombreDelComercio(texto: string, y: number): { textos: TextoDelCartel[]; baja: number } {
  const ancho = ANCHO - 160;
  if (anchoEstimado(texto, 72) <= ancho) return { textos: [textoQueCabe(texto, y, 72, '800', COLORES.tinta)], baja: 0 };
  const palabras = texto.split(/\s+/u);
  const corte = palabras.length < 2 ? 1 : Math.ceil(palabras.length / 2);
  const primera = palabras.slice(0, corte).join(' ');
  const segunda = palabras.slice(corte).join(' ');
  const textos = [textoQueCabe(primera, y - 10, 56, '800', COLORES.tinta)];
  if (segunda) textos.push(textoQueCabe(segunda, y + 52, 56, '800', COLORES.tinta));
  return { textos, baja: segunda ? 62 : 0 };
}

/** El plano completo del cartel. Lanza si la caja no tiene código manual: sería un QR sin su alternativa. */
export function planoDelCartel(datos: DatosCartel): PlanoDelCartel {
  if (!datos.codigoManual) throw new Error(SIN_CODIGO_MANUAL);
  const textos: TextoDelCartel[] = [
    // Cabecera con la marca escrita (ver la cabecera del archivo).
    { texto: 'ATLAS', x: 90, y: 160, tamano: 92, peso: '800', color: '#ffffff', ancla: 'start' },
    { texto: 'Compra ahora, paga en cuotas', x: 92, y: 216, tamano: 38, peso: '600', color: COLORES.menta, ancla: 'start' },
  ];

  const comercio = nombreDelComercio(datos.comercio, 410);
  textos.push(...comercio.textos);
  const baja = comercio.baja;
  textos.push(textoQueCabe(`${datos.sucursal} · ${datos.caja}`, 470 + baja, 42, '600', COLORES.tenue));

  // El QR, con su zona tranquila de 4 módulos: sin ella un lector pegado a un borde no lo encuentra.
  const matriz = qrMatrix(datos.serial);
  const quiet = 4;
  const modulos = matriz.length + quiet * 2;
  const modulo = Math.floor(680 / modulos);
  const lado = modulo * modulos;
  const x0 = Math.round((ANCHO - lado) / 2);
  const y0 = 530 + baja;
  const marco = 28;

  const finQr = y0 + lado + marco;
  textos.push({ texto: 'Escanea con la app Atlas', x: ANCHO / 2, y: finQr + 100, tamano: 54, peso: '800', color: COLORES.tinta, ancla: 'middle' });

  const yCaja = finQr + 160;
  textos.push({ texto: '¿La cámara no lee el QR? Escribe este código en la app', x: ANCHO / 2, y: yCaja + 72, tamano: 36, peso: '600', color: COLORES.tenue, ancla: 'middle' });
  textos.push({
    texto: datos.codigoManual,
    x: ANCHO / 2,
    y: yCaja + 230,
    tamano: tamanoQueCabe(datos.codigoManual, 150, ANCHO - 320, 60, 4, true),
    peso: '800',
    color: COLORES.acento,
    ancla: 'middle',
    mono: true,
  });
  textos.push({ texto: 'Escanear → Ingresar el código a mano', x: ANCHO / 2, y: yCaja + 290, tamano: 30, peso: '500', color: COLORES.tenue, ancla: 'middle' });

  textos.push(textoQueCabe(`Caja ${datos.serial}`, ALTO - 50, 26, '500', COLORES.tenue));

  return {
    textos,
    qr: { x0, y0, modulo, lado, quiet, matriz },
    marcoQr: { x: x0 - marco, y: y0 - marco, lado: lado + marco * 2, radio: 44 },
    cajaCodigo: { x: 110, y: yCaja, ancho: ANCHO - 220, alto: 330, radio: 40 },
  };
}

/** Los módulos oscuros como UN trazado SVG (`M x y h m v m h -m z` por módulo): mil `<Rect>` pesan. */
export function trazadoDelQr(qr: PlanoDelCartel['qr']): string {
  const partes: string[] = [];
  qr.matriz.forEach((fila, r) =>
    fila.forEach((oscuro, c) => {
      if (!oscuro) return;
      const x = qr.x0 + (c + qr.quiet) * qr.modulo;
      const y = qr.y0 + (r + qr.quiet) * qr.modulo;
      partes.push(`M${x} ${y}h${qr.modulo}v${qr.modulo}h-${qr.modulo}z`);
    }),
  );
  return partes.join('');
}
