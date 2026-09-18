/**
 * Auditoría responsiva de la WEB: abre cada ruta en cada ancho de la matriz y MIDE lo que una
 * captura no dice sola.
 *
 * Por cada ruta y ancho:
 *   - desborde horizontal del documento (`scrollWidth > clientWidth`), que `body{overflow-x:hidden}`
 *     esconde pero no arregla;
 *   - elementos que asoman por la derecha del viewport sin un ancestro que los recorte;
 *   - controles interactivos visibles por debajo de 24×24 px (WCAG 2.2, 2.5.8);
 *   - texto de contenido por debajo de 11 px;
 *   - errores de página.
 * Con `--estados`, además abre lo que se abre —la hoja de ayuda (ⓘ), el selector, la cuadrícula y
 * el calendario de pagos— y comprueba que quepa en la ventana, que Escape lo cierre y que el foco
 * vuelva al botón que lo abrió. Con `--apaisado` la ventana es apaisada (alto = 0,46 × ancho).
 *
 * Uso:
 *   PLAYWRIGHT_DIR=<ruta a node_modules/playwright> node e2e-web/responsive.mjs \
 *     --base http://localhost:8790 --correo … --pin … \
 *     [--anchos 320,360,390,430,600,640,768,940,1024,1280,1440,1920,2560] [--rutas /,/pagos] \
 *     [--estados] [--apaisado] [--sin-capturas] [--salida carpeta]
 *
 * Termina con código 1 si alguna medida falla, para que sirva de compuerta.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const clave = process.argv[i];
  if (!clave.startsWith('--')) continue;
  const siguiente = process.argv[i + 1];
  const valor = siguiente && !siguiente.startsWith('--') ? process.argv[++i] : '1';
  args.set(clave.slice(2), valor);
}
const BASE = args.get('base') ?? 'http://localhost:8790';
const CORREO = args.get('correo');
const PIN = args.get('pin');
const SALIDA = args.get('salida') ?? 'e2e-web/salida-responsive';
const ANCHOS = (args.get('anchos') ?? '320,360,390,430,600,640,768,940,1024,1280,1440,1920,2560').split(',').map(Number);
const SOLO = args.get('rutas')?.split(',');
const CAPTURAS = !args.has('sin-capturas');
const ESTADOS = args.has('estados');
const APAISADO = args.has('apaisado');
if (!CORREO || !PIN) {
  console.error('Faltan --correo y --pin.');
  process.exit(1);
}

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

/** Las mismas rutas que `humo.mjs`, tal como las resuelve expo-router en el navegador. */
const RUTAS_PUBLICAS = ['/bienvenida', '/ingresar', '/recuperar', '/enlace-que-no-existe'];
const RUTAS_ONBOARDING = ['/registro', '/verificar-contacto', '/verificacion', '/progreso', '/perfil', '/economia', '/domicilio', '/identidad', '/referencias', '/revision'];
const RUTAS_APP = [
  '/', '/pagos', '/escanear', '/avisos', '/perfil',
  '/compra/monto', '/compra/ORD-DEMO', '/pago/ITEM-DEMO', '/pagar/1', '/credito/1', '/cuota/1/1', '/comercio/1',
  '/politica-mora', '/editar-perfil', '/cambiar-pin', '/extracto-bancario', '/privacidad', '/preferencias-avisos', '/ayuda',
  '/soporte', '/soporte/canal-demo', '/soporte/caso/caso-demo',
];

/** Mínimo de área táctil que se exige en la web (WCAG 2.2 AA). En el teléfono la app declara 48. */
const MINIMO_TOQUE = 24;

const MEDIR = `(() => {
  const W = document.documentElement.clientWidth;
  const out = { scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), clientW: W, fuera: [], pequenos: [], textoChico: [] };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const nombre = (el) => (el.tagName.toLowerCase() + (el.dataset.atlas ? '[' + el.dataset.atlas + ']' : '') + ' «' + (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 40).replace(/\\s+/g, ' ') + '»');
  const recortado = (el) => { let a = el.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return true; a = a.parentElement; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.aurora')) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && r.left < W && !recortado(el) && out.fuera.length < 10) out.fuera.push(nombre(el) + ' right=' + Math.round(r.right));
    // El interruptor nativo (40×20) es la excepción documentada en RESPONSIVE_DESIGN_SYSTEM.md §5: su fila mide 48.
    if (el.matches('a,button,[role=button],[role=checkbox],input,select,textarea') && !el.matches('[role=switch]') && !el.disabled && el.getAttribute('aria-disabled') !== 'true') {
      // El área que responde es la del elemento MÁS su data-toque (el hitSlop de la web, ver ui/hit-slop.ts).
      const t = (el.dataset.toque || '0').split('-').map(Number);
      const [st, sr, sb, sl] = t.length === 1 ? [t[0], t[0], t[0], t[0]] : t;
      const ancho = r.width + sl + sr, alto = r.height + st + sb;
      if ((ancho < ${MINIMO_TOQUE} || alto < ${MINIMO_TOQUE}) && out.pequenos.length < 10) out.pequenos.push(nombre(el) + ' ' + Math.round(ancho) + 'x' + Math.round(alto));
    }
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11 && out.textoChico.length < 5) out.textoChico.push(nombre(el));
  }
  return out;
})()`;

