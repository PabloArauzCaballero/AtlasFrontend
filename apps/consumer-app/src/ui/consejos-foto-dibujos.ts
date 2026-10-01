/**
 * Los dibujos de «Consejos para la foto»: un carnet y una cara, bien y mal.
 *
 * ## Por que vectores y no imagenes generadas
 *
 * Una ilustracion de un carnet tiene que decir UNA cosa —«asi si, asi no»— y una imagen generada
 * dice ademas cien que nadie pidio: rostros inventados que no se parecen a nadie, texto ilegible
 * impreso en el documento, un estilo distinto en cada tarjeta. Aqui el carnet es un rectangulo con
 * una silueta SIN rasgos y renglones sin letras: no hay a quien parecerse ni nada que leer mal.
 *
 * Todos los dibujos salen de la misma rejilla (160 x 100) y de los tokens de la marca, asi que los
 * ocho encajan como un set. Son cadenas SVG puras para poder pintarlas con `SvgXml` en la app y,
 * con el mismo texto, volcarlas a un archivo y MIRARLAS antes de darlas por buenas.
 *
 * ## Lo que NO hay
 *
 * Ningun filtro (`feGaussianBlur`): react-native-svg no los dibuja igual en las dos plataformas. El
 * desenfoque se compone con copias desplazadas a baja opacidad, que se ve igual en todas partes.
 */
import { palette } from '../theme/tokens';

export type Dibujo =
  | 'carnet-bien'
  | 'carnet-oscuro'
  | 'carnet-reflejo'
  | 'carnet-borroso'
  | 'carnet-inclinado'
  | 'cara-bien'
  | 'cara-perfil'
  | 'cara-ladeada'
  | 'cara-gafas'
  | 'cara-contraluz';

const W = 160;
const H = 100;

/** El fondo de la ficha: un paso por encima del papel, para que el dibujo se separe de la tarjeta. */
const fondo = (extra = '') => `<rect width="${W}" height="${H}" fill="${palette.bgElevated}"/>${extra}`;

/** Medidas del carnet sobre la ficha. Proporcion 1,59 como el ID-1 real. */
const C = { x: 26, y: 15, w: 108, h: 68, r: 7 };

/** El carnet entero, SIN transformar. `op` lo atenua para componer el desenfoque. */
function carnet(op = 1): string {
  const { x, y, w, h, r } = C;
  return `<g opacity="${op}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${palette.text1}" stroke="${palette.brand500}" stroke-width="1.5"/>
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="9" rx="${r - 1}" fill="${palette.brand500}" opacity="0.28"/>
    <rect x="${x + 9}" y="${y + 17}" width="30" height="38" rx="4" fill="${palette.brand500}" opacity="0.30"/>
    <circle cx="${x + 24}" cy="${y + 31}" r="7.5" fill="${palette.brand700}"/>
    <path d="M${x + 12} ${y + 55} C${x + 12} ${y + 43} ${x + 36} ${y + 43} ${x + 36} ${y + 55} Z" fill="${palette.brand700}"/>
    <rect x="${x + 48}" y="${y + 18}" width="50" height="6" rx="3" fill="${palette.brand700}"/>
    <rect x="${x + 48}" y="${y + 29}" width="42" height="4.5" rx="2.25" fill="${palette.text3}"/>
    <rect x="${x + 48}" y="${y + 38}" width="34" height="4.5" rx="2.25" fill="${palette.text3}"/>
    <rect x="${x + 48}" y="${y + 50}" width="14" height="4" rx="2" fill="${palette.brand500}" opacity="0.7"/>
    <rect x="${x + 65}" y="${y + 50}" width="14" height="4" rx="2" fill="${palette.brand500}" opacity="0.7"/>
    <rect x="${x + 82}" y="${y + 50}" width="16" height="4" rx="2" fill="${palette.brand500}" opacity="0.7"/>
  </g>`;
}

/** El recorte del carnet, para que un velo o un reflejo no se salga de sus esquinas redondeadas. */
const recorte = (id: string) =>
  `<clipPath id="${id}"><rect x="${C.x}" y="${C.y}" width="${C.w}" height="${C.h}" rx="${C.r}"/></clipPath>`;

function carnetBien() {
  return fondo(carnet());
}

function carnetOscuro() {
  return `<defs>${recorte('c')}</defs>${fondo(carnet())}
    <g clip-path="url(#c)"><rect x="0" y="0" width="${W}" height="${H}" fill="${palette.bg}" opacity="0.66"/></g>`;
}

function carnetReflejo() {
  // Dos bandas diagonales de luz que cruzan justo la zona del texto: es donde un reflejo hace dano.
  return `<defs>${recorte('c')}</defs>${fondo(carnet())}
    <g clip-path="url(#c)">
      <polygon points="74,10 98,10 70,90 46,90" fill="${palette.white}" opacity="0.62"/>
      <polygon points="104,10 112,10 84,90 76,90" fill="${palette.white}" opacity="0.40"/>
    </g>`;
}

function carnetBorroso() {
  // Cinco copias desplazadas a baja opacidad: el mismo efecto de «se movio» en iOS, Android y web.
  const copias = [[-2.6, -1], [-1.3, 0.5], [0, 0], [1.3, -0.5], [2.6, 1]]
    .map(([dx, dy]) => `<g transform="translate(${dx} ${dy})">${carnet(0.26)}</g>`)
    .join('');
  return fondo(copias);
}

