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
 */
import { Platform } from 'react-native';
import { font, palette } from '../theme/tokens';

const rgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/** Variables: los tokens, con los nombres de `style.css`. */
export const variables = `
:root{
  --navy:${palette.navy};--b1:${palette.brand700};--b2:${palette.brand500};--b3:${palette.brand400};--b4:${palette.brand300};
  --tint:${palette.tint};--on-brand:${palette.brand900};
  --navy-rgb:${rgb(palette.navy)};--b1-rgb:${rgb(palette.brand700)};--b2-rgb:${rgb(palette.brand500)};--b3-rgb:${rgb(palette.brand400)};
  --bg:${palette.bg};--bg-2:${palette.bgElevated};--bg-card:${palette.bgCard};
  --ink:${palette.ink04};--ink-2:${palette.ink07};--line:${palette.line};--line-2:${palette.line2};
  --t1:${palette.text1};--t2:${palette.text2};--t3:${palette.text3};
  --danger:${palette.danger};--warning:${palette.warning};
  --g:linear-gradient(135deg,var(--b2),var(--b3) 55%,var(--b4));
  --g-deep:linear-gradient(145deg,var(--navy),var(--b1) 55%,var(--b3));
  --g-soft:linear-gradient(150deg,rgba(var(--b2-rgb),.16),rgba(var(--b3-rgb),.09));
  --display:'${font.displayBlack}','${font.displayBold}','Sora',system-ui,sans-serif;
  --display-bold:'${font.displayBold}','Sora',system-ui,sans-serif;
  --body:'${font.bodyMedium}','Manrope',system-ui,sans-serif;
  --body-semi:'${font.bodySemi}','Manrope',system-ui,sans-serif;
  --body-bold:'${font.bodyBold}','Manrope',system-ui,sans-serif;
  --body-black:'${font.bodyBlack}','Manrope',system-ui,sans-serif;
  --fs-h1:clamp(2.9rem,7.2vw,5.6rem);--fs-h2:clamp(2rem,4.6vw,3.4rem);--fs-h3:clamp(1.05rem,1.5vw,1.25rem);
  --fs-lead:clamp(1rem,1.35vw,1.14rem);
  --pad:clamp(44px,4.6vw,72px);--gap:clamp(1rem,2vw,1.5rem);--r:20px;--r-lg:28px;--r-xl:40px;
  --spring:linear(0,.006,.025 2.8%,.101 6.1%,.539 18.9%,.721 25.3%,.849 31.5%,.937 38.1%,.968 41.8%,.991 45.7%,1.006 50.1%,1.015 55%,1.017 63.9%,1.001 100%);
  --pop:linear(0,.009,.035 2.1%,.141,.281 6.7%,.723 12.9%,.938 16.7%,1.017,1.077 21%,1.121,1.149 26.6%,1.155,1.153 30.8%,1.129 33.8%,1.052 40%,1.007 44.4%,.981 50.7%,.98 59.4%,1.002 78.5%,1);
  --glide:cubic-bezier(.32,.72,0,1);--e:cubic-bezier(.22,1,.36,1);
  --t-fast:.28s;--t-base:.55s;--t-slow:.9s;
  --sh:0 30px 80px -28px rgba(0,0,0,.8);--sh-b:0 24px 64px -20px rgba(var(--b2-rgb),.5);
  --nav-h:76px;
}`;