const MEDIR_ABIERTO = `(() => {
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  const dialogos = [...document.querySelectorAll('[role=dialog],[aria-modal=true]')].filter((e) => e.getBoundingClientRect().height > 0).length;
  const activo = document.activeElement ? document.activeElement.tagName + ' ' + (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 30) : '';
  const fuera = [];
  // Lo que vive dentro de una lista con desplazamiento propio no «se sale»: se recorta a esa lista.
  const recorte = (el) => { let r = el.getBoundingClientRect(); let a = el.parentElement; while (a && a !== document.body) { const cs = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) { const b = a.getBoundingClientRect(); r = { top: Math.max(r.top, b.top), bottom: Math.min(r.bottom, b.bottom), left: Math.max(r.left, b.left), right: Math.min(r.right, b.right) }; } a = a.parentElement; } return r; };
  for (const el of document.querySelectorAll('[aria-modal=true] *')) {
    const propio = el.getBoundingClientRect(); if (propio.width === 0 || propio.height === 0 || !el.textContent.trim()) continue;
    const r = recorte(el); if (r.bottom <= r.top || r.right <= r.left) continue;
    if (r.top < -1 || r.bottom > H + 1 || r.left < -1 || r.right > W + 1) { if (fuera.length < 5) fuera.push(el.tagName + ' «' + el.textContent.trim().slice(0, 30) + '» ' + Math.round(r.top) + '/' + Math.round(r.bottom)); }
  }
  return { dialogos, activo, fuera, scrollW: document.documentElement.scrollWidth, clientW: W };
})()`;

mkdirSync(SALIDA, { recursive: true });
const browser = await chromium.launch();
const contexto = await browser.newContext({ locale: 'es-BO' });
// La secuencia de marca se ve una vez por pestaña; aquí se da por vista para medir la app, no el intro.
await contexto.addInitScript(() => {
  try {
    sessionStorage.setItem('atlas.arranque.visto', '1');
  } catch {
    /* sin almacenamiento de sesión: se verá el intro y se espera un poco más */
  }
});
const page = await contexto.newPage();
const filas = [];
const estados = [];
let fallos = 0;

const altoPara = (ancho) => (APAISADO ? Math.round(ancho * 0.46) : ancho < 600 ? 780 : ancho < 1024 ? 1024 : 900);

async function medir(ruta, ancho, area) {
  const errores = [];
  const onError = (e) => errores.push(String(e.message).slice(0, 140));
  page.on('pageerror', onError);
  await page.setViewportSize({ width: ancho, height: altoPara(ancho) });
  await page.goto(BASE + ruta, { waitUntil: 'load' }).catch((e) => errores.push('goto ' + e.message.slice(0, 80)));
  await page.waitForTimeout(1400);
  const url = new URL(page.url()).pathname;
  const m = await page.evaluate(MEDIR).catch((e) => ({ scrollW: 0, clientW: 0, fuera: [String(e)], pequenos: [], textoChico: [] }));
  const archivo = `${area}${ruta.replace(/\//g, '_') || '_raiz'}-${ancho}${APAISADO ? '-apaisado' : ''}.png`;
  if (CAPTURAS) await page.screenshot({ path: join(SALIDA, archivo), fullPage: ancho < 1024 }).catch(() => undefined);
  page.off('pageerror', onError);
  const desborde = m.scrollW > m.clientW + 1;
  const mal = errores.length > 0 || desborde || m.fuera.length > 0 || m.pequenos.length > 0;
  if (mal) fallos += 1;
  filas.push({ area, ruta, ancho, url, errores, desborde, ...m, archivo });
  console.log(
    `${mal ? '✗' : '✓'} ${ruta} @${ancho} → ${url}${desborde ? ` DESBORDE ${m.scrollW}/${m.clientW}` : ''}${m.fuera.length ? ` fuera:${m.fuera.length}` : ''}${m.pequenos.length ? ` pequeños:${m.pequenos.length}` : ''}${errores[0] ? ' ' + errores[0] : ''}`,
  );
}

async function registrarEstado(nombre, ancho, abridor) {
  const m = await page.evaluate(MEDIR_ABIERTO);
  const archivo = `estado-${nombre}-${ancho}${APAISADO ? '-apaisado' : ''}.png`;
  if (CAPTURAS) await page.screenshot({ path: join(SALIDA, archivo) }).catch(() => undefined);
  const mal = m.fuera.length > 0 || m.scrollW > m.clientW + 1;
  if (mal) fallos += 1;
  estados.push({ nombre, ancho, abridor, ...m, archivo });
  console.log(`${mal ? '✗' : '✓'} estado ${nombre} @${ancho} diálogos=${m.dialogos} ${m.fuera.join(' | ')}`);
}

