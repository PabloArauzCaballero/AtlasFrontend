/**
 * La sesión de la WEB en cookie (APP-02), de punta a punta en un navegador real.
 *
 * Qué prueba: que tras entrar no queda NINGÚN token ni dato de contacto en `localStorage`/`sessionStorage`; que la
 * cookie del token de refresco es `HttpOnly` (JavaScript no la ve) y `SameSite=Strict`; que al recargar se sigue dentro
 * porque la app refresca con la cookie (cuerpo vacío); que cerrar sesión la borra y al recargar se queda fuera; y que
 * quien traía el par viejo en `localStorage` pasa a cookie sin volver a escribir el PIN y sin dejar el par atrás.
 *
 * Qué NO prueba: el backend real (lo cubre `customer-session-cookie.spec.ts` en AtlasBackend). La API simulada
 * (`api-simulada.mjs`) aplica el mismo contrato.
 *
 * Uso:
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-cookie
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/sesion-web-cookie.mjs --web /tmp/web-cookie [--puerto 8766]
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { crearApiSimulada } from './api-simulada.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const WEB = args.get('web');
const PUERTO = Number(args.get('puerto') ?? 8766);
const PUERTO_API = Number(args.get('api') ?? 8799);
const BASE = `http://127.0.0.1:${PUERTO}`;
const PIN = '4821';
/** El par «viejo» que la web dejaba en `localStorage` antes de APP-02 (valores de prueba, no secretos). */
const REFRESCO_VIEJO = 'refresco-viejo-de-prueba';
if (!WEB) {
  console.error('Falta --web <carpeta del expo export>.');
  process.exit(1);
}

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

/** La web exportada como SPA: lo que no es un archivo cae en `index.html`, como hace el nginx de la imagen. */
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const web = createServer((req, res) => {
  const ruta = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let archivo = join(WEB, ruta);
  if (!existsSync(archivo) || ruta.endsWith('/')) archivo = join(WEB, 'index.html');
  res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
  res.end(readFileSync(archivo));
});
await new Promise((r) => web.listen(PUERTO, '127.0.0.1', r));
const api = crearApiSimulada({ puerto: PUERTO_API, pinInicial: PIN });
await api.escuchar();

const browser = await chromium.launch();
const resultados = [];
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};
async function paso(nombre, fn) {
  try {
    const detalle = (await fn()) ?? '';
    resultados.push(true);
    console.log(`✓ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  } catch (e) {
    resultados.push(false);
    console.log(`✗ ${nombre} — ${String(e.message ?? e).split('\n')[0].slice(0, 240)}`);
  }
}

/** Todo lo que la página puede leer de su almacenamiento, en una sola cadena. */
const almacenamiento = (page) =>
  page.evaluate(() => {
    const volcar = (s) => Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i))}`);
    return [...volcar(localStorage), ...volcar(sessionStorage), `document.cookie=${document.cookie}`].join('\n');
  });
const dentro = (page) => {
  const ruta = new URL(page.url()).pathname;
  return !ruta.startsWith('/ingresar') && !ruta.startsWith('/bienvenida');
};

async function entrar(page) {
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.getByRole('textbox', { name: 'Correo o teléfono' }).first().fill('pablo@example.com');
  await page.getByRole('textbox', { name: 'PIN' }).first().fill(PIN);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
}

