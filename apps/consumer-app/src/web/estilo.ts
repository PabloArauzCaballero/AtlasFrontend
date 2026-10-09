/**
 * La identidad WEB de Atlas: la hoja de estilo de la landing, generada desde los tokens.
 *
 * ## Por qué existe
 *
 * `tokens.ts` ya lleva la paleta, la tipografía y los radios de `AtlasLandingPage/style.css`, y
 * con eso las pantallas del teléfono se ven de la marca. Pero la landing no es sólo colores: es una
 * COMPOSICIÓN de escritorio (barra superior, rejilla de 1.220 px, dos columnas), una ATMÓSFERA
 * (aurora, grano, malla), unos OBJETOS (la tarjeta de cuenta 3D) y una GRAMÁTICA de movimiento
 * (resortes `linear()`, entradas con desenfoque, hover con elevación, brillo del botón). Nada de
 * eso existe en React Native, y todo eso es lo que separa «una app estirada» de una web propia.
 *
 * ## Cómo se aplica sin tocar las pantallas
 *
 * Las primitivas (`Button`, `Card`, `AtlasText`, campos, `Screen`) llevan en web un atributo
 * `data-atlas="…"` (`webData()`); esta hoja se engancha a esos atributos. Las 42 pantallas siguen
 * pintando lo mismo; el CSS les da hover, foco, escala de escritorio y composición. Lo que sí es
 * DOM puro (la barra superior, la aurora, la tarjeta 3D, el hero) usa las clases de la landing con
 * los mismos nombres.
 *
 * ## Una sola fuente
 *
 * Todas las variables CSS salen de `tokens.ts`: ningún color literal aquí. Cambiar la marca sigue
 * siendo cambiar los tokens. Los resortes `linear()` y la escala fluida son literalmente los de la
 * landing (`--spring`, `--pop`, `--glide`, `--fs-h1`…), con los mismos nombres para que el
 * playbook se lea igual en los dos repos.
 *
 * ## El tema claro (rediseño 2026-10)
 *
 * La hoja sigue al tema ACTIVO de `tokens.ts`: papel gris agrupado, tarjetas blancas, tinta casi
 * negra, la fuente del sistema, sombras cortas y un único navy sólido para la acción principal. La
 * atmósfera queda a un susurro para no ensuciar el gris. El MOVIMIENTO (resortes, entradas, hover
 * con elevación, la tarjeta 3D) no cambió. La tarjeta 3D es un objeto y sigue en navy.
 */
import { Platform } from 'react-native';
import { alpha, color, font, luz, metal, space, weight } from '../theme/tokens';
import { TOQUES, ladosDe } from '../ui/hit-slop';
import { ANCHO_REJILLA, TRAMO } from '../ui/responsive';

/*
  Los cortes de la hoja salen de `ui/responsive.ts`, no de números sueltos: `tableta` (600) es
  donde la web deja de ser el teléfono, `panelLateral` (940) donde cabe la segunda columna del
  acceso, `escritorio` (1024) donde entra la rejilla. Si cambian allí, cambian aquí.
*/
const DESDE_TABLETA = `(min-width:${TRAMO.tableta}px)`;
const HASTA_TELEFONO = `(max-width:${TRAMO.tableta - 1}px)`;
const HASTA_SIN_PANEL = `(max-width:${TRAMO.panelLateral - 1}px)`;
const DESDE_ESCRITORIO = `(min-width:${TRAMO.escritorio}px)`;
const HASTA_TABLETA = `(max-width:${TRAMO.escritorio - 1}px)`;
const REJILLA = `${ANCHO_REJILLA}px`;

const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/**
 * La pila de la fuente del sistema: SF Pro en Apple, Segoe en Windows, Roboto en Android. Es la
 * web de `font.*` (que en el teléfono vale 'System'): el grosor viaja en `font-weight`, no en el
 * nombre, así que cada familia de abajo tiene su variable de peso (`--w-*`, de `weight.*`).
 */
const SISTEMA_WEB = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif';