async function ir(ruta) {
  await page.goto(BASE + ruta, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
}

async function estadosAbiertos(ancho) {
  await page.setViewportSize({ width: ancho, height: altoPara(ancho) });

  // La hoja de ayuda: abre con ⓘ, cabe, se cierra con Escape y el foco vuelve al ⓘ.
  await ir('/registro');
  const ayuda = page.getByRole('button', { name: /^Ayuda:/ }).first();
  if (await ayuda.count()) {
    await ayuda.click();
    await page.waitForTimeout(700);
    await registrarEstado('ayuda', ancho, 'Ayuda');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const tras = await page.evaluate(MEDIR_ABIERTO);
    const vuelve = tras.dialogos === 0 && /^BUTTON Ayuda:/.test(tras.activo);
    if (!vuelve) fallos += 1;
    console.log(`${vuelve ? '✓' : '✗'} estado ayuda-tras-escape @${ancho} diálogos=${tras.dialogos} foco=${tras.activo}`);
    estados.push({ nombre: 'ayuda-tras-escape', ancho, abridor: 'Escape', ...tras, archivo: '' });
  }

  // El selector de opciones (economía): la lista cede antes que salirse de la ventana.
  await ir('/economia');
  const selector = page.getByRole('button', { name: /Tocar para (elegir|cambiar)/ }).first();
  if (await selector.count()) {
    await selector.click();
    await page.waitForTimeout(700);
    await registrarEstado('selector', ancho, 'SelectField');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Pagos en sus tres vistas.
  await ir('/pagos');
  await registrarEstado('pagos-lista', ancho, '—');
  const vista = page.getByRole('button', { name: /Ver en/ }).first();
  if (await vista.count()) {
    await vista.click();
    await page.waitForTimeout(500);
    await registrarEstado('pagos-cuadricula', ancho, 'Ver en cuadrícula');
    await vista.click();
    await page.waitForTimeout(500);
    await registrarEstado('pagos-calendario', ancho, 'Ver en calendario');
  }
}

async function entrar() {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  const cajas = page.getByRole('textbox');
  await cajas.nth(0).fill(CORREO);
  await cajas.nth(1).fill(PIN);
  await page.getByRole('button', { name: 'Ingresar' }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
}

const elegida = (ruta) => !SOLO || SOLO.includes(ruta);
let sesion = false;
for (const ancho of ANCHOS) {
  for (const ruta of RUTAS_PUBLICAS) if (elegida(ruta)) await medir(ruta, ancho, 'publico');
  if (!sesion) {
    await entrar();
    sesion = true;
    console.log('— sesión abierta');
  }
  for (const ruta of RUTAS_APP) if (elegida(ruta)) await medir(ruta, ancho, 'app');
  for (const ruta of RUTAS_ONBOARDING) if (elegida(ruta)) await medir(ruta, ancho, 'onboarding');
  if (ESTADOS) await estadosAbiertos(ancho);
}
await browser.close();

const sufijo = APAISADO ? '-apaisado' : '';
const md = [
  `# Auditoría responsiva de la web — ${new Date().toISOString()}`,
  '',
  `Base: ${BASE} · anchos: ${ANCHOS.join(', ')} px${APAISADO ? ' · apaisado' : ''} · cliente: ${CORREO}`,
  '',
  '| Área | Ruta | Ancho | Ruta final | Desborde | Fuera del viewport | Controles < 24 px | Texto < 11 px | Errores | Captura |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...filas.map(
    (f) =>
      `| ${f.area} | \`${f.ruta}\` | ${f.ancho} | \`${f.url}\` | ${f.desborde ? `**${f.scrollW}/${f.clientW}**` : '—'} | ${f.fuera.join('<br>') || '—'} | ${f.pequenos.join('<br>') || '—'} | ${f.textoChico.join('<br>') || '—'} | ${f.errores.join('<br>') || '—'} | \`${f.archivo}\` |`,
  ),
  '',
  `Desbordes: ${filas.filter((f) => f.desborde).length} · con elementos fuera: ${filas.filter((f) => f.fuera.length).length} · con controles pequeños: ${filas.filter((f) => f.pequenos.length).length} · con errores: ${filas.filter((f) => f.errores.length).length} · de ${filas.length} aperturas.`,
];
if (ESTADOS) {
  md.push(
    '',
    '## Estados abiertos',
    '',
    '| Estado | Ancho | Diálogos | Foco | Fuera de la ventana | Captura |',
    '|---|---|---|---|---|---|',
    ...estados.map((e) => `| ${e.nombre} | ${e.ancho} | ${e.dialogos} | ${e.activo} | ${e.fuera.join('<br>') || '—'} | \`${e.archivo}\` |`),
  );
}
writeFileSync(join(SALIDA, `responsive${sufijo}.md`), md.join('\n'));
writeFileSync(join(SALIDA, `responsive${sufijo}.json`), JSON.stringify({ filas, estados }, null, 1));
console.log(`\nInforme: ${join(SALIDA, `responsive${sufijo}.md`)} · fallos: ${fallos}`);
process.exit(fallos ? 1 : 0);