// ── 1. Sesión nueva ────────────────────────────────────────────────────────────────────────────────────────────────
{
  // Ancho de escritorio: ahí la web pinta su barra superior con «Salir».
  const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 1280, height: 900 } });
  const page = await contexto.newPage();

  await paso('entrar: el login pide el modo cookie y el servidor pone la cookie', async () => {
    await entrar(page);
    const login = api.estado.sesionWeb.find((l) => l.ruta === '/auth/login');
    afirmar(login?.modo === 'cookie', `el login no pidió el modo cookie (${login?.modo})`);
    const cookies = await contexto.cookies(`http://127.0.0.1:${PUERTO_API}/api/v1/auth/refresh`);
    const cookie = cookies.find((c) => c.name === 'atlas_customer_refresh');
    afirmar(cookie, 'el navegador no guardó la cookie');
    afirmar(cookie.httpOnly && cookie.sameSite === 'Strict', `atributos: httpOnly=${cookie.httpOnly} sameSite=${cookie.sameSite}`);
    return `en ${new URL(page.url()).pathname}`;
  });

  await paso('ningún token ni dato de contacto en localStorage, sessionStorage ni document.cookie', async () => {
    const todo = await almacenamiento(page);
    afirmar(!/refresco|eyJ|pablo@example\.com|accessToken|refreshToken/.test(todo), `quedó algo sensible:\n${todo}`);
    afirmar(!todo.includes('atlas_customer_refresh'), 'JavaScript ve la cookie: no es HttpOnly');
    return todo.split('\n').filter((l) => l.startsWith('atlas.session')).join(', ');
  });

  await paso('al recargar sigue dentro: refresca con la cookie y el cuerpo vacío', async () => {
    const antes = api.estado.sesionWeb.length;
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(4000);
    const refresco = api.estado.sesionWeb.slice(antes).find((l) => l.ruta === '/auth/refresh');
    afirmar(refresco, 'no hubo refresco al recargar');
    afirmar(refresco.modo === 'cookie' && refresco.cookie === 'refresco', `refresco sin cookie: ${JSON.stringify(refresco)}`);
    afirmar(!refresco.cuerpo.refreshToken, 'el refresco mandó un token en el cuerpo');
    afirmar(dentro(page), `tras recargar quedó en ${new URL(page.url()).pathname}`);
    return `en ${new URL(page.url()).pathname}`;
  });

  await paso('cerrar sesión borra la cookie en el servidor y al recargar se queda fuera', async () => {
    // El «Salir» de la barra superior de la web (`Cascara.tsx`); el de Perfil usa `Alert`, que en la web no pinta.
    // Con `evaluate`: al entrar puede haber un recorrido guiado encima que intercepta el puntero.
    const salir = page.locator('button.nav__salir').first();
    await salir.waitFor({ state: 'attached', timeout: 15000 });
    await salir.evaluate((boton) => boton.click());
    // «Salir» no navega: la sesión pasa a anónima en el sitio. Se espera a que el cierre llegue al servidor.
    for (let ms = 0; ms < 15000 && !api.estado.sesionWeb.some((l) => l.ruta === '/auth/logout'); ms += 250) await page.waitForTimeout(250);
    await page.waitForTimeout(1000);
    const logout = api.estado.sesionWeb.find((l) => l.ruta === '/auth/logout');
    afirmar(logout?.modo === 'cookie' && logout.cookie === 'refresco', `logout: ${JSON.stringify(logout)}`);
    const cookies = await contexto.cookies(`http://127.0.0.1:${PUERTO_API}/api/v1/auth/refresh`);
    afirmar(!cookies.some((c) => c.name === 'atlas_customer_refresh'), 'la cookie sigue en el navegador');
    const antes = api.estado.sesionWeb.length;
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(3000);
    afirmar(!dentro(page), `tras salir y recargar quedó en ${new URL(page.url()).pathname}`);
    afirmar(api.estado.sesionWeb.length === antes, 'tras salir, la recarga intentó refrescar');
    const todo = await almacenamiento(page);
    afirmar(!/atlas\.session/.test(todo), `quedó rastro de sesión:\n${todo}`);
  });
  await contexto.close();
}

// ── 2. Migración desde el par viejo en localStorage ────────────────────────────────────────────────────────────────
{
  api.estado.sesionViva = true; // el servidor aún reconoce el token viejo
  api.estado.sesionWeb.length = 0;
  const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 } });
  await contexto.addInitScript((viejo) => {
    if (sessionStorage.getItem('sembrado')) return;
    sessionStorage.setItem('sembrado', '1');
    localStorage.setItem('atlas.session.access', 'eyJ.acceso.viejo');
    localStorage.setItem('atlas.session.refresh', viejo);
    localStorage.setItem('atlas.session.profile', JSON.stringify({ customerId: '53', displayName: null, identifier: 'pablo@example.com' }));
  }, REFRESCO_VIEJO);
  const page = await contexto.newPage();

  await paso('migración: entra sin PIN, canjea el par viejo por la cookie y lo borra', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(4000);
    const refresco = api.estado.sesionWeb.find((l) => l.ruta === '/auth/refresh');
    afirmar(refresco?.modo === 'cookie' && refresco.cuerpo.refreshToken === REFRESCO_VIEJO, `refresco: ${JSON.stringify(refresco)}`);
    afirmar(dentro(page), `quedó en ${new URL(page.url()).pathname}`);
    const todo = await almacenamiento(page);
    afirmar(!/refresco-viejo|eyJ\.acceso\.viejo|pablo@example\.com/.test(todo), `quedó el par viejo:\n${todo}`);
    const cookies = await contexto.cookies(`http://127.0.0.1:${PUERTO_API}/api/v1/auth/refresh`);
    afirmar(cookies.some((c) => c.name === 'atlas_customer_refresh'), 'no quedó la cookie');
  });
  await contexto.close();
}

await browser.close();
await api.cerrar();
web.close();
const fallos = resultados.filter((r) => !r).length;
console.log(fallos ? `\n${fallos} paso(s) fallaron` : '\nTodo en orden');
process.exit(fallos ? 1 : 0);