/** Variables: los tokens, con los nombres de `style.css`. */
export const variables = `
:root{
  --navy:${color.brand.navy};--b1:${color.brand.b700};--b2:${color.brand.b500};--b3:${color.brand.b400};--b4:${color.brand.b300};
  --tint:${color.brand.tint};--on-brand:${color.text.onBrand};
  --navy-rgb:${rgb(color.brand.navy)};--b1-rgb:${rgb(color.brand.b700)};--b2-rgb:${rgb(color.brand.b500)};--b3-rgb:${rgb(color.brand.b400)};
  --bg:${color.surface.primary};--bg-2:${color.surface.secondary};--bg-card:${color.surface.raised};--sunken:${color.surface.sunken};
  --ink:${color.fill.subtle};--ink-2:${color.fill.base};--ink-3:${color.fill.strong};--line:${color.border.subtle};--line-2:${color.border.strong};
  --t1:${color.text.primary};--t2:${color.text.secondary};--t3:${color.text.tertiary};
  --danger:${color.feedback.danger};--warning:${color.feedback.warning};
  /* La acción principal: navy sólido, sin degradado ni neón (un banco no brilla). */
  --action:${color.action.primary};--action-pressed:${color.action.primaryPressed};--on-action:${color.text.onBrand};
  --accent:${color.accent.base};--accent-soft:${color.accent.soft};--accent-line:${color.accent.border};
  --focus:${color.border.focus};--focus-ring:${alpha(color.accent.base, 0.16)};
  --selection:${alpha(color.accent.base, 0.22)};
  --scrim:${color.overlay.scrim};
  --scroll-thumb:${color.fill.strong};--scroll-thumb-hover:${alpha(color.text.placeholder, 0.55)};
  /* El material translúcido de la barra superior, como el de iOS: el papel con alfa y desenfoque. */
  --material:${alpha(color.surface.primary, 0.72)};--material-card:${alpha(color.surface.raised, 0.86)};
  --shadow-rgb:${rgb(luz.negro)};--light-rgb:${rgb(luz.blanco)};--opaco:${luz.negro};
  --g:linear-gradient(135deg,${color.brandGradient.join(',')});
  --g-deep:linear-gradient(145deg,var(--navy),var(--b1) 55%,var(--b3));
  --g-soft:linear-gradient(150deg,rgba(var(--b2-rgb),.08),rgba(var(--b3-rgb),.04));
  /* La tarjeta 3D es un OBJETO: navy en cualquier tema, con la rampa original del escenario de marca. */
  --card-navy:${color.stage.brand.navy};--card-deep:${color.stage.brand.navyProfundo};--card-b1:${color.stage.brand.b700};
  --card-accent:${color.stage.brand.b400};--card-ink:${luz.blanco};
  --chip-claro:${metal.chip.claro};--chip-medio:${metal.chip.medio};--chip-brillo:${metal.chip.brillo};
  --phone:${color.stage.bg};--phone-frame:${color.stage.bgElevated};
  --display:${SISTEMA_WEB};--display-bold:${SISTEMA_WEB};
  --body:${SISTEMA_WEB};--body-semi:${SISTEMA_WEB};--body-bold:${SISTEMA_WEB};--body-black:${SISTEMA_WEB};
  --w-display:${weight.displayBlack};--w-display-bold:${weight.displayBold};
  --w-body:${weight.bodyMedium};--w-semi:${weight.bodySemi};--w-bold:${weight.bodyBold};--w-black:${weight.bodyBlack};
  /* El logotipo es la única palabra en la fuente de la marca, como en el teléfono (font.brand). */
  --brand-font:'${font.brand}','Sora',${SISTEMA_WEB};
  --fs-h1:clamp(2.9rem,7.2vw,5.6rem);--fs-h2:clamp(2rem,4.6vw,3.4rem);--fs-h3:clamp(1.05rem,1.5vw,1.25rem);
  --fs-lead:clamp(1rem,1.35vw,1.14rem);
  --pad:clamp(44px,4.6vw,72px);--gap:clamp(1rem,2vw,1.5rem);--r:20px;--r-lg:28px;--r-xl:40px;
  --spring:linear(0,.006,.025 2.8%,.101 6.1%,.539 18.9%,.721 25.3%,.849 31.5%,.937 38.1%,.968 41.8%,.991 45.7%,1.006 50.1%,1.015 55%,1.017 63.9%,1.001 100%);
  --pop:linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077 21%,1.121,1.149 26.6%,1.155,1.153 30.8%,1.129 33.8%,1.052 40%,1.007 44.4%,.981 50.7%,.98 59.4%,1.002 78.5%,1);
  --glide:cubic-bezier(.32,.72,0,1);--e:cubic-bezier(.22,1,.36,1);
  --t-fast:.28s;--t-base:.55s;--t-slow:.9s;
  /*
    Sombras CORTAS, como en iOS: sobre el gris la tarjeta blanca ya se separa por tono, la sombra
    sólo confirma que está encima. --sh-hover es la elevación sutil del hover; --sh-b, la del
    botón principal (navy, sin halo).
  */
  --sh:0 1px 2px rgba(var(--shadow-rgb),.04),0 8px 24px rgba(var(--shadow-rgb),.06);
  --sh-hover:0 2px 4px rgba(var(--shadow-rgb),.05),0 14px 32px rgba(var(--shadow-rgb),.09);
  --sh-b:0 1px 2px rgba(var(--navy-rgb),.14),0 4px 12px -2px rgba(var(--navy-rgb),.18);
  --sh-b-hover:0 2px 4px rgba(var(--navy-rgb),.14),0 10px 22px -6px rgba(var(--navy-rgb),.28);
  --nav-h:76px;
}`;