const grano = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** La hoja. Todo lo de escritorio va detrás de `@media (min-width:600px)`: a 390 px la web es la app. */
export const hoja = `
${variables}

/* ── Base ─────────────────────────────────────────────────────────── */
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;font-synthesis-weight:none}
::selection{background:rgba(var(--b2-rgb),.45);color:#fff}
::-webkit-scrollbar{width:11px}::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:#1c2137;border-radius:99px;border:3px solid var(--bg)}
::-webkit-scrollbar-thumb:hover{background:#2a3050}
:focus-visible{outline:2px solid var(--b3);outline-offset:3px;border-radius:8px}
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
.aurora__blob{position:absolute;border-radius:50%;opacity:.55;transform:translateZ(0)}
.aurora__blob--1{width:60vw;height:60vw;max-width:760px;max-height:760px;top:-22%;left:-14%;
  background:radial-gradient(circle,rgba(var(--b2-rgb),.42),rgba(var(--b2-rgb),.12) 40%,transparent 66%)}
.aurora__blob--2{width:52vw;height:52vw;max-width:660px;max-height:660px;top:6%;right:-16%;
  background:radial-gradient(circle,rgba(var(--b3-rgb),.26),rgba(var(--b3-rgb),.08) 40%,transparent 66%)}
.aurora__blob--3{width:46vw;height:46vw;max-width:600px;max-height:600px;top:52%;left:34%;
  background:radial-gradient(circle,rgba(var(--b1-rgb),.34),rgba(var(--b1-rgb),.10) 40%,transparent 66%)}
.noise{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.035;background-image:${grano};contain:strict}
.mesh{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
  background-size:72px 72px;
  mask-image:radial-gradient(ellipse 85% 62% at 50% 18%,#000 25%,transparent 76%);
  -webkit-mask-image:radial-gradient(ellipse 85% 62% at 50% 18%,#000 25%,transparent 76%)}
@media (max-width:599px){.aurora,.mesh{display:none}}

/* El árbol de React va por ENCIMA de la atmósfera. */
#root{position:relative;z-index:2;isolation:isolate}
/*
  React Navigation pinta cada pantalla sobre el gris de su tema por defecto (rgb 242) con un estilo
  EN LÍNEA, y expo-router no expone el proveedor de tema desde la app. Es la única superficie de
  ese color en todo el documento; se vuelve transparente para que se vea el navy y la atmósfera.
*/
#root div[style*="background-color: rgb(242, 242, 242)"]{background-color:transparent !important}
/* Los fondos opacos de las pantallas se vuelven transparentes para que la aurora se vea. */
@media (min-width:600px){
  [data-atlas="screen"],[data-atlas="screen"]>div,[data-atlas="escena"]{background-color:transparent !important}
}

/* ── Entradas: subir + escalar + salir de un desenfoque (playbook §4) ── */
@media (min-width:600px){
  [data-atlas="aparece"]{animation:rise var(--t-slow) var(--spring) both;animation-delay:var(--d,0ms)}
  @keyframes rise{from{opacity:0;transform:translateY(34px) scale(.975);filter:blur(9px)}to{opacity:1;transform:none;filter:blur(0)}}
  ${Array.from({ length: 12 }, (_, i) => `[data-atlas="aparece"][data-indice="${i}"]{--d:${i * 70}ms}`).join('\n  ')}
}
@media (prefers-reduced-motion:reduce){[data-atlas="aparece"]{animation:none}}

/* ── Botones: píldora, brillo, elevación ── */
[data-atlas="btn"]{cursor:pointer;isolation:isolate;overflow:hidden;
  transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide),filter var(--t-fast) var(--glide)}
[data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"]){box-shadow:var(--sh-b)}
[data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"])::after{content:'';position:absolute;top:0;left:-150%;width:55%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-22deg);animation:sheen 5s var(--e) infinite;pointer-events:none}
@keyframes sheen{0%,74%{left:-150%}100%{left:170%}}
@media (hover:hover){
  [data-atlas="btn"]:not([aria-disabled="true"]):hover{transform:translateY(-3px)}
  [data-atlas="btn"][data-variant="primary"]:not([aria-disabled="true"]):hover{box-shadow:0 30px 70px -18px rgba(var(--b2-rgb),.8);filter:saturate(1.08)}
  [data-atlas="btn"][data-variant="secondary"]:not([aria-disabled="true"]):hover,
  [data-atlas="btn"][data-variant="ghost"]:not([aria-disabled="true"]):hover{background-color:rgba(var(--b2-rgb),.12) !important;box-shadow:0 20px 50px -24px rgba(var(--b2-rgb),.7)}
}
[data-atlas="btn"]:not([aria-disabled="true"]):active{transform:translateY(-1px) scale(.97);transition-duration:.1s}
@media (prefers-reduced-motion:reduce){[data-atlas="btn"]::after{animation:none}}

/* ── Tarjetas y filas: filo, hover con elevación ── */
[data-atlas="card"]{transition:transform var(--t-base) var(--spring),box-shadow var(--t-base) var(--glide),border-color var(--t-fast)}
@media (hover:hover) and (min-width:600px){
  [data-atlas="card"]:hover{transform:translateY(-2px);box-shadow:var(--sh);border-color:var(--line-2)}
  [data-atlas="fila"]:hover{background-color:var(--ink) !important}
}
[data-atlas="fila"],[data-atlas="presionable"]{cursor:pointer;transition:background-color var(--t-fast) var(--glide),transform var(--t-fast) var(--pop)}

/* ── Campos: anillo de foco de 4 px, como .field__box ── */
[data-atlas="campo"]{transition:border-color .28s,background-color .28s,box-shadow .28s}
[data-atlas="campo"]:focus,[data-atlas="campo"]:focus-within{outline:none;border-color:var(--b3) !important;background-color:rgba(var(--b2-rgb),.07) !important;box-shadow:0 0 0 4px rgba(var(--b2-rgb),.14)}
[data-atlas="campo"] input{caret-color:var(--t1)}
[data-atlas="campo"] input:-webkit-autofill{-webkit-text-fill-color:var(--t1);-webkit-box-shadow:0 0 0 40px #0b2033 inset}

/* ── Tipografía de escritorio: escala fluida sobre las mismas variantes ── */
@media (min-width:600px){
  [data-variant="display"]{font-size:clamp(2.6rem,5.2vw,4.2rem) !important;line-height:1.04 !important;letter-spacing:-.04em !important}
  [data-variant="hero"]{font-size:var(--fs-h2) !important;line-height:1.06 !important;letter-spacing:-.04em !important}
  [data-variant="h1"]{font-size:clamp(1.9rem,3.4vw,2.5rem) !important;line-height:1.08 !important;letter-spacing:-.035em !important}
  [data-variant="h2"]{font-size:clamp(1.35rem,2vw,1.7rem) !important;line-height:1.15 !important;letter-spacing:-.03em !important}
  [data-variant="amountHero"]{font-size:clamp(2.8rem,5vw,4.4rem) !important;line-height:1 !important}
  [data-variant="lead"],[data-variant="body"]{font-size:.98rem !important;line-height:1.6 !important}
  [data-atlas="eyebrow"]{font-size:.7rem !important;letter-spacing:.16em !important;color:var(--tint) !important}
}

/* ── La cáscara: barra superior de la landing ── */
.nav{position:sticky;top:0;z-index:50;height:var(--nav-h);display:flex;align-items:center;
  background:rgba(6,20,38,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line)}
.nav__inner{width:min(100% - 2.6rem,1220px);margin-inline:auto;display:flex;align-items:center;gap:1.4rem}
.brand{display:inline-flex;align-items:center;gap:.55rem;font-family:var(--display);font-size:1.25rem;letter-spacing:-.03em;color:var(--t1)}
.nav__menu{position:relative;display:flex;align-items:center;gap:.15rem;margin-inline:auto;padding:.3rem;border-radius:99px;border:1px solid var(--line);background:var(--ink)}
.nav__link{position:relative;z-index:1;padding:.55rem 1rem;border-radius:99px;font-family:var(--body-semi);font-size:.9rem;color:var(--t2);transition:color .3s var(--glide)}
.nav__link:hover{color:var(--t1)}
.nav__link[aria-current="page"]{color:var(--on-brand)}
.nav__pill{position:absolute;top:.3rem;bottom:.3rem;left:var(--px,0);width:var(--pw,0);border-radius:99px;background:var(--g);
  transition:left var(--t-base) var(--spring),width var(--t-base) var(--spring);opacity:var(--po,0)}
.nav__cuenta{display:inline-flex;align-items:center;gap:.6rem;padding:.35rem .9rem .35rem .35rem;border-radius:99px;border:1px solid var(--line-2);background:var(--ink);font-family:var(--body-semi);font-size:.86rem;color:var(--t1)}
.nav__avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--g);color:var(--on-brand);font-family:var(--display);font-size:.8rem}
.nav__cta{padding:.62rem 1.2rem;border-radius:99px;background:var(--g);color:var(--on-brand);font-family:var(--body-bold);font-size:.88rem;
  box-shadow:var(--sh-b);transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide)}
.nav__cta:hover{transform:translateY(-3px);box-shadow:0 30px 70px -18px rgba(var(--b2-rgb),.8)}
.nav__salir{padding:.55rem .8rem;border-radius:99px;font-family:var(--body-semi);font-size:.86rem;color:var(--t3);transition:.28s var(--e)}
.nav__salir:hover{color:var(--t1);background:var(--ink-2)}
@media (max-width:1023px){.nav__menu{display:none}}
.pie{width:min(100% - 2.6rem,1220px);margin:3rem auto 1.6rem;padding-top:1.4rem;border-top:1px solid var(--line);
  display:flex;flex-wrap:wrap;gap:1rem 1.6rem;align-items:center;justify-content:space-between;color:var(--t3);font-size:.82rem;font-family:var(--body)}
.pie a:hover{color:var(--t1)}

/* ── Contenido bajo la cáscara: la columna se ensancha y se compone en rejilla ── */
@media (min-width:1024px){
  [data-area="app"] [data-atlas="screen"]>div{max-width:1220px !important;padding-left:1.3rem !important;padding-right:1.3rem !important;padding-top:2.2rem !important}
  [data-area="app"] [data-atlas="pie"]{max-width:1220px !important}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="ninguna"])>div{display:grid !important;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:var(--gap);align-content:start;grid-auto-flow:row dense}
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
  /* Un título de sección siempre abre fila completa: es lo que dice de qué va lo que viene debajo. */
  [data-atlas="screen"][data-rejilla]>div>[data-atlas="aparece"]:has(>[data-atlas="seccion"]){grid-column:1 / -1 !important}
  /* Lo que no es bloque (huecos, pantallas sin entrada escalonada): a lo ancho; los huecos vacíos ni se pintan. */
  [data-atlas="screen"][data-rejilla]>div>:not([data-atlas="aparece"]){grid-column:1 / -1}
  [data-atlas="screen"][data-rejilla]:not([data-rejilla="ninguna"])>div>:empty{display:none}
}

/* ── Acceso y registro: dos columnas como auth.css ── */
.auth{position:relative;z-index:2;min-height:100dvh;display:grid;grid-template-columns:1fr .92fr;align-items:stretch}
.auth__main{display:flex;flex-direction:column;min-width:0}
.auth__top{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.4rem clamp(1.5rem,3vw,2.2rem) 0}
.auth__back{display:inline-flex;align-items:center;gap:.4rem;font-family:var(--body-semi);font-size:.86rem;color:var(--t3);padding:.5rem .8rem;border-radius:99px;transition:.28s var(--e)}
.auth__back:hover{color:var(--t1);background:var(--ink-2)}
.auth__pantalla{flex:1;display:flex;flex-direction:column;min-height:0}
.auth [data-atlas="screen"]>div{max-width:520px !important;padding-top:clamp(1.2rem,4vh,3rem) !important;padding-bottom:1rem !important}
.auth [data-atlas="pie"]{max-width:520px !important;border-top:0 !important;background:transparent !important}
/* La pantalla NO se estira a la altura de la ventana: el botón va debajo de los campos, como en login.html. */
.auth__pantalla{overflow:auto}
.auth__pantalla>div,.auth__pantalla>div>div{flex:0 0 auto !important}
.auth__pantalla [data-atlas="screen"]{flex:0 0 auto !important;overflow:visible !important}
/* La marca ya está en la cabecera de la columna: la de la pantalla del teléfono sobra aquí. */
@media (min-width:600px){.auth [data-atlas="marca-pantalla"]{display:none !important}}
/*
  Pegado y con su propio desplazamiento: si el panel (tarjeta + pasos + chips + cifras) no cabe en la
  altura de la ventana, se desplaza; NO se encoge. Sin esto, como columna flex centrada, la tarjeta
  —que recorta su contenido— se aplastaba hasta su primera fila en ventanas bajas.
*/
.auth__side{position:sticky;top:0;align-self:start;height:100dvh;overflow:auto;display:flex;flex-direction:column;justify-content:safe center;gap:1.6rem;
  padding:clamp(2rem,4vw,3.4rem);border-left:1px solid var(--line);
  background:linear-gradient(160deg,rgba(var(--b1-rgb),.55),rgba(var(--navy-rgb),.35) 45%,rgba(var(--b2-rgb),.35))}
.auth__side::before{content:'';position:absolute;inset:0;background-image:${grano};opacity:.07;mix-blend-mode:overlay;pointer-events:none}
.auth__side>*{position:relative;flex:none}
.side__lbl{font-family:var(--body-black);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.side__quote{font-family:var(--display);font-size:clamp(1.3rem,2vw,1.75rem);line-height:1.2;letter-spacing:-.025em;color:var(--t1);text-wrap:balance;max-width:26ch}
.side__who{display:flex;align-items:center;gap:.8rem}
.side__who b{display:block;font-family:var(--body-bold);font-size:.92rem;color:var(--t1)}
.side__who span{font-family:var(--body-semi);font-size:.8rem;color:var(--t2)}
.side__stats{display:flex;gap:2.2rem;padding-top:1.4rem;border-top:1px solid var(--line-2)}
.side__stats b{display:block;font-family:var(--display);font-size:1.6rem;letter-spacing:-.03em;color:var(--t1)}
.side__stats span{font-family:var(--body);font-size:.84rem;color:var(--t2)}
.steps{display:flex;flex-direction:column;gap:.7rem}
.steps li{display:flex;align-items:center;gap:.7rem;font-family:var(--body-semi);font-size:.86rem;color:var(--t3)}
.steps b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font-family:var(--display);font-size:.7rem;
  background:var(--ink-2);border:1px solid var(--line-2);color:var(--t3)}
.steps .on{color:var(--t1)}.steps .on b{background:var(--g);border-color:transparent;color:var(--on-brand)}
.steps .ok{color:var(--t2)}.steps .ok b{background:rgba(var(--b3-rgb),.18);border-color:rgba(var(--b3-rgb),.5);color:var(--b3)}
.ready{display:flex;flex-wrap:wrap;gap:.45rem}
.ready li{display:flex;align-items:center;gap:.4rem;padding:.32rem .7rem;border-radius:99px;font-family:var(--body-semi);font-size:.74rem;
  color:rgba(255,255,255,.55);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.ready .ok{color:#fff;background:rgba(var(--b3-rgb),.18);border-color:rgba(var(--b3-rgb),.5)}
@media (max-width:939px){.auth{grid-template-columns:1fr}.auth__side{display:none}}
@media (max-width:599px){.auth__top{display:none}}

/* ── La tarjeta de cuenta 3D (.acard de la landing, entera) ── */
.acard{--rx:0;--ry:0;position:relative;width:min(100%,340px);aspect-ratio:1.585;min-height:200px;flex:none;border-radius:13px;overflow:hidden;
  padding:1.3rem 1.4rem;display:flex;flex-direction:column;gap:.4rem;isolation:isolate;color:#fff;
  background:linear-gradient(146deg,var(--navy) 4%,var(--b1) 52%,var(--b2) 96%);
  transform:perspective(1000px) rotateY(calc(var(--rx) * 20deg)) rotateX(calc(var(--ry) * -13deg));
  transition:transform .5s var(--glide),box-shadow .5s var(--glide);
  box-shadow:inset calc(var(--rx) * 3.4px) calc(var(--ry) * -3.4px) 0 rgba(255,255,255,.42),
    inset calc(var(--rx) * -3.6px) calc(var(--ry) * 3.6px) 0 rgba(0,0,0,.5),
    inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.12),
    calc(var(--rx) * -10px) calc(12px + var(--ry) * 8px) 22px -12px rgba(0,0,0,.55),
    calc(var(--rx) * -28px) calc(40px + var(--ry) * 18px) 70px -30px rgba(0,0,0,.7)}
.acard::before{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;mix-blend-mode:screen;
  background:radial-gradient(56% 44% at calc(50% - var(--rx) * 46%) calc(22% - var(--ry) * 38%),rgba(255,255,255,.3),rgba(255,255,255,.05) 42%,transparent 64%),
  linear-gradient(calc(115deg + var(--rx) * 14deg),transparent calc(18% - var(--rx) * 16%),rgba(255,255,255,.11) calc(38% - var(--rx) * 16%),rgba(255,255,255,.02) calc(56% - var(--rx) * 16%),transparent calc(74% - var(--rx) * 16%))}
.acard::after{content:'';position:absolute;inset:0;z-index:4;pointer-events:none;opacity:.11;mix-blend-mode:overlay;background-image:${grano}}
.acard--sway{animation:cardSway 13s ease-in-out infinite}
@keyframes cardSway{0%,100%{--rx:.25;--ry:-.15}50%{--rx:-.25;--ry:.15}}
@property --rx{syntax:'<number>';inherits:false;initial-value:0}
@property --ry{syntax:'<number>';inherits:false;initial-value:0}
.acard__top{display:flex;align-items:center;gap:.5rem;font-family:var(--display);font-size:1rem}
.acard__chip{width:44px;height:32px;border-radius:6px;margin-top:.5rem;
  background:linear-gradient(135deg,#f3d27a,#c9a03c 50%,#f0d58c);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.6)}
.acard__no{margin-top:auto;font-family:var(--body-bold);font-size:.94rem;letter-spacing:.08em;color:rgba(255,255,255,.75)}
.acard__bot{display:flex;justify-content:space-between;font-family:var(--body-bold);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.acard__bot b{color:var(--b3)}
.acard__gloss{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .4s;mix-blend-mode:screen;
  background:radial-gradient(300px circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.16),transparent 62%)}
.acard.lit .acard__gloss{opacity:1}
@media (prefers-reduced-motion:reduce){.acard--sway{animation:none}}

/* ── El hero de la bienvenida (index.html) ── */
.portada{min-height:100dvh;background:transparent}
.hero{position:relative;z-index:2;padding:clamp(100px,14vh,160px) 0 clamp(60px,8vh,100px)}
.wrap{width:min(100% - 2.6rem,1220px);margin-inline:auto}
.hero__grid{display:grid;grid-template-columns:1.06fr .94fr;gap:clamp(2rem,5vw,4.5rem);align-items:center}
.tag{display:inline-flex;align-items:center;gap:.55rem;padding:.42rem 1rem .42rem .72rem;border-radius:99px;border:1px solid var(--line-2);background:var(--ink);
  font-family:var(--body-semi);font-size:.82rem;color:var(--t2);margin-bottom:1.7rem;transition:border-color .3s,color .3s,transform .35s var(--e)}
.tag:hover{border-color:rgba(var(--b3-rgb),.5);color:var(--t1);transform:translateY(-2px)}
.tag__dot{width:7px;height:7px;border-radius:50%;background:var(--b3);box-shadow:0 0 0 4px rgba(var(--b3-rgb),.18)}
.hero__title{font-family:var(--display);font-size:var(--fs-h1);line-height:.98;letter-spacing:-.045em;color:var(--t1);text-wrap:balance;margin:0 0 1.4rem}
.hero__title em{font-style:normal;background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero__lead{font-family:var(--body);font-size:var(--fs-lead);line-height:1.6;color:var(--t2);max-width:52ch;margin:0 0 2rem}
.hero__lead b{color:var(--t1);font-family:var(--body-bold)}
.hero__cta{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;margin-bottom:2.4rem}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;font-family:var(--body-bold);font-size:.96rem;
  padding:.95rem 1.8rem;border-radius:99px;overflow:hidden;isolation:isolate;white-space:nowrap;cursor:pointer;color:var(--t1);
  transition:transform var(--t-base) var(--pop),box-shadow var(--t-base) var(--glide),border-color var(--t-fast),background var(--t-fast)}
.btn--primary{background:var(--g);color:var(--on-brand);box-shadow:var(--sh-b)}
.btn--primary::after{content:'';position:absolute;top:0;left:-150%;width:55%;height:100%;z-index:-1;background:linear-gradient(100deg,transparent,rgba(255,255,255,.6),transparent);transform:skewX(-22deg);animation:sheen 5s var(--e) infinite}
.btn--primary:hover{transform:translateY(-3px);box-shadow:0 30px 70px -18px rgba(var(--b2-rgb),.8)}
.btn--line{border:1px solid var(--line-2);background:var(--ink)}
.btn--line:hover{transform:translateY(-3px);border-color:rgba(var(--b2-rgb),.6);background:rgba(var(--b2-rgb),.12)}
.btn:active{transform:translateY(-1px) scale(.96);transition-duration:.1s}
.hero__stats{display:flex;gap:2rem}
.hero__stats div{padding-left:1rem;border-left:2px solid rgba(var(--b3-rgb),.5)}
.hero__stats b{display:block;font-family:var(--display);font-size:1.8rem;letter-spacing:-.03em;background:var(--g);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero__stats span{font-family:var(--body);font-size:.84rem;color:var(--t2)}
.hero__visual{position:relative;display:grid;place-items:center;min-height:560px}
.phone{position:relative;width:330px;height:660px;border-radius:44px;background:#050d1a;border:1px solid var(--line-2);
  box-shadow:0 0 0 8px #0a1a2f,0 0 0 9px rgba(255,255,255,.08),var(--sh);overflow:hidden;
  transform:perspective(1400px) rotateY(-6deg) rotateX(2deg)}
.phone__notch{position:absolute;top:12px;left:50%;width:110px;height:28px;margin-left:-55px;border-radius:99px;background:#000;z-index:5}
.phone iframe{width:100%;height:100%;border:0;background:var(--bg)}
.hero__card{position:absolute;left:-2%;bottom:6%;z-index:6;width:262px}
.hero__badge{position:absolute;z-index:6;display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-radius:16px;
  background:rgba(10,28,51,.85);backdrop-filter:blur(10px);border:1px solid var(--line-2);box-shadow:var(--sh);font-family:var(--body-semi);font-size:.86rem;color:var(--t1)}
.hero__badge i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--b3-rgb),.18);color:var(--b3);font-style:normal}
.hero__badge small{display:block;font-family:var(--body);font-size:.74rem;color:var(--t2)}
.hero__badge--ok{top:8%;left:-6%}
.hero__badge--bs{right:-4%;top:22%;width:74px;height:74px;justify-content:center;border-radius:50%;background:var(--g);color:var(--on-brand);font-family:var(--display);font-size:1.15rem;box-shadow:var(--sh-b)}
.pasos{width:min(100% - 2.6rem,1220px);margin:0 auto var(--pad);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--gap)}
.paso{padding:1.5rem;border-radius:var(--r);background:var(--bg-card);border:1px solid var(--line);border-top-color:rgba(255,255,255,.1);
  transition:transform var(--t-base) var(--spring),box-shadow var(--t-base) var(--glide),border-color var(--t-fast)}
.paso:hover{transform:translateY(-3px);box-shadow:var(--sh);border-color:var(--line-2)}
.paso i{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--g-soft);color:var(--b3);margin-bottom:1rem;font-style:normal;font-family:var(--display)}
.paso h3{font-family:var(--display-bold);font-size:1.05rem;letter-spacing:-.02em;color:var(--t1);margin:0 0 .4rem}
.paso p{font-family:var(--body);font-size:.9rem;line-height:1.55;color:var(--t2);margin:0}
@media (max-width:1023px){.hero__grid{grid-template-columns:1fr}.hero__visual{display:none}.pasos{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:599px){.pasos{grid-template-columns:1fr}}
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
