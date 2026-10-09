/**
 * El motor de color: de UN color de marca a todos los tonos que la interfaz necesita.
 *
 * ## Por que OKLCH
 *
 * Aclarar u oscurecer un color en RGB o HSL cambia su matiz y su viveza por el camino: un azul se
 * vuelve violeta al aclararlo y un amarillo se ensucia al oscurecerlo. OKLCH separa luminosidad (L),
 * croma (C) y matiz (H) tal como los percibe el ojo, asi que una rampa construida variando solo L se
 * lee como «el mismo color, mas claro o mas oscuro». Es el espacio que usan los sistemas de color de
 * Apple, de Material 3 y de CSS Color 4.
 *
 * ## Por que el contraste se CALCULA y no se elige
 *
 * Una marca nueva puede traer un verde lima o un azul electrico. En vez de confiar en que alguien
 * elija bien cada tono, `conContraste` busca sobre la rampa del color el tono mas parecido al
 * original que alcanza el contraste pedido contra la superficie peor. Asi cualquier marca produce un
 * tema que cumple WCAG AA, y la prueba `temas-contraste.test.ts` lo verifica con marcas extremas.
 */

type Rgb = [number, number, number];
export type Oklch = { l: number; c: number; h: number };

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const gam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function hexARgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbAHex([r, g, b]: Rgb): string {
  const p = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

export function aOklch(hex: string): Oklch {
  const [r, g, b] = hexARgb(hex).map((v) => lin(v / 255)) as Rgb;
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

function oklchARgbCrudo({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => gam(v) * 255) as Rgb;
}

const dentro = (rgb: Rgb) => rgb.every((v) => v >= -0.5 && v <= 255.5);

/** OKLCH -> hex. Si el color no cabe en sRGB se reduce el croma (nunca el tono ni la luz) hasta que cabe. */
export function desdeOklch(o: Oklch): string {
  let c = o.c;
  let rgb = oklchARgbCrudo({ ...o, c });
  while (!dentro(rgb) && c > 0.0005) {
    c *= 0.94;
    rgb = oklchARgbCrudo({ ...o, c });
  }
  return rgbAHex(rgb);
}

/** El mismo color con otra luminosidad perceptual (0 negro, 1 blanco). */
export function conLuz(hex: string, l: number, croma = 1): string {
  const o = aOklch(hex);
  return desdeOklch({ l, c: o.c * croma, h: o.h });
}

/** Luminancia relativa WCAG 2.x. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((v) => lin(v / 255)) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG 2.x entre dos colores opacos (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Un color translucido pintado sobre un fondo opaco: lo que de verdad ve el ojo. */
export function sobre(hex: string, alfa: number, fondo: string): string {
  const f = hexARgb(fondo);
  return rgbAHex(hexARgb(hex).map((v, i) => v * alfa + (f[i] ?? 0) * (1 - alfa)) as Rgb);
}

/**
 * El tono del color MAS PARECIDO al original que alcanza `minimo` contra TODAS las superficies dadas.
 *
 * Recorre la rampa en pasos de luminosidad alejandose del original en la direccion que da contraste
 * (hacia oscuro sobre fondos claros, hacia claro sobre fondos oscuros). Si el original ya cumple,
 * lo devuelve tal cual: la marca no se toca cuando no hace falta.
 */
export function conContraste(hex: string, superficies: string[], minimo: number): string {
  const cumple = (c: string) => superficies.every((s) => contraste(c, s) >= minimo);
  if (cumple(hex)) return hex.toUpperCase();
  const o = aOklch(hex);
  const fondoClaro = superficies.reduce((t, s) => t + luminancia(s), 0) / superficies.length > 0.18;
  for (let paso = 1; paso <= 100; paso += 1) {
    const l = fondoClaro ? o.l - paso * 0.01 : o.l + paso * 0.01;
    if (l <= 0 || l >= 1) break;
    const c = desdeOklch({ l, c: o.c, h: o.h });
    if (cumple(c)) return c;
  }
  return fondoClaro ? '#000000' : '#FFFFFF';
}

/** Blanco o casi negro: lo que se lea mejor ENCIMA de un relleno. */
export function tintaSobre(relleno: string, claro = '#FFFFFF', oscuro = '#0B0B0D'): string {
  return contraste(claro, relleno) >= contraste(oscuro, relleno) ? claro : oscuro;
}
