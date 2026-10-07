/**
 * Recorrido de humo de la WEB: entra con un cliente real y abre todas las rutas.
 *
 * No prueba que cada pantalla haga lo que debe —eso lo hacen las pruebas por flujo—; prueba lo que
 * `tsc` y `expo export` no ven: que la ruta se monta en el navegador sin excepción, qué llamadas
 * salen al backend y con qué código vuelven, y deja una captura por ruta y ancho.
 *
 * Uso:
 *   node e2e-web/humo.mjs --base http://localhost:8790 --correo ... --pin ... [--salida carpeta] [--anchos 390,768,1280]
 *
 * Requiere `playwright` resoluble desde aquí o desde `PLAYWRIGHT_DIR`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = args.get('base') ?? 'http://localhost:8790';
const CORREO = args.get('correo');
const PIN = args.get('pin');
const SALIDA = args.get('salida') ?? 'e2e-web/salida';
const ANCHOS = (args.get('anchos') ?? '390').split(',').map(Number);
if (!CORREO || !PIN) {
  console.error('Faltan --correo y --pin.');
  process.exit(1);
}

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

/** Las rutas tal como las resuelve expo-router en el navegador (los grupos entre paréntesis no aparecen). */
const RUTAS_PUBLICAS = ['/bienvenida', '/ingresar', '/recuperar', '/permisos', '/enlace-que-no-existe'];
const RUTAS_ONBOARDING = [
  '/registro',
  '/verificar-contacto',
  '/verificacion',
  '/progreso',
  '/perfil',
  '/economia',
  '/domicilio',
  '/identidad',
  '/referencias',
  '/revision',
];
const RUTAS_APP = [
  '/',
  '/pagos',
  '/escanear',
  '/avisos',
  '/perfil',
  '/compra/monto',
  '/compra/ORD-DEMO',
  '/pago/ITEM-DEMO',
  '/pagar/1',
  '/credito/1',
  '/cuota/1/1',
  '/comercio/1',
  '/politica-mora',
  '/editar-perfil',
  '/cambiar-pin',
  '/extracto-bancario',
  '/privacidad',
  '/preferencias-avisos',
  '/ayuda',
  '/soporte',
  '/soporte/canal-demo',
  '/soporte/caso/caso-demo',
];

mkdirSync(SALIDA, { recursive: true });
const browser = await chromium.launch();
const filas = [];
let primeraCarga = true;

async function visitar(page, ruta, ancho, etiqueta) {
  const errores = [];
  const red = [];
  const onConsole = (m) => {
    if (m.type() === 'error') errores.push(m.text().split('\n')[0].slice(0, 160));
  };
  const onPageError = (e) => errores.push(`PageError: ${String(e.message).slice(0, 160)}`);
  const onResponse = (r) => {
    if (r.url().includes('/api/v1')) red.push(`${r.request().method()} ${new URL(r.url()).pathname.replace('/api/v1', '')} ${r.status()}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  await page.setViewportSize({ width: ancho, height: ancho < 600 ? 844 : 900 });
  await page.goto(BASE + ruta, { waitUntil: 'load' }).catch((e) => errores.push(`goto: ${e.message.slice(0, 120)}`));
  /*
    El arranque de marca dura 3,5 s y en web se reproduce una vez por pestaña; la primera ruta
    espera a que termine y las demás sólo a que la pantalla asiente.
  */
  await page.waitForTimeout(primeraCarga ? 4500 : 1500);
  primeraCarga = false;
  const url = new URL(page.url()).pathname;
  const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90);
  const archivo = `${etiqueta}${ruta.replace(/\//g, '_') || '_raiz'}-${ancho}.png`;
  await page.screenshot({ path: join(SALIDA, archivo), fullPage: ancho < 600 }).catch(() => undefined);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);
  filas.push({ etiqueta, ruta, ancho, url, errores, red, texto, archivo });
  console.log(`${errores.length ? '✗' : '✓'} ${etiqueta} ${ruta} @${ancho} → ${url} ${errores[0] ?? ''}`);
}

async function entrar(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'networkidle' });
  const cajas = page.getByRole('textbox');
  await cajas.nth(0).fill(CORREO);
  await cajas.nth(1).fill(PIN);
  await page.getByRole('button', { name: 'Ingresar' }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 20000 });
  return new URL(page.url()).pathname;
}

for (const ancho of ANCHOS) {
  const contexto = await browser.newContext({ locale: 'es-BO' });
  primeraCarga = true;
  const page = await contexto.newPage();
  for (const ruta of RUTAS_PUBLICAS) await visitar(page, ruta, ancho, 'publico');
  const destino = await entrar(page);
  console.log(`— sesión abierta, entra en ${destino}`);
  for (const ruta of RUTAS_APP) await visitar(page, ruta, ancho, 'app');
  for (const ruta of RUTAS_ONBOARDING) await visitar(page, ruta, ancho, 'onboarding');
  await contexto.close();
}
await browser.close();

const md = [
  `# Recorrido de humo de la web — ${new Date().toISOString()}`,
  '',
  `Base: ${BASE} · anchos: ${ANCHOS.join(', ')} px · cliente: ${CORREO}`,
  '',
  '| Área | Ruta pedida | Ancho | Ruta final | Errores | Llamadas al backend | Captura |',
  '|---|---|---|---|---|---|---|',
  ...filas.map(
    (f) =>
      `| ${f.etiqueta} | \`${f.ruta}\` | ${f.ancho} | \`${f.url}\` | ${f.errores.length ? f.errores.map((e) => `\`${e.replace(/\|/g, '/')}\``).join('<br>') : '—'} | ${[...new Set(f.red)].join('<br>') || '—'} | \`${f.archivo}\` |`,
  ),
  '',
  `Rutas con errores: ${filas.filter((f) => f.errores.length).length} de ${filas.length}.`,
];
writeFileSync(join(SALIDA, 'humo.md'), md.join('\n'));
console.log(`\nInforme: ${join(SALIDA, 'humo.md')}`);