function carnetInclinado() {
  // Girado y aplastado en vertical, con un sesgo: se lee como un carnet visto de lado sobre una mesa.
  return fondo(
    `<g transform="translate(80 50) rotate(-20) scale(0.88 0.6) skewX(-16) translate(-80 -50)">${carnet()}</g>`,
  );
}

/* ------------------------------------------------------------------ la cara */

/**
 * Una cara sin rasgos de nadie: ovalo y hombros planos, dos puntos por ojos. Es un icono, no un
 * retrato: nada que pueda leerse como una persona real ni como un cliente concreto.
 */
function cara(opts: { dy?: number; oscura?: boolean; gafas?: boolean } = {}): string {
  const piel = opts.oscura ? palette.text3 : palette.text1;
  const ojo = palette.brand900;
  const gafas = opts.gafas
    ? `<rect x="64" y="39" width="14" height="9" rx="3.5" fill="${palette.black}"/>
       <rect x="82" y="39" width="14" height="9" rx="3.5" fill="${palette.black}"/>
       <rect x="77" y="42" width="6" height="2" fill="${palette.black}"/>`
    : `<circle cx="71" cy="43" r="2" fill="${ojo}"/><circle cx="89" cy="43" r="2" fill="${ojo}"/>`;
  return `<g transform="translate(0 ${opts.dy ?? 0})">
    <path d="M34 150 L34 100 C34 76 56 68 80 68 C104 68 126 76 126 100 L126 150 Z" fill="${palette.brand500}" opacity="0.55"/>
    <rect x="73" y="58" width="14" height="14" rx="5" fill="${piel}" opacity="0.9"/>
    <ellipse cx="80" cy="42" rx="19" ry="23" fill="${piel}"/>
    ${gafas}
    <path d="M74 55 L86 55" fill="none" stroke="${ojo}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

function caraBien() {
  // El ovalo de guia, discontinuo y en menta: es lo que le dice «aqui va tu cara».
  return fondo(
    `${cara()}<ellipse cx="80" cy="44" rx="30" ry="36" fill="none" stroke="${palette.brand400}" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.8"/>`,
  );
}

function caraLadeada() {
  // Cabeza girada y descentrada: el fallo es de encuadre, asi que el dibujo cambia el encuadre.
  return fondo(
    `<g transform="translate(22 6) rotate(-16 80 100)">${cara()}</g>
     <ellipse cx="80" cy="44" rx="30" ry="36" fill="none" stroke="${palette.brand400}" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.5"/>`,
  );
}

function caraPerfil() {
  // De lado, mirando a la derecha: se ve UNA oreja y la nariz sale del contorno. Es lo que el motor
  // y la persona que revisa necesitan comprobar, y lo que el dibujo tiene que dejar claro.
  const piel = palette.text1;
  const ojo = palette.brand900;
  return fondo(`
    <path d="M34 150 L34 100 C34 76 56 68 80 68 C104 68 126 76 126 100 L126 150 Z" fill="${palette.brand500}" opacity="0.55"/>
    <rect x="68" y="58" width="14" height="14" rx="5" fill="${piel}" opacity="0.9"/>
    <ellipse cx="78" cy="42" rx="17" ry="23" fill="${piel}"/>
    <path d="M92 41 L97.5 47 L92 49 Z" fill="${piel}"/>
    <ellipse cx="72" cy="45" rx="4" ry="6.5" fill="${palette.text2}" opacity="0.55"/>
    <circle cx="86" cy="37" r="2" fill="${ojo}"/>
    <path d="M86 56 L91 56" fill="none" stroke="${ojo}" stroke-width="2" stroke-linecap="round"/>`);
}

function caraGafas() {
  return fondo(cara({ gafas: true }));
}

function caraContraluz() {
  // La luz esta DETRAS: un fogonazo claro tras la cabeza y la cara, por delante, apagada.
  return `<defs><radialGradient id="g" cx="50%" cy="42%" r="55%">
      <stop offset="0" stop-color="${palette.white}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${palette.tint}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${palette.bgElevated}" stop-opacity="0"/>
    </radialGradient></defs>${fondo(`<rect width="${W}" height="${H}" fill="url(#g)"/>`)}
    ${cara({ oscura: true })}`;
}

const DIBUJOS: Record<Dibujo, () => string> = {
  'carnet-bien': carnetBien,
  'carnet-oscuro': carnetOscuro,
  'carnet-reflejo': carnetReflejo,
  'carnet-borroso': carnetBorroso,
  'carnet-inclinado': carnetInclinado,
  'cara-bien': caraBien,
  'cara-perfil': caraPerfil,
  'cara-ladeada': caraLadeada,
  'cara-gafas': caraGafas,
  'cara-contraluz': caraContraluz,
};

/** El SVG completo de un dibujo, con su `viewBox`. */
export function svgDe(dibujo: Dibujo): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DIBUJOS[dibujo]()}</svg>`;
}

export const DIBUJO_ASPECTO = W / H;
export const TODOS_LOS_DIBUJOS = Object.keys(DIBUJOS) as Dibujo[];
