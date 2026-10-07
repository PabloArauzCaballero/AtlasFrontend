/**
 * Los dibujos de «Consejos para la foto»: un carnet y una cara, bien y mal.
 *
 * ## Por que vectores y no imagenes generadas
 *
 * Una ilustracion tiene que decir UNA cosa —«asi si, asi no»— y una imagen generada dice ademas cien que nadie pidio:
 * rostros inventados que no se parecen a nadie, texto ilegible impreso en el documento, un estilo distinto en cada
 * tarjeta. Aqui todo se dibuja con vectores: nitidos a cualquier densidad —un iPhone a 3x se ve tan limpio como a 2x—,
 * unos pocos KB y nada que descargar.
 *
 * ## «Ultra HD», sin figuras duras (Pablo, 2026-10-07)
 *
 * Antes eran formas planas: un ovalo con dos puntos. Ahora cada rostro lleva volumen —la piel es un degradado radial con la
 * luz arriba a la izquierda—, pelo con brillo, cejas, ojos con iris y reflejo, nariz con sombra, labios, orejas, cuello con
 * la sombra de la barbilla y una camisa con pliegue. El carnet gana reflejo de plastico, holograma y chip. Sigue siendo
 * un retrato GENERICO: nadie a quien parecerse y ningun texto que leer mal.
 *
 * Todos los dibujos salen de la misma rejilla (160 x 100) y de los tokens de la marca, asi que encajan como un set. Son
 * cadenas SVG puras para pintarlas con `SvgXml` y, con el mismo texto, volcarlas a un archivo y MIRARLAS antes de darlas
 * por buenas.
 *
 * ## Lo que NO hay
 *
 * Ningun filtro (`feGaussianBlur`): react-native-svg no los dibuja igual en las dos plataformas. El desenfoque se compone
 * con copias desplazadas a baja opacidad, que se ve igual en todas partes. Los degradados SI (los dibuja bien en todas) y
 * cada dibujo prefija sus identificadores: en la web los `id` son globales y dos fichas con el mismo `id` se pisarian.
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

/** Colores de ilustracion (piel, pelo, ropa): no son tokens de interfaz y no deben confundirse con la marca. */
const PIEL = { luz: '#F8DCC6', media: '#E9B895', sombra: '#C98D68', borde: '#A9693F' };
const PIEL_OSCURA = { luz: '#A58B7E', media: '#86695B', sombra: '#5A463D', borde: '#3D2F29' };
const PELO = { luz: '#7A5C47', medio: '#4A3527', oscuro: '#241A14' };

/** El fondo de la ficha: un paso por encima del papel, con un halo suave detras del sujeto. */
const fondo = (p: string, extra = '') =>
  `<defs><radialGradient id="${p}fo" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="${palette.brand500}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${palette.bgElevated}" stop-opacity="0"/>
    </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="${palette.bgElevated}"/><rect width="${W}" height="${H}" fill="url(#${p}fo)"/>${extra}`;

/* ---------------------------------------------------------------- el carnet */

/** Medidas del carnet sobre la ficha. Proporcion 1,59 como el ID-1 real. */
const C = { x: 26, y: 15, w: 108, h: 68, r: 7 };

