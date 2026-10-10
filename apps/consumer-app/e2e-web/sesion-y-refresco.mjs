/**
 * Pagar, ver la portada al día, salir y que la sesión caduque: de punta a punta en un navegador real, SIN recargar.
 *
 * Qué prueba (y por qué existe), en palabras de Pablo (2026-10-09): «al hacer un pago tenés que salirte de la app
 * (cerrarla) para que recarguen las compras, puntos y otros elementos. Lo mismo para hacer logout.»
 *
 *  1. Pagar una cuota y volver a Inicio: la línea disponible y el próximo pago se actualizan SOLOS cuando el servidor
 *     confirma —que es unos segundos DESPUÉS del aviso, como en TEST—, sin recargar la página. Antes la portada se
 *     quedaba con lo de antes hasta cerrar la app.
 *  2. Cerrar sesión lleva a «Ingresar» sin cerrar nada. Antes la guarda del área redirigía a «/», que desde dentro
 *     del área es la propia portada: un bucle de redirecciones (error 185 de React) que colgaba la app.
 *  3. Con la sesión vencida en el servidor (401 `SESSION_EXPIRED`, el tope de 8 h) la app vuelve a «Ingresar» y lo
 *     dice: «Por seguridad, tu sesión dura 8 horas…».
 *
 * Una marca en `window` comprueba que en ningún paso se recargó la página: recargar es «cerrar la app».
 *
 * Uso:
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-sesion
 *   (servir /tmp/web-sesion como SPA en 8766)
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/sesion-y-refresco.mjs --base http://127.0.0.1:8766 [--salida carpeta]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { crearApiSimulada } from './api-simulada.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = args.get('base') ?? 'http://127.0.0.1:8766';
const SALIDA = args.get('salida') ?? 'e2e-web/salida-sesion-y-refresco';
const PUERTO_API = Number(args.get('api') ?? 8799);
const PIN = '4821';
const API = `http://127.0.0.1:${PUERTO_API}/api/v1`;

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

mkdirSync(SALIDA, { recursive: true });
const api = crearApiSimulada({ puerto: PUERTO_API, pinInicial: PIN, pagos: true });
await api.escuchar();

const browser = await chromium.launch();
const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 } });
// Sin el recorrido guiado de la portada: tapa los botones y no es lo que se prueba.
await contexto.addInitScript(() => {
  try {
    localStorage.setItem('atlas.tour.seen.inicio.v1', '1');
  } catch {
    /* sin almacenamiento: el recorrido se salta igual con «Saltar» */
  }
});
const page = await contexto.newPage();
const errores = [];
const ruta = [];
let cargas = 0;
page.on('load', () => (cargas += 1));
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) ruta.push(new URL(f.url()).pathname);
});
page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error' && /Maximum update depth|#185/.test(m.text())) errores.push(m.text().slice(0, 200));
});

const resultados = [];
let n = 0;
async function paso(nombre, fn) {
  n += 1;
  let estado = 'ok';
  let detalle = '';
  try {
    detalle = (await fn()) ?? '';
  } catch (e) {
    estado = 'FALLO';
    detalle = String(e.message ?? e).split('\n')[0].slice(0, 240);
  }
  const archivo = `${String(n).padStart(2, '0')}-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SALIDA, archivo), timeout: 5_000 }).catch(() => undefined);
  resultados.push({ nombre, estado, detalle });
  console.log(`${estado === 'ok' ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};
const texto = (t) => page.getByText(t, { exact: false }).first();
const boton = (nombre) => page.getByRole('button', { name: nombre }).first();
const caja = (nombre) => page.getByRole('textbox', { name: nombre }).first();
const pagos = async () => (await fetch(`${API}/__pagos`)).json();
/** La marca de «no se recargó»: se pone una vez y tiene que seguir ahí. */
const sinRecargar = async () => afirmar((await page.evaluate(() => window.__atlasSinRecargar === 1)) === true, 'la página se recargó');

async function entrar() {
  await caja('Correo o teléfono').fill('pablo@example.com');
  await caja('PIN').fill(PIN);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30_000 });
}