const grano = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** La hoja. Todo lo de escritorio va detrás de `@media ${DESDE_TABLETA}`: a 390 px la web es la app. */
export const hoja = `
${variables}

/* ── Base ─────────────────────────────────────────────────────────── */
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;font-synthesis-weight:none}
::selection{background:var(--selection);color:var(--t1)}
::-webkit-scrollbar{width:11px}::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:99px;border:3px solid var(--bg)}
::-webkit-scrollbar-thumb:hover{background:var(--scroll-thumb-hover)}
/* El anillo de foco no toca border-radius: con uno fijo, una píldora enfocada cambiaba de forma. */
:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}

/* ── Atmósfera: aurora, grano y malla. Fijas, detrás de todo, sin capturar el puntero. ── */
/*
  Rendimiento (playbook §7): cada halo vive en su propia capa compuesta (will-change) para que el
  desenfoque se calcule UNA vez y el navegador sólo lo desplace; sin eso, en una pantalla de 2.560 px
  el filtro se recalculaba en cada fotograma y toda la ventana bajaba a 10 fps. El grano NO lleva
  mix-blend-mode: una capa fija con blend encima de toda la app obliga a recomponer la ventana
  entera cada vez que la app repinta, que con react-native-web es continuamente.
*/
.aurora{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:strict}
/*
  Sin filter:blur y sin deriva, a propósito. La landing los lleva, pero la landing es un documento
  quieto; aquí react-native-web repinta continuamente y el desenfoque de tres halos de 760 px se
  recalculaba en cada fotograma: medido a 2.560 px, 14 fps con la aurora y 61 sin ella. Un
  degradado radial con parada intermedia da la misma suavidad y se pinta una vez.
*/
/* En claro, a un susurro: el gris agrupado tiene que seguir siendo gris; los halos sólo le quitan lo plano. */
.aurora__blob{position:absolute;border-radius:50%;opacity:.5;transform:translateZ(0)}
.aurora__blob--1{width:60vw;height:60vw;max-width:760px;max-height:760px;top:-22%;left:-14%;
  background:radial-gradient(circle,rgba(var(--b2-rgb),.07),rgba(var(--b2-rgb),.02) 40%,transparent 66%)}
.aurora__blob--2{width:52vw;height:52vw;max-width:660px;max-height:660px;top:6%;right:-16%;
  background:radial-gradient(circle,rgba(var(--b3-rgb),.05),rgba(var(--b3-rgb),.015) 40%,transparent 66%)}
.aurora__blob--3{width:46vw;height:46vw;max-width:600px;max-height:600px;top:52%;left:34%;
  background:radial-gradient(circle,rgba(var(--navy-rgb),.04),rgba(var(--navy-rgb),.012) 40%,transparent 66%)}
.noise{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.018;background-image:${grano};contain:strict}
.mesh{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(rgba(var(--shadow-rgb),.025) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--shadow-rgb),.025) 1px,transparent 1px);
  background-size:72px 72px;
  mask-image:radial-gradient(ellipse 85% 62% at 50% 18%,var(--opaco) 25%,transparent 76%);
  -webkit-mask-image:radial-gradient(ellipse 85% 62% at 50% 18%,var(--opaco) 25%,transparent 76%)}
@media ${HASTA_TELEFONO}{.aurora,.mesh{display:none}}

/* El árbol de React va por ENCIMA de la atmósfera. */
#root{position:relative;z-index:2;isolation:isolate}
/*
  React Navigation pinta cada pantalla sobre el gris de su tema por defecto (rgb 242) con un estilo
  EN LÍNEA, y expo-router no expone el proveedor de tema desde la app. Es la única superficie de
  ese color en todo el documento; se vuelve transparente para que se vea el papel y la atmósfera.
  El rgb() de abajo es un SELECTOR que reconoce ese estilo en línea, no un color de diseño.
*/
#root div[style*="background-color: rgb(242, 242, 242)"]{background-color:transparent !important} /* selector, no color */
/* Los fondos opacos de las pantallas se vuelven transparentes para que la aurora se vea. */
@media ${DESDE_TABLETA}{
  [data-atlas="screen"],[data-atlas="screen"]>div,[data-atlas="escena"]{background-color:transparent !important}
}

/* ── Entradas: subir + escalar + salir de un desenfoque (playbook §4) ── */
@media ${DESDE_TABLETA}{
  [data-atlas="aparece"]{animation:rise var(--t-slow) var(--spring) both;animation-delay:var(--d,0ms)}
  @keyframes rise{from{opacity:0;transform:translateY(34px) scale(.975);filter:blur(9px)}to{opacity:1;transform:none;filter:blur(0)}}
  ${Array.from({ length: 12 }, (_, i) => `[data-atlas="aparece"][data-indice="${i}"]{--d:${i * 70}ms}`).join('\n  ')}
}
@media (prefers-reduced-motion:reduce){[data-atlas="aparece"]{animation:none}}

/* ── Botones: píldora, brillo, elevación ── */
[data-atlas="btn"]{cursor:pointer;isolation:isolate;overflow:hidden;
  transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide),filter var(--t-fast) var(--glide)}
[data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"]){box-shadow:var(--sh-b)}
/*
  El destello del boton primario: SOLO cuando el puntero pasa por encima, y una vez.

  Estaba en bucle infinito cada 5 s, a la vez, en todos los botones primarios de la pantalla. Un
  brillo que se repite sin que nadie haga nada no informa de nada —no responde a ti, no marca un
  cambio de estado— y es de las cosas que hacen que una interfaz se lea como una plantilla: la
  pantalla se mueve sola. Colgado del hover tiene causa, y entonces es acabado y no adorno.
*/
[data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"])::after{content:'';position:absolute;top:0;left:-150%;width:55%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(var(--light-rgb),.16),transparent);transform:skewX(-22deg);pointer-events:none}
@keyframes sheen{from{left:-150%}to{left:170%}}
@media (hover:hover){
  [data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"]):hover::after{animation:sheen 1.1s var(--e) 1}
  /*
    Dos pixeles, no tres, y sin cambio de saturacion. La elevacion dice «esto se puede pulsar»; el
    tamano del salto no anade nada a esa frase y a tres pixeles el boton se despega de la fila que
    tiene al lado. El halo de marca ya sube; que suban ademas el color y la altura es la palanca
    cuadruple contra la que avisa la propia guia de composicion.
  */
  [data-atlas="btn"]:not([aria-disabled="true"]):hover{transform:translateY(-2px)}
  [data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"]):hover{box-shadow:var(--sh-b-hover)}
  [data-atlas="btn"][data-variant="secondary"]:not([aria-disabled="true"]):hover,
  [data-atlas="btn"][data-variant="ghost"]:not([aria-disabled="true"]):hover{background-color:var(--ink-3) !important;box-shadow:var(--sh)}
}
[data-atlas="btn"]:not([aria-disabled="true"]):active{transform:translateY(-1px) scale(.97);transition-duration:.1s}
@media (prefers-reduced-motion:reduce){
  [data-atlas="btn"]::after{animation:none}
  /* Sin transiciones de hover ni de la píldora: el estado cambia, no viaja. */
  [data-atlas="btn"],[data-atlas="card"],[data-atlas="fila"],[data-atlas="presionable"],[data-atlas="campo"],
  .nav__pill,.nav__cta,.nav__salir,.nav__link,.btn,.tag,.paso,.acard,.acard__gloss{transition:none !important}
}

/*
  ── Tarjetas y filas ──

  Una tarjeta NO se levanta al pasar el puntero. La elevacion es la respuesta a «esto se puede
  pulsar», y la mayoria de las tarjetas de esta app no se pulsan: son la caja donde viven dos
  campos de un formulario. El resultado era que al ir a escribir el telefono la caja entera daba un
  salto y proyectaba una sombra de 80 px, y eso —superficies quietas que se mueven sin motivo— es
  exactamente lo que se percibe como «plastico». Lo que si cambia es el filo, que es como una
  superficie acusa el puntero sin fingir que es un boton.

  Las filas («fila») y los pulsables si responden: esos se pulsan.
*/
[data-atlas="card"]{transition:border-color var(--t-fast)}
@media (hover:hover) and ${DESDE_TABLETA}{
  [data-atlas="card"]:hover{border-color:var(--line-2)}
  [data-atlas="fila"]:hover{background-color:var(--ink) !important}
}
[data-atlas="fila"],[data-atlas="presionable"]{cursor:pointer;transition:background-color var(--t-fast) var(--glide),transform var(--t-fast) var(--pop)}

/* ── Áreas táctiles: el hitSlop del teléfono, como pseudoelemento (ver ui/hit-slop.ts) ── */
[data-toque]{position:relative}
[data-toque]::before{content:'';position:absolute}
${TOQUES.map((t) => { const l = ladosDe(t); return `[data-toque="${t}"]::before{top:${-l.top}px;right:${-l.right}px;bottom:${-l.bottom}px;left:${-l.left}px}`; }).join('\n')}

/* ── Campos: anillo de foco de 4 px, como .field__box ── */
[data-atlas="campo"]{transition:border-color .28s,background-color .28s,box-shadow .28s}
[data-atlas="campo"]:focus,[data-atlas="campo"]:focus-within{outline:none;border-color:var(--focus) !important;background-color:var(--bg-card) !important;box-shadow:0 0 0 4px var(--focus-ring)}
[data-atlas="campo"] input{caret-color:var(--t1)}
/*
  UN solo anillo de foco por campo.

  El contorno general de foco (:focus-visible) se dibuja tambien sobre el input, que vive DENTRO
  de la caja del campo: al escribir salian dos rectangulos verdes concentricos, con el icono del
  campo atrapado entre los dos. La caja ya dice que tiene el foco —borde, fondo y halo de 4 px—, asi
  que el del input sobra. No se pierde ninguna senal: se quita la duplicada, no la unica.
*/
[data-atlas="campo"] input:focus-visible,[data-atlas="campo"] textarea:focus-visible{outline:none}
/*
  En los campos con icono el input va DENTRO de la caja de 56 px y medía sólo su renglón (23 px):
  el clic en el resto de la caja no enfocaba nada. Estirado a la altura de la caja, toda ella enfoca.
*/
[data-atlas="campo"] input,[data-atlas="campo"] textarea{align-self:stretch;height:auto;min-height:0}
/* Y hasta el borde derecho de la caja cuando es lo último de la fila: el relleno pasa a ser suyo, el texto no se mueve. */
[data-atlas="campo"]>input:last-child,[data-atlas="campo"]>textarea:last-child{margin-right:${-space.base}px;padding-right:${space.base}px}
[data-atlas="campo"] input:-webkit-autofill{-webkit-text-fill-color:var(--t1);-webkit-box-shadow:0 0 0 40px var(--sunken) inset}

/* ── Tipografía de escritorio: escala fluida sobre las mismas variantes ── */
@media ${DESDE_TABLETA}{
  [data-variant="display"]{font-size:clamp(2.6rem,5.2vw,4.2rem) !important;line-height:1.06 !important;letter-spacing:-.025em !important}
  [data-variant="hero"]{font-size:var(--fs-h2) !important;line-height:1.08 !important;letter-spacing:-.025em !important}
  [data-variant="h1"]{font-size:clamp(1.9rem,3.4vw,2.5rem) !important;line-height:1.08 !important;letter-spacing:-.022em !important}
  /*
    El titulo de una seccion baja un escalon. A 1,7 rem en la display negra, «Autorizaciones» pesaba
    casi lo mismo que «Crear cuenta», el titulo de la pantalla: dos niveles distintos de la
    jerarquia dibujados igual no son jerarquia, son dos cosas gritando a la vez.
  */
  [data-variant="h2"]{font-size:clamp(1.2rem,1.55vw,1.42rem) !important;line-height:1.2 !important;letter-spacing:-.025em !important}
  [data-variant="amountHero"]{font-size:clamp(2.8rem,5vw,4.4rem) !important;line-height:1 !important}
  [data-variant="lead"],[data-variant="body"]{font-size:.98rem !important;line-height:1.6 !important}
  [data-atlas="eyebrow"]{font-size:.72rem !important;letter-spacing:.06em !important;color:var(--t2) !important}
}

/* ── La cáscara: barra superior de la landing ── */
.nav{position:sticky;top:0;z-index:50;min-height:var(--nav-h);display:flex;align-items:center;
  background:var(--material);backdrop-filter:saturate(1.8) blur(14px);-webkit-backdrop-filter:saturate(1.8) blur(14px);
  border-bottom:1px solid var(--line)}
.nav__inner{width:min(100% - 2.6rem,${REJILLA});margin-inline:auto;display:flex;align-items:center;gap:1.4rem}
.brand{display:inline-flex;align-items:center;gap:.55rem;font-family:var(--brand-font);font-size:1.25rem;letter-spacing:-.03em;color:var(--t1)}
.nav__menu{position:relative;display:flex;align-items:center;gap:.15rem;margin-inline:auto;padding:.3rem;border-radius:99px;border:1px solid var(--line);background:var(--ink)}
.nav__link{position:relative;z-index:1;padding:.55rem 1rem;border-radius:99px;font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.9rem;color:var(--t2);transition:color .3s var(--glide)}
.nav__link:hover{color:var(--t1)}
.nav__link[aria-current="page"]{color:var(--on-action)}
.nav__pill{position:absolute;top:.3rem;bottom:.3rem;left:var(--px,0);width:var(--pw,0);border-radius:99px;background:var(--action);box-shadow:var(--sh-b);
  transition:left var(--t-base) var(--spring),width var(--t-base) var(--spring);opacity:var(--po,0)}
.nav__cuenta{display:inline-flex;align-items:center;gap:.6rem;padding:.35rem .9rem .35rem .35rem;border-radius:99px;border:1px solid var(--line);background:var(--bg-card);font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.86rem;color:var(--t1);min-width:0}
/* Un nombre largo no empuja el menú: se corta con puntos suspensivos (el nombre completo va en Perfil). */
.nav__cuenta span:not(.nav__avatar){max-width:14ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav__avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--action);color:var(--on-action);font-family:var(--display);font-weight:var(--w-display);font-size:.8rem}
.nav__cta{padding:.62rem 1.2rem;border-radius:99px;background:var(--action);color:var(--on-action);font-family:var(--body-bold);font-weight:var(--w-bold);font-size:.88rem;
  box-shadow:var(--sh-b);transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide)}
.nav__cta:hover{transform:translateY(-3px);box-shadow:var(--sh-b-hover)}
.nav__salir{padding:.55rem .8rem;border-radius:99px;font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.86rem;color:var(--t3);transition:.28s var(--e)}
.nav__salir:hover{color:var(--t1);background:var(--ink-2)}
/*
  En tableta (600–1023 px) la barra se parte en DOS filas: marca, cuenta y acción arriba; el menú
  con sus cinco destinos y la píldora en una fila propia. Antes el menú se escondía y la barra de
  pestañas también, así que entre esos anchos no había ningún enlace a Pagos ni a Avisos.
*/
@media ${HASTA_TABLETA}{
  .nav{padding-block:.6rem}
  .nav__inner{flex-wrap:wrap;gap:.7rem 1rem}
  /* flex-basis 100 % fuerza la fila propia; max-content encoge la píldora a sus cinco enlaces, centrada. */
  .nav__menu{order:9;flex-basis:100%;max-width:max-content;justify-content:center;margin-inline:auto}
  .nav__link{padding:.5rem .85rem;font-size:.86rem}
  .nav__cta{margin-left:auto}
}
/* Los controles de la barra son objetivos de al menos 44 px de alto. */
.nav__link,.nav__cuenta,.nav__cta,.nav__salir,.brand{min-height:44px;display:inline-flex;align-items:center}
.pie{width:min(100% - 2.6rem,${REJILLA});margin:3rem auto 1.6rem;padding-top:1.4rem;border-top:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:1rem 1.6rem;align-items:center;justify-content:space-between;color:var(--t3);font-size:.82rem;font-family:var(--body);font-weight:var(--w-body)}
.pie a:hover{color:var(--t1)}

/* ── Contenido bajo la cáscara: la columna se ensancha y se compone en rejilla ── */
@media ${DESDE_ESCRITORIO}{
  [data-area="app"] [data-atlas="screen"]>div{max-width:${REJILLA} !important;padding-left:1.3rem !important;padding-right:1.3rem !important;padding-top:2.2rem !important}
  [data-area="app"] [data-atlas="pie"]{max-width:${REJILLA} !important}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="ninguna"])>div{display:grid !important;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gap);align-content:start;grid-auto-flow:row}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="ninguna"])>div>*{grid-column:1 / -1;min-width:0}
  /*
    Se cuentan sólo los BLOQUES de la pantalla (los que entran con "aparece"), no cualquier hijo:
    el ScrollView de react-native-web mete un primer hijo invisible cuando hay «tirar para
    refrescar», y contarlo corría toda la rejilla una posición. De ahí ":nth-child(n of S)".
  */
  /*
    Una regla que aguanta cualquier pantalla: la cabecera a lo ancho y el resto de bloques
    alternando en dos columnas (izquierda, derecha, izquierda…). En el inicio, la tarjeta de la
    línea —el segundo bloque— también va a lo ancho: es el hero del área de cliente. Las pantallas
    del teléfono no saben nada de esto; sólo cuentan sus bloques.
  */
  [data-atlas="screen"][data-rejilla]>div>:nth-child(1 of [data-atlas="aparece"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla]>div>:nth-child(2n of [data-atlas="aparece"]){grid-column:1 / span 6}
  [data-atlas="screen"][data-rejilla]>div>:nth-child(2n+3 of [data-atlas="aparece"]){grid-column:7 / -1}
  [data-atlas="screen"][data-rejilla="inicio"]>div>:nth-child(2 of [data-atlas="aparece"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla="inicio"]>div>:nth-child(2n+3 of [data-atlas="aparece"]){grid-column:1 / span 6}
  [data-atlas="screen"][data-rejilla="inicio"]>div>:nth-child(2n+4 of [data-atlas="aparece"]){grid-column:7 / -1}
  /*
    Sin «dense»: con él, el banner del partner —el último bloque del inicio— subía a rellenar el
    hueco junto a «Tus pagos», por encima de «Tus compras», y el orden de lectura dejaba de ser el
    de la pantalla. El orden del DOM manda; los huecos se evitan con las dos reglas de abajo.
  */
  /*
    Un bloque de la columna izquierda ocupa la fila entera cuando es el ÚLTIMO o cuando el
    siguiente es un título de sección (que abre fila): un bloque a media anchura con un hueco al
    lado se leía como una tarjeta a la que le faltaba la pareja.
  */
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="inicio"])>div>:nth-child(2n of [data-atlas="aparece"]):has(+ [data-atlas="aparece"] > [data-atlas="seccion"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla="inicio"]>div>:nth-child(2n+3 of [data-atlas="aparece"]):has(+ [data-atlas="aparece"] > [data-atlas="seccion"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="inicio"])>div>:nth-child(2n of [data-atlas="aparece"]):nth-last-child(1 of [data-atlas="aparece"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla="inicio"]>div>:nth-child(2n+3 of [data-atlas="aparece"]):nth-last-child(1 of [data-atlas="aparece"]){grid-column:1 / -1}
  /* Un título de sección siempre abre fila completa: es lo que dice de qué va lo que viene debajo. */
  [data-atlas="screen"][data-rejilla]>div>[data-atlas="aparece"]:has(>[data-atlas="seccion"]){grid-column:1 / -1 !important}
  /* Lo que no es bloque (huecos, pantallas sin entrada escalonada): a lo ancho; los huecos vacíos ni se pintan. */
  [data-atlas="screen"][data-rejilla]>div>:not([data-atlas="aparece"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="ninguna"])>div>:empty{display:none}
}

/* ── Acceso y registro: dos columnas como auth.css ── */
.auth{position:relative;z-index:2;min-height:100dvh;display:grid;grid-template-columns:1fr .92fr;align-items:stretch}
.auth__main{display:flex;flex-direction:column;min-width:0}
.auth__top{display:flex;align-items:center;gap:1rem;padding:1.4rem clamp(1.5rem,3vw,2.2rem) 0}
.auth__pantalla{flex:1;display:flex;flex-direction:column;min-height:0}
.auth [data-atlas="screen"]>div{max-width:520px !important;padding-top:clamp(1.2rem,4vh,3rem) !important;padding-bottom:1rem !important}
.auth [data-atlas="pie"]{max-width:520px !important;border-top:0 !important;background:transparent !important}
/* La pantalla NO se estira a la altura de la ventana: el botón va debajo de los campos, como en login.html. */
.auth__pantalla{overflow:auto}
.auth__pantalla>div,.auth__pantalla>div>div{flex:0 0 auto !important}
.auth__pantalla [data-atlas="screen"]{flex:0 0 auto !important;overflow:visible !important}
/* La marca ya está en la cabecera de la columna: la de la pantalla del teléfono sobra aquí. */
@media ${DESDE_TABLETA}{.auth [data-atlas="marca-pantalla"]{display:none !important}}
/*
  Pegado y con su propio desplazamiento: si el panel (tarjeta + pasos + chips + cifras) no cabe en la
  altura de la ventana, se desplaza; NO se encoge. Sin esto, como columna flex centrada, la tarjeta
  —que recorta su contenido— se aplastaba hasta su primera fila en ventanas bajas.
*/
/*
  El fondo del panel: un tono, no un arcoiris.

  Iba de verde marca a navy y otra vez a verde en 160 grados, con grano en «overlay» encima. Tres
  paradas de color y una textura para un panel cuyo trabajo es acompanar: el resultado competia con
  el formulario —que es lo unico que hay que hacer en esta pantalla— y, a fuerza de degradado sobre
  degradado, se leia como un plastico iluminado por dentro. Ahora es una sola superficie apenas mas
  clara que el papel, con un solo acento muy tenue arriba. El foco vuelve a la columna izquierda.
*/
.auth__side{position:sticky;top:0;align-self:start;height:100dvh;overflow:auto;display:flex;flex-direction:column;justify-content:safe center;gap:1.6rem;
  padding:clamp(2rem,4vw,3.4rem);border-left:1px solid var(--line);
  background:radial-gradient(120% 80% at 80% 0%,rgba(var(--b2-rgb),.04),transparent 62%),var(--bg-2)}
.auth__side>*{position:relative;flex:none}
.side__lbl{font-family:var(--body-black);font-weight:var(--w-black);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--t3)}
/*
  La cita, un peso por debajo de lo que estaba.

  A 1,75 rem en la tipografia display competia de tu a tu con el titulo del formulario que tiene al
  lado —«Ingresar»—, y el ojo no sabia cual de los dos era la pantalla. Lo que manda aqui es la
  columna izquierda; la cita acompana. Mismo texto, una palanca menos.
*/
.side__quote{font-family:var(--display);font-weight:var(--w-display);font-size:clamp(1.05rem,1.35vw,1.28rem);line-height:1.34;letter-spacing:-.015em;color:var(--t2);text-wrap:balance;max-width:30ch}
.side__who{display:flex;align-items:center;gap:.8rem}
.side__who b{display:block;font-family:var(--body-bold);font-weight:var(--w-bold);font-size:.9rem;color:var(--t1)}
.side__who span{font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.78rem;color:var(--t2)}
.side__ini{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;
  background:var(--ink-2);border:1px solid var(--line-2);color:var(--accent);font-family:var(--display);font-weight:var(--w-display);font-size:.84rem}
/* La nota del registro: la unica frase del panel, y por eso no necesita ni rotulo ni caja. */
.side__nota{font-family:var(--body);font-weight:var(--w-body);font-size:.84rem;line-height:1.55;color:var(--t2);max-width:34ch;margin:0}
.side__stats{display:flex;flex-wrap:wrap;gap:1.2rem 2.2rem;padding-top:1.4rem;border-top:1px solid var(--line-2)}
.side__stats b{display:block;font-family:var(--display);font-weight:var(--w-display);font-size:1.6rem;letter-spacing:-.03em;color:var(--t1)}
.side__stats span{font-family:var(--body);font-weight:var(--w-body);font-size:.84rem;color:var(--t2)}
.steps{display:flex;flex-direction:column;gap:.7rem}
.steps li{display:flex;align-items:center;gap:.7rem;font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.86rem;color:var(--t3)}
.steps b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:var(--display);font-weight:var(--w-display);font-size:.7rem;
  background:var(--ink-2);border:1px solid var(--line-2);color:var(--t3)}
.steps .on{color:var(--t1)}.steps .on b{background:var(--action);border-color:transparent;color:var(--on-action)}
.steps .ok{color:var(--t2)}.steps .ok b{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent)}
/*
  Bajo el area de acceso y registro, la atmosfera baja el volumen.

  Los halos y la malla estan pensados para una portada, donde el contenido es poco y grande. Detras
  de un formulario de siete campos compiten con el: el ojo tiene que separar el dato del fondo antes
  de poder leerlo. Siguen ahi —la pagina no se queda plana— pero a un tercio.
*/
/*
  Por :has() y no por hermandad: la atmosfera se monta en la raiz, ANTES del arbol de navegacion,
  asi que .auth no es hermana suya de ninguna manera. Es lo mismo que ya hace la rejilla de
  escritorio unas lineas mas arriba.
*/
body:has(.auth) .aurora,body:has(.auth) .mesh{opacity:.32}
@media ${HASTA_SIN_PANEL}{.auth{grid-template-columns:1fr}.auth__side{display:none}}
@media ${HASTA_TELEFONO}{.auth__top{display:none}}

/* ── La tarjeta de cuenta 3D (.acard de la landing, entera) ── */
.acard{--rx:0;--ry:0;position:relative;width:min(100%,340px);aspect-ratio:1.585;min-height:200px;flex:none;border-radius:13px;overflow:hidden;
  padding:1.3rem 1.4rem;display:flex;flex-direction:column;gap:.4rem;isolation:isolate;color:var(--card-ink);
  background:linear-gradient(146deg,var(--card-navy) 4%,var(--card-deep) 58%,var(--card-b1) 132%);
  transform:perspective(1000px) rotateY(calc(var(--rx) * 20deg)) rotateX(calc(var(--ry) * -13deg));
  transition:transform .5s var(--glide),box-shadow .5s var(--glide);
  box-shadow:inset calc(var(--rx) * 3.4px) calc(var(--ry) * -3.4px) 0 rgba(var(--light-rgb),.42),
    inset calc(var(--rx) * -3.6px) calc(var(--ry) * 3.6px) 0 rgba(var(--shadow-rgb),.5),
    inset 0 1px 0 rgba(var(--light-rgb),.28),inset 0 -1px 0 rgba(var(--shadow-rgb),.35),0 0 0 1px rgba(var(--light-rgb),.12),
    calc(var(--rx) * -10px) calc(12px + var(--ry) * 8px) 22px -12px rgba(var(--shadow-rgb),.3),
    calc(var(--rx) * -28px) calc(40px + var(--ry) * 18px) 70px -30px rgba(var(--shadow-rgb),.34)}
/*
  El especular, a la mitad.

  A .3 de blanco en «screen» sobre el centro de la tarjeta, lo que se veia no era un reflejo: era
  una mancha borrosa blanca en mitad del objeto, y es la razon concreta por la que la tarjeta se
  leia como un juguete de plastico en vez de como una tarjeta. Un reflejo real es tenue y sigue a la
  luz; el canto que se enciende y la banda diagonal ya hacen ese trabajo. El grano se retira: una
  textura de ruido encima de un degradado es el acabado que delata una superficie falsa.
*/
.acard::before{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;mix-blend-mode:screen;
  background:radial-gradient(56% 44% at calc(50% - var(--rx) * 46%) calc(22% - var(--ry) * 38%),rgba(var(--light-rgb),.09),rgba(var(--light-rgb),.02) 42%,transparent 60%),
  linear-gradient(calc(115deg + var(--rx) * 14deg),transparent calc(18% - var(--rx) * 16%),rgba(var(--light-rgb),.08) calc(38% - var(--rx) * 16%),rgba(var(--light-rgb),.02) calc(56% - var(--rx) * 16%),transparent calc(74% - var(--rx) * 16%))}
/*
  Aqui vivia .acard--sway: la tarjeta se inclinaba sola, en bucle de 13 s, en la pantalla de
  acceso y en cada uno de los ocho pasos del registro. Un objeto que se mueve sin que nadie lo toque
  no comunica nada y obliga al ojo a descartarlo una y otra vez mientras se rellena un formulario.
  Con el puntero SI se inclina —eso responde a ti— y ese gesto se queda.
*/
@property --rx{syntax:'<number>';inherits:false;initial-value:0}
@property --ry{syntax:'<number>';inherits:false;initial-value:0}
.acard__top{display:flex;align-items:center;gap:.5rem;font-family:var(--brand-font);font-size:1rem}
.acard__chip{width:44px;height:32px;border-radius:6px;margin-top:.5rem;
  background:linear-gradient(135deg,var(--chip-brillo),var(--chip-medio) 50%,var(--chip-claro));box-shadow:inset 0 0 0 1px rgba(var(--shadow-rgb),.25),inset 0 1px 0 rgba(var(--light-rgb),.6)}
.acard__no{margin-top:auto;font-family:var(--body-bold);font-weight:var(--w-bold);font-size:.94rem;letter-spacing:.08em;color:rgba(var(--light-rgb),.75)}
/* .7rem (11,2 px) y no los .66 de la landing: aquí el rótulo lleva el nombre y el nivel de la persona, no es adorno. */
.acard__bot{display:flex;justify-content:space-between;font-family:var(--body-bold);font-weight:var(--w-bold);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(var(--light-rgb),.55)}
.acard__bot b{color:var(--card-accent)}
.acard__gloss{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .4s;mix-blend-mode:screen;
  background:radial-gradient(300px circle at var(--gx,50%) var(--gy,50%),rgba(var(--light-rgb),.16),transparent 62%)}
.acard.lit .acard__gloss{opacity:1}


/* ── El hero de la bienvenida (index.html) ── */
.portada{min-height:100dvh;background:transparent}
.hero{position:relative;z-index:2;padding:clamp(100px,14vh,160px) 0 clamp(60px,8vh,100px)}
.wrap{width:min(100% - 2.6rem,${REJILLA});margin-inline:auto}
.hero__grid{display:grid;grid-template-columns:1.06fr .94fr;gap:clamp(2rem,5vw,4.5rem);align-items:center}
.tag{display:inline-flex;align-items:center;gap:.55rem;padding:.42rem 1rem .42rem .72rem;border-radius:99px;border:1px solid var(--line-2);background:var(--ink);
  font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.82rem;color:var(--t2);margin-bottom:1.7rem;transition:border-color .3s,color .3s,transform .35s var(--e)}
.tag:hover{border-color:var(--accent-line);color:var(--t1);transform:translateY(-2px)}
.tag__dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.hero__title{font-family:var(--display);font-weight:var(--w-display);font-size:var(--fs-h1);line-height:1;letter-spacing:-.03em;color:var(--t1);text-wrap:balance;margin:0 0 1.4rem}
.hero__title em{font-style:normal;background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero__lead{font-family:var(--body);font-weight:var(--w-body);font-size:var(--fs-lead);line-height:1.6;color:var(--t2);max-width:52ch;margin:0 0 2rem}
.hero__lead b{color:var(--t1);font-family:var(--body-bold);font-weight:var(--w-bold)}
.hero__cta{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;margin-bottom:2.4rem}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;font-family:var(--body-bold);font-weight:var(--w-bold);font-size:.96rem;
  padding:.95rem 1.8rem;border-radius:99px;overflow:hidden;isolation:isolate;white-space:nowrap;cursor:pointer;color:var(--t1);
  transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide),border-color var(--t-fast),background var(--t-fast)}
.btn--primary{background:var(--action);color:var(--on-action);box-shadow:var(--sh-b)}
/* El mismo criterio que el boton de la app: el destello responde al puntero, no al reloj. */
.btn--primary::after{content:'';position:absolute;top:0;left:-150%;width:55%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(var(--light-rgb),.18),transparent);transform:skewX(-22deg)}
.btn--primary:hover{transform:translateY(-2px);box-shadow:var(--sh-b-hover)}
.btn--primary:hover::after{animation:sheen 1.1s var(--e) 1}
.btn--line{border:1px solid var(--line-2);background:var(--bg-card)}
.btn--line:hover{transform:translateY(-3px);border-color:var(--accent-line);background:var(--bg-card);box-shadow:var(--sh-hover)}
.btn:active{transform:translateY(-1px) scale(.96);transition-duration:.1s}
.hero__stats{display:flex;flex-wrap:wrap;gap:1.2rem 2rem}
.hero__stats div{padding-left:1rem;border-left:2px solid var(--accent-line)}
.hero__stats b{display:block;font-family:var(--display);font-weight:var(--w-display);font-size:1.8rem;letter-spacing:-.03em;background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero__stats span{font-family:var(--body);font-weight:var(--w-body);font-size:.84rem;color:var(--t2)}
.hero__visual{position:relative;display:grid;place-items:center;min-height:560px}
.phone{position:relative;width:330px;height:660px;border-radius:44px;background:var(--phone);border:1px solid var(--line-2);
  box-shadow:0 0 0 8px var(--phone-frame),0 0 0 9px rgba(var(--shadow-rgb),.08),var(--sh-hover);overflow:hidden;
  /* Por encima de la tarjeta que asoma por detras (z-index 1) y por debajo de las insignias (6). */
  z-index:3;
  transform:perspective(1400px) rotateY(-6deg) rotateX(2deg)}
.phone__notch{position:absolute;top:12px;left:50%;width:110px;height:28px;margin-left:-55px;border-radius:99px;background:var(--opaco);z-index:5}
.phone iframe{width:100%;height:100%;border:0;background:var(--bg)}
/*
  La tarjeta pasa DETRAS del telefono, y asoma por la izquierda.

  Estaba delante (z-index 6) y por dentro del marco: tapaba media pantalla de la app que el telefono
  esta ensenando, y lo que quedaba a los lados eran trozos de frase cortados —«…os comercios de…»,
  «…e tengo cuenta»— que se leen como un fallo de maquetacion, porque lo son. No habia sitio para
  ponerla al lado: el hueco a la izquierda del telefono mide 52 px a 1024 y la tarjeta 240.

  Detras se resuelven las dos cosas a la vez: asoma lo justo para reconocerse, la profundidad es
  mayor que solapando —un objeto que pasa por detras de otro dice «hay espacio aqui»— y la pantalla
  del telefono se lee ENTERA, que es el argumento de venta de todo el bloque.
*/
.hero__card{position:absolute;left:-14%;bottom:2%;z-index:1;width:240px}
.hero__badge{position:absolute;z-index:6;display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-radius:16px;
  background:var(--material-card);backdrop-filter:blur(10px);border:1px solid var(--line-2);box-shadow:var(--sh);font-family:var(--body-semi);font-weight:var(--w-semi);font-size:.86rem;color:var(--t1)}
.hero__badge i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-style:normal}
.hero__badge small{display:block;font-family:var(--body);font-weight:var(--w-body);font-size:.74rem;color:var(--t2)}
.hero__badge--ok{top:8%;left:-6%}
.hero__badge--bs{right:-4%;top:22%;width:74px;height:74px;justify-content:center;border-radius:50%;background:var(--action);color:var(--on-action);font-family:var(--display);font-weight:var(--w-display);font-size:1.15rem;box-shadow:var(--sh-b)}
.pasos{width:min(100% - 2.6rem,${REJILLA});margin:0 auto var(--pad);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gap)}
.paso{padding:1.5rem;border-radius:var(--r);background:var(--bg-card);border:1px solid var(--line);box-shadow:var(--sh);
  transition:transform var(--t-base) var(--spring),box-shadow var(--t-base) var(--glide),border-color var(--t-fast)}
.paso:hover{transform:translateY(-3px);box-shadow:var(--sh-hover);border-color:var(--line-2)}
.paso i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--g-soft);color:var(--accent);margin-bottom:1rem;font-style:normal;font-family:var(--display);font-weight:var(--w-display)}
.paso h3{font-family:var(--display-bold);font-weight:var(--w-display-bold);font-size:1.05rem;letter-spacing:-.02em;color:var(--t1);margin:0 0 .4rem}
.paso p{font-family:var(--body);font-weight:var(--w-body);font-size:.9rem;line-height:1.55;color:var(--t2);margin:0}
@media ${HASTA_TABLETA}{.hero__grid{grid-template-columns:1fr}.hero__visual{display:none}.pasos{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media ${HASTA_TELEFONO}{.pasos{grid-template-columns:1fr}}

/*
  El boton flotante del asistente. Fijo y no absoluto: en la web el area de cliente puede
  desplazarse bajo la cascara, y un boton de ayuda que se va con el scroll no es un boton de ayuda.
  Los !important ganan a los estilos en linea que calcula el componente para el telefono; desde
  tableta la barra de pestanas no existe y la esquina 24/24 es la convencion que todo el mundo
  conoce. El foco visible lo pone la regla global de :focus-visible.
*/
[data-atlas="asistente-fab"]{position:fixed !important;z-index:60;cursor:pointer;transition:transform var(--t-fast) var(--glide),box-shadow var(--t-fast) var(--glide)}
@media (hover:hover){
  [data-atlas="asistente-fab"]:hover{transform:translateY(-2px);box-shadow:var(--sh-b-hover)}
}
@media ${DESDE_TABLETA}{[data-atlas="asistente-fab"]{bottom:24px !important;right:24px !important}}
`;

let inyectada = false;

/** Mete la hoja en el documento una sola vez. No hace nada fuera de web. */
export function inyectarEstiloWeb(): void {
  if (Platform.OS !== 'web' || inyectada) return;
  const documento = (globalThis as { document?: Document }).document;
  if (!documento) return;
  const estilo = documento.createElement('style');
  estilo.id = 'atlas-web';
  estilo.textContent = hoja;
  documento.head.appendChild(estilo);
  inyectada = true;
}

/**
 * Atributos `data-*` para que la hoja se enganche a una primitiva. En el teléfono devuelve `{}`:
 * las pantallas los esparcen sin saber en qué plataforma corren.
 */
export function webData(atlas: string, extra?: Record<string, string>): object {
  if (Platform.OS !== 'web') return {};
  return { dataSet: { atlas, ...(extra ?? {}) } };
}