/** Los degradados del carnet, UNA vez por dibujo: las copias del desenfoque los reutilizan. */
const carnetDefs = (p: string) => `<defs>
    <clipPath id="${p}cl"><rect x="${C.x}" y="${C.y}" width="${C.w}" height="${C.h}" rx="${C.r}"/></clipPath>
    <linearGradient id="${p}cb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.white}"/><stop offset="0.6" stop-color="${palette.text1}"/><stop offset="1" stop-color="${palette.text2}"/>
    </linearGradient>
    <linearGradient id="${p}ct" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${palette.brand400}"/><stop offset="1" stop-color="${palette.brand700}"/>
    </linearGradient>
    <linearGradient id="${p}cf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.brand300}" stop-opacity="0.55"/><stop offset="1" stop-color="${palette.brand700}" stop-opacity="0.35"/>
    </linearGradient>
    <radialGradient id="${p}ch" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.45" stop-color="${palette.brand300}" stop-opacity="0.7"/>
      <stop offset="0.75" stop-color="#B9A4FF" stop-opacity="0.55"/><stop offset="1" stop-color="${palette.brand500}" stop-opacity="0.35"/>
    </radialGradient>
    <linearGradient id="${p}cc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F2D98D"/><stop offset="0.5" stop-color="#D9AE4E"/><stop offset="1" stop-color="#B8862E"/>
    </linearGradient>
    <linearGradient id="${p}cs" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

/** El carnet entero, SIN transformar. `op` lo atenua para componer el desenfoque. */
function carnet(p: string, op = 1): string {
  const { x, y, w, h, r } = C;
  return `<g opacity="${op}">
    <rect x="${x + 1}" y="${y + 3}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.10"/>
    <rect x="${x + 0.5}" y="${y + 2}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="0.12"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${p}cb)" stroke="${palette.brand500}" stroke-width="1.2"/>
    <path d="M${x + 1} ${y + 10} L${x + 1} ${y + r} A${r - 1} ${r - 1} 0 0 1 ${x + r} ${y + 1} L${x + w - r} ${y + 1} A${r - 1} ${r - 1} 0 0 1 ${x + w - 1} ${y + r} L${x + w - 1} ${y + 10} Z" fill="url(#${p}ct)" opacity="0.9"/>
    <circle cx="${x + 11}" cy="${y + 5.5}" r="2.4" fill="${palette.white}" opacity="0.85"/>
    <rect x="${x + 17}" y="${y + 4}" width="26" height="3" rx="1.5" fill="${palette.white}" opacity="0.8"/>
    <rect x="${x + 9}" y="${y + 17}" width="30" height="38" rx="4" fill="url(#${p}cf)" stroke="${palette.brand500}" stroke-opacity="0.35" stroke-width="0.6"/>
    <circle cx="${x + 24}" cy="${y + 31}" r="7.2" fill="${palette.brand700}"/>
    <ellipse cx="${x + 22}" cy="${y + 28.6}" rx="3" ry="2.2" fill="#fff" opacity="0.14"/>
    <path d="M${x + 11.5} ${y + 55} C${x + 11.5} ${y + 42.5} ${x + 36.5} ${y + 42.5} ${x + 36.5} ${y + 55} Z" fill="${palette.brand700}"/>
    <rect x="${x + 48}" y="${y + 17}" width="28" height="6" rx="3" fill="${palette.brand700}"/>
    <rect x="${x + 48}" y="${y + 28}" width="42" height="4.2" rx="2.1" fill="${palette.text3}"/>
    <rect x="${x + 48}" y="${y + 36}" width="34" height="4.2" rx="2.1" fill="${palette.text3}" opacity="0.85"/>
    <rect x="${x + 48}" y="${y + 44}" width="24" height="3.6" rx="1.8" fill="${palette.text3}" opacity="0.6"/>
    <rect x="${x + 48}" y="${y + 52}" width="11" height="3.6" rx="1.8" fill="${palette.brand500}" opacity="0.7"/>
    <rect x="${x + 62}" y="${y + 52}" width="11" height="3.6" rx="1.8" fill="${palette.brand500}" opacity="0.7"/>
    <rect x="${x + 76}" y="${y + 52}" width="11" height="3.6" rx="1.8" fill="${palette.brand500}" opacity="0.7"/>
    <circle cx="${x + w - 13}" cy="${y + h - 13}" r="7.5" fill="url(#${p}ch)" stroke="${palette.white}" stroke-opacity="0.6" stroke-width="0.6"/>
    <path d="M${x + w - 18.5} ${y + h - 13} C${x + w - 16} ${y + h - 17.5} ${x + w - 10} ${y + h - 17.5} ${x + w - 7.5} ${y + h - 13}" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="0.7"/>
    <rect x="${x + w - 30}" y="${y + 14}" width="11" height="8" rx="2" fill="url(#${p}cc)" stroke="#8C6620" stroke-opacity="0.5" stroke-width="0.4"/>
    <path d="M${x + w - 30} ${y + 18} H${x + w - 19} M${x + w - 24.5} ${y + 14} V${y + 22}" stroke="#8C6620" stroke-opacity="0.45" stroke-width="0.4"/>
    <polygon clip-path="url(#${p}cl)" points="${x + 8},${y + 1} ${x + 36},${y + 1} ${x + 14},${y + h - 1} ${x - 6},${y + h - 1}" fill="url(#${p}cs)" opacity="0.5"/>
  </g>`;
}

/** El recorte del carnet, para que un velo o un reflejo no se salga de sus esquinas redondeadas. */
const recorte = (id: string) =>
  `<clipPath id="${id}"><rect x="${C.x}" y="${C.y}" width="${C.w}" height="${C.h}" rx="${C.r}"/></clipPath>`;

function carnetBien() {
  return fondo('a', `${carnetDefs('a')}${carnet('a')}`);
}

function carnetOscuro() {
  return `<defs>${recorte('bc')}</defs>${fondo('b', `${carnetDefs('b')}${carnet('b')}`)}
    <g clip-path="url(#bc)"><rect x="0" y="0" width="${W}" height="${H}" fill="${palette.bg}" opacity="0.7"/></g>`;
}

function carnetReflejo() {
  // Dos bandas diagonales de luz con degradado que cruzan justo la zona del texto: es donde un reflejo hace dano.
  return `<defs>${recorte('rc')}<linearGradient id="rg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.25"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0.25"/>
    </linearGradient></defs>${fondo('r', `${carnetDefs('r')}${carnet('r')}`)}
    <g clip-path="url(#rc)">
      <polygon points="74,10 98,10 70,90 46,90" fill="url(#rg)" opacity="0.78"/>
      <polygon points="104,10 112,10 84,90 76,90" fill="url(#rg)" opacity="0.5"/>
    </g>`;
}

function carnetBorroso() {
  // Cinco copias desplazadas a baja opacidad: el mismo efecto de «se movio» en iOS, Android y web.
  const copias = [[-2.6, -1], [-1.3, 0.5], [0, 0], [1.3, -0.5], [2.6, 1]]
    .map(([dx, dy]) => `<g transform="translate(${dx} ${dy})">${carnet('d', 0.26)}</g>`)
    .join('');
  return fondo('d', `${carnetDefs('d')}${copias}`);
}

function carnetInclinado() {
  // Girado y aplastado en vertical, con un sesgo: se lee como un carnet visto de lado sobre una mesa.
  return fondo(
    'e',
    `${carnetDefs('e')}<g transform="translate(80 50) rotate(-20) scale(0.88 0.6) skewX(-16) translate(-80 -50)">${carnet('e')}</g>`,
  );
}

/* ------------------------------------------------------------------ la cara */

type Piel = typeof PIEL;

/** Los degradados de un retrato, con el prefijo del dibujo. */
function retratoDefs(p: string, piel: Piel, contraluz: boolean): string {
  return `<defs>
    <radialGradient id="${p}pi" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="${piel.luz}"/><stop offset="0.55" stop-color="${piel.media}"/><stop offset="1" stop-color="${piel.sombra}"/>
    </radialGradient>
    <linearGradient id="${p}cu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${piel.sombra}"/><stop offset="1" stop-color="${piel.media}"/>
    </linearGradient>
    <linearGradient id="${p}pe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PELO.luz}"/><stop offset="0.5" stop-color="${PELO.medio}"/><stop offset="1" stop-color="${PELO.oscuro}"/>
    </linearGradient>
    <linearGradient id="${p}ca" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.brand500}" stop-opacity="${contraluz ? 0.5 : 0.95}"/><stop offset="1" stop-color="${palette.brand900}" stop-opacity="${contraluz ? 0.6 : 1}"/>
    </linearGradient>
    <radialGradient id="${p}ir" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#9A744D"/><stop offset="0.6" stop-color="#5B3F27"/><stop offset="1" stop-color="#2E1D10"/>
    </radialGradient>
    <radialGradient id="${p}ru" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#F08A7A" stop-opacity="0.38"/><stop offset="1" stop-color="#F08A7A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}la" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C97A6E"/><stop offset="1" stop-color="#A85C56"/>
    </linearGradient>
    <linearGradient id="${p}le" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3A4250"/><stop offset="1" stop-color="#07090C"/>
    </linearGradient>
  </defs>`;
}

/** Camisa y cuello: los hombros con volumen, el cuello con la sombra de la barbilla encima. */
function torso(p: string, piel: Piel): string {
  return `<path d="M28 100 L28 91 C28 80 46 76 63 73.5 C70 80 90 80 97 73.5 C114 76 132 80 132 91 L132 100 Z" fill="url(#${p}ca)"/>
    <path d="M32 91 C32 83 46 79.5 61 77" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M66 74 C72 85 88 85 94 74" fill="none" stroke="${palette.brand900}" stroke-opacity="0.55" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M70.5 58 L70.5 76 C70.5 82 89.5 82 89.5 76 L89.5 58 Z" fill="url(#${p}cu)"/>
    <ellipse cx="80" cy="67.6" rx="12.5" ry="4" fill="${piel.borde}" opacity="0.42"/>`;
}

/** El rostro de frente: cabeza, orejas, pelo, cejas, ojos, nariz, labios y rubor. */
function rostro(p: string, piel: Piel, opts: { gafas?: boolean } = {}): string {
  const ojo = (espejo: boolean) => `<g${espejo ? ' transform="translate(160 0) scale(-1 1)"' : ''}>
      <path d="M65 28.4 C68 25.6 73 25.6 76.6 27.8" fill="none" stroke="${PELO.oscuro}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M66 33.6 C68.5 30.6 73.5 30.6 76 33.6 C73.5 36.2 68.5 36.2 66 33.6 Z" fill="#F6F2EC"/>
      <circle cx="71" cy="33.4" r="2.5" fill="url(#${p}ir)"/><circle cx="71" cy="33.4" r="1.05" fill="#0F0A07"/>
      <circle cx="71.9" cy="32.5" r="0.62" fill="#fff"/>
      <path d="M65.6 33.8 C68.5 30.2 73.5 30.2 76.4 33.8" fill="none" stroke="#2F2018" stroke-width="0.95" stroke-linecap="round"/>
      <path d="M67 35.4 C69 36.6 73 36.6 75 35.4" fill="none" stroke="${piel.borde}" stroke-opacity="0.45" stroke-width="0.5"/>
    </g>`;
  const lentes = `<rect x="63.5" y="29.5" width="13.5" height="9" rx="4" fill="url(#${p}le)" stroke="#06080B" stroke-width="1"/>
      <rect x="83" y="29.5" width="13.5" height="9" rx="4" fill="url(#${p}le)" stroke="#06080B" stroke-width="1"/>
      <path d="M77 33 C79 31.8 81 31.8 83 33" fill="none" stroke="#06080B" stroke-width="1"/>
      <path d="M65.5 31.2 L69.5 31.2 L67.2 36.6 L65.5 36.6 Z" fill="#fff" opacity="0.28"/>
      <path d="M85 31.2 L89 31.2 L86.7 36.6 L85 36.6 Z" fill="#fff" opacity="0.28"/>`;
  return `<ellipse cx="58.6" cy="36" rx="3" ry="5.6" fill="${piel.media}"/><ellipse cx="58.8" cy="36.2" rx="1.3" ry="3.2" fill="${piel.sombra}" opacity="0.7"/>
    <ellipse cx="101.4" cy="36" rx="3" ry="5.6" fill="${piel.media}"/><ellipse cx="101.2" cy="36.2" rx="1.3" ry="3.2" fill="${piel.sombra}" opacity="0.7"/>
    <path d="M80 9 C93 9 101 19 101 33 C101 46 96 58 88 64 C85 66.6 82.5 67.6 80 67.6 C77.5 67.6 75 66.6 72 64 C64 58 59 46 59 33 C59 19 67 9 80 9 Z" fill="url(#${p}pi)"/>
    <path d="M60.4 40 C61 49 65 57 71 62" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M58 37 C54.5 18 66 5.5 80.5 6 C95.5 6.5 106 18 102 37 C100.6 28.5 96 22.5 89.5 20 C84 24.4 72 24.4 66.2 19.4 C62.4 24 59.4 30 58 37 Z" fill="url(#${p}pe)"/>
    <path d="M68 12 C74 8.6 82 8 89 10.4 M64 18 C68 14 73 12 79 11.6 M92 14 C97 17 100 22 100.6 28" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="0.7" stroke-linecap="round"/>
    <ellipse cx="68" cy="48" rx="5.6" ry="3.2" fill="url(#${p}ru)"/><ellipse cx="92" cy="48" rx="5.6" ry="3.2" fill="url(#${p}ru)"/>
    ${ojo(false)}${ojo(true)}${opts.gafas ? lentes : ''}
    <path d="M80 35 C80.6 40.4 81 44 82.2 47" fill="none" stroke="${piel.luz}" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round"/>
    <path d="M82.8 38 C85.4 44 85.4 47.8 82.2 49.8" fill="none" stroke="${piel.borde}" stroke-opacity="0.4" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M76.4 50.2 C78.4 51.8 81.6 51.8 83.6 50.2" fill="none" stroke="${piel.borde}" stroke-opacity="0.6" stroke-width="0.9" stroke-linecap="round"/>
    <ellipse cx="77.7" cy="49.9" rx="1.15" ry="0.7" fill="${piel.borde}" opacity="0.7"/><ellipse cx="82.3" cy="49.9" rx="1.15" ry="0.7" fill="${piel.borde}" opacity="0.7"/>
    <ellipse cx="80" cy="47.6" rx="1.4" ry="0.85" fill="${piel.luz}" opacity="0.5"/>
    <path d="M73.5 57 C76 55.5 78.6 55.8 80 56.4 C81.4 55.8 84 55.5 86.5 57 C84 58.1 82 58.3 80 58.2 C78 58.3 76 58.1 73.5 57 Z" fill="${'#C06E66'}"/>
    <path d="M74.6 57.6 C77 61.6 83 61.6 85.4 57.6 C83 58.7 77 58.7 74.6 57.6 Z" fill="url(#${p}la)"/>
    <path d="M73.5 57 C77 58.3 83 58.3 86.5 57" fill="none" stroke="#7E403C" stroke-width="0.55" stroke-linecap="round"/>
    <ellipse cx="80" cy="60" rx="2.6" ry="0.7" fill="#fff" opacity="0.22"/>
    <ellipse cx="80" cy="64" rx="3.6" ry="1.5" fill="${piel.luz}" opacity="0.25"/>`;
}

/** Un retrato completo. `dy` lo baja, `oscura` lo apaga (contraluz), `gafas` le pone lentes oscuros. */
function retrato(p: string, opts: { dy?: number; oscura?: boolean; gafas?: boolean } = {}): string {
  const piel = opts.oscura ? PIEL_OSCURA : PIEL;
  return `${retratoDefs(p, piel, Boolean(opts.oscura))}<g transform="translate(0 ${opts.dy ?? 0})">${torso(p, piel)}${rostro(p, piel, { gafas: opts.gafas })}</g>`;
}

const ovaloGuia = (op: number) =>
  `<ellipse cx="80" cy="38" rx="30" ry="36" fill="none" stroke="${palette.brand400}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" opacity="${op}"/>`;

function caraBien() {
  // El ovalo de guia, discontinuo y en menta: es lo que le dice «aqui va tu cara».
  return fondo('f', `${retrato('f')}${ovaloGuia(0.85)}`);
}

function caraLadeada() {
  // Cabeza girada y descentrada: el fallo es de encuadre, asi que el dibujo cambia el encuadre.
  return fondo('g', `<g transform="translate(22 6) rotate(-16 80 100)">${retrato('g')}</g>${ovaloGuia(0.5)}`);
}

function caraPerfil() {
  // De lado, mirando a la derecha: se ve UNA oreja y la nariz sale del contorno. Es lo que el motor y la persona que
  // revisa necesitan comprobar, y lo que el dibujo tiene que dejar claro.
  const p = 'h';
  const piel = PIEL;
  return fondo(
    p,
    `${retratoDefs(p, piel, false)}
    ${torso(p, piel)}
    <path d="M76 9 C90 8 100 16 101 28 C101.4 32 102 34.4 103.6 38 C105.4 40.6 105.6 42 103 43.4 C103.8 44.8 103.8 46.2 102.6 47.2 C103.2 49 102.8 51 101.2 52.4 C101.4 55 100.4 58 97.4 60 C95.4 61.6 92 62.6 88 62.6 C82 64.4 74 62.6 70 56.4 C66 50.4 64 42 64 34 C64 19 68 10 76 9 Z" fill="url(#${p}pi)"/>
    <path d="M101.4 29 C102 33 103.2 36 105 40.6 C105.6 42.2 105 43 103 43.4" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M102 27 C103 14 94 6.5 83 7 C70 7.5 62.5 20 64 38 C64.5 48 66.5 55 70 58 C71 52 72 44 74 36 C76 28 82 21.6 90 20.2 C95 19.6 99 22 102 27 Z" fill="url(#${p}pe)"/>
    <path d="M70 13 C76 9.4 84 9.2 91 11.6 M66 20 C70 15.6 75 13.6 81 13.4" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="0.7" stroke-linecap="round"/>
    <ellipse cx="80" cy="38.4" rx="4.2" ry="6.6" fill="${piel.media}" stroke="${piel.borde}" stroke-opacity="0.55" stroke-width="0.7"/>
    <path d="M79 34.6 C82 34 83 38 81 41.6 C80.4 42.6 79.4 42.4 79.4 41" fill="none" stroke="${piel.sombra}" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M91.4 27.8 C94.2 25.8 98 26 100.4 27.6" fill="none" stroke="${PELO.oscuro}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M92 33.2 C93.6 31.2 97 31.2 98.8 33.2 C97 35 93.6 35 92 33.2 Z" fill="#F6F2EC"/>
    <circle cx="96.6" cy="33.1" r="1.9" fill="url(#${p}ir)"/><circle cx="97" cy="33.1" r="0.85" fill="#0F0A07"/><circle cx="97.5" cy="32.4" r="0.5" fill="#fff"/>
    <path d="M91.8 33.4 C93.6 30.8 97 30.8 99 33.4" fill="none" stroke="#2F2018" stroke-width="0.9" stroke-linecap="round"/>
    <ellipse cx="90" cy="47.6" rx="5.4" ry="3.2" fill="url(#${p}ru)"/>
    <path d="M102.9 47.2 C101.3 46.8 99.7 47.4 98.8 48.5 C100 49.2 101.5 49.2 102.7 48.7 Z" fill="#C06E66"/>
    <path d="M102.4 49.3 C100.9 49.3 99.5 49.5 98.8 50.4 C100 51.9 101.9 52 102.7 51 C103 50.4 102.9 49.8 102.4 49.3 Z" fill="url(#${p}la)"/>
    <path d="M98.6 49.2 C97 49.6 95.8 49.4 94.8 48.8" fill="none" stroke="#7E403C" stroke-width="0.55" stroke-linecap="round"/>
    <ellipse cx="100.2" cy="45.6" rx="2.2" ry="0.9" fill="${piel.borde}" opacity="0.5"/>`,
  );
}

function caraGafas() {
  return fondo('i', retrato('i', { gafas: true }));
}

function caraContraluz() {
  // La luz esta DETRAS: un fogonazo claro tras la cabeza que la rodea con un halo, y la cara, por delante, apagada.
  return `<defs><radialGradient id="jg" cx="50%" cy="40%" r="55%">
      <stop offset="0" stop-color="${palette.white}" stop-opacity="0.98"/>
      <stop offset="0.5" stop-color="${palette.tint}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${palette.bgElevated}" stop-opacity="0"/>
    </radialGradient></defs>${fondo('j', `<rect width="${W}" height="${H}" fill="url(#jg)"/>`)}
    ${retrato('j', { oscura: true })}
    <path d="M57 36 C53 17 65.5 4.5 80.5 5 C96 5.5 107 17 103 36" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round"/>`;
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