await paso('entrar y ver la portada con la línea y el próximo pago', async () => {
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
  await page.waitForTimeout(1_500);
  await entrar();
  await texto('Tu próximo pago').waitFor({ timeout: 30_000 });
  await texto('1.000,00').waitFor({ timeout: 10_000 });
  // La secuencia de marca se ve una vez por pestaña y tapa la pantalla unos segundos.
  await page.waitForTimeout(5_000);
  await page.evaluate(() => {
    window.__atlasSinRecargar = 1;
  });
  return 'disponible Bs 1.000,00, cuota de Bs 250 pendiente';
});

await paso('pagar la cuota: QR del comercio, comprobante y aviso', async () => {
  await boton('Ver cómo pagar').click();
  await boton('Pagar esta cuota').waitFor({ timeout: 15_000 });
  await boton('Pagar esta cuota').click();
  await boton(/Adjuntar comprobante/).waitFor({ timeout: 15_000 });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const [selector] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10_000 }), boton(/Adjuntar comprobante/).click()]);
  await selector.setFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: png });
  await boton(/Comprobante adjunto/).waitFor({ timeout: 10_000 });
  await boton(/Ya realicé el pago/).click();
  await boton('Entendido').waitFor({ timeout: 15_000 });
  const mundo = await pagos();
  afirmar(mundo.avisos === 1 && mundo.subidas === 1, `avisos=${mundo.avisos} subidas=${mundo.subidas}`);
  await sinRecargar();
  return 'aviso enviado; el servidor confirma 2 s después';
});

await paso('volver a Inicio: la línea y el próximo pago se ponen al día SOLOS, sin recargar', async () => {
  await boton('Entendido').click();
  await page.waitForTimeout(800);
  await page.goBack();
  await texto('El crédito completo').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => undefined);
  await texto('1.210,00').waitFor({ timeout: 40_000 });
  await texto('Tu próximo pago').waitFor({ state: 'detached', timeout: 10_000 });
  afirmar((await pagos()).confirmado === true, 'el servidor no llegó a confirmar');
  await sinRecargar();
  return 'disponible Bs 1.210,00 y sin cuota pendiente';
});

await paso('cerrar sesión lleva a «Ingresar» sin cerrar la app', async () => {
  await page.getByRole('tab', { name: /Perfil/ }).first().click();
  await page.getByTestId('perfil-cerrar-sesion').waitFor({ timeout: 15_000 });
  await page.getByTestId('perfil-cerrar-sesion').click();
  await page.getByTestId('perfil-confirmar-salida').click();
  await page.waitForURL(/\/ingresar/, { timeout: 10_000 });
  await caja('PIN').waitFor({ timeout: 10_000 });
  afirmar(!errores.some((e) => /185|Maximum update depth/.test(e)), `bucle de redirecciones: ${errores.join(' | ')}`);
  await sinRecargar();
});

await paso('con la sesión vencida en el servidor (401 SESSION_EXPIRED) vuelve a «Ingresar» y dice por qué', async () => {
  await entrar();
  await texto('1.210,00').waitFor({ timeout: 30_000 });
  await fetch(`${API}/__vencer-sesion`, { method: 'POST' });
  // Cualquier llamada lo descubre: aquí, abrir Pagos.
  await page.getByRole('tab', { name: /Pagos/ }).first().click();
  await page.waitForURL(/\/ingresar/, { timeout: 20_000 });
  await texto('Por seguridad, tu sesión dura 8 horas. Vuelve a entrar con tu PIN.').waitFor({ timeout: 10_000 });
  await sinRecargar();
});

await browser.close();
await api.cerrar();

const fallos = resultados.filter((r) => r.estado !== 'ok');
if (errores.length) console.log(`errores de página: ${errores.length}\n  ${errores.slice(0, 5).join('\n  ')}`);
console.log(`rutas visitadas: ${ruta.join(' → ')}`);
console.log(`cargas completas de la página: ${cargas} (1 = nunca se recargó)`);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} pasos ok · capturas en ${SALIDA}`);
process.exit(fallos.length ? 1 : 0);
