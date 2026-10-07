/**
 * Los flujos de Maestro (e2e/01–04), en el navegador.
 *
 * Mismos pasos y mismas comprobaciones que en el teléfono, contra el backend real:
 *   1. bienvenida → «Crear mi cuenta»;
 *   2. alta: formulario completo → `POST /customer-onboarding/start` 201 → «Verifica tu contacto»;
 *   3. ingreso con un cliente existente → `POST /auth/login` → inicio;
 *   4. soporte: Perfil → Ayuda → Ir a soporte → «Hablar con soporte» → mensaje, ambos con 2xx.
 *
 * Cada paso deja captura; el informe dice qué llamada salió y con qué código. No se da por bueno
 * ningún paso por la pantalla sola: cuenta la respuesta del servidor.
 *
 * Uso:
 *   node e2e-web/flujos.mjs --base http://localhost:8790 --correo ... --pin ... [--salida carpeta]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = args.get('base') ?? 'http://localhost:8790';
const CORREO = args.get('correo');
const PIN = args.get('pin');
const SALIDA = args.get('salida') ?? 'e2e-web/salida-flujos';
if (!CORREO || !PIN) {
  console.error('Faltan --correo y --pin.');
  process.exit(1);
}

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

mkdirSync(SALIDA, { recursive: true });
const informe = [];
const browser = await chromium.launch();
const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 } });
const page = await contexto.newPage();
const llamadas = [];
page.on('response', (r) => {
  if (r.url().includes('/api/v1')) llamadas.push(`${r.request().method()} ${new URL(r.url()).pathname.replace('/api/v1', '')} ${r.status()}`);
});
const errores = [];
page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 160)));

let n = 0;
async function paso(nombre, fn) {
  n += 1;
  const desde = llamadas.length;
  let estado = 'ok';
  let detalle = '';
  try {
    detalle = (await fn()) ?? '';
  } catch (e) {
    estado = 'FALLO';
    detalle = String(e.message ?? e).split('\n')[0].slice(0, 200);
  }
  const archivo = `${String(n).padStart(2, '0')}-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: join(SALIDA, archivo), fullPage: true }).catch(() => undefined);
  const red = [...new Set(llamadas.slice(desde))];
  informe.push({ n, nombre, estado, detalle, red, archivo });
  console.log(`${estado === 'ok' ? '✓' : '✗'} ${nombre} ${detalle} ${red.length ? `[${red.join(' · ')}]` : ''}`);
}

const texto = (t) => page.getByText(t, { exact: false }).first();
const caja = (nombre) => page.getByRole('textbox', { name: nombre }).first();

/* ---- 1 · Bienvenida ---- */
await paso('bienvenida', async () => {
  await page.goto(`${BASE}/bienvenida`, { waitUntil: 'load' });
  await page.waitForTimeout(4500); // secuencia de marca, una vez por pestaña
  await texto('Ya tengo cuenta').waitFor({ timeout: 15000 });
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Siguiente' }).first().click();
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: 'Crear mi cuenta' }).first().click();
  await texto('Necesitamos estos datos para abrir tu expediente.').waitFor({ timeout: 15000 });
});

/* ---- 2 · Alta ---- */
const nuevoCorreo = `web.${Date.now()}@atlas.test`;
const nuevoTelefono = `7${String(Date.now()).slice(-7)}`;
await paso('alta: datos personales', async () => {
  await caja('Nombre').fill('Pablo');
  await caja('Apellido').fill('Arauz');
  // La fecha: en web es un <input type="date">; se rellena por su valor.
  const fecha = page.locator('input[type="date"]').first();
  if (await fecha.count()) await fecha.fill('1995-04-12');
  else {
    await page.getByRole('button', { name: /Fecha de nacimiento/ }).first().click();
    await page.getByRole('button', { name: 'Listo' }).first().click();
  }
  await caja('Teléfono').fill(nuevoTelefono);
  await caja('Correo electrónico').fill(nuevoCorreo);
  return `${nuevoCorreo} · ${nuevoTelefono}`;
});
await paso('alta: PIN y autorizaciones', async () => {
  await caja('Tu PIN').fill('8407');
  // Las autorizaciones las manda el servidor (`GET /consent-documents/active`): se aceptan todas las que haya.
  const casillas = page.getByRole('checkbox');
  const total = await casillas.count();
  for (let i = 0; i < total; i += 1) {
    if (!(await casillas.nth(i).isChecked())) await casillas.nth(i).click();
  }
  const aviso = page.getByText('Falta aceptar las autorizaciones obligatorias.');
  if (await aviso.count()) throw new Error('siguen faltando autorizaciones');
  return `${total} autorizaciones aceptadas`;
});
await paso('alta: crear la cuenta', async () => {
  await page.getByRole('button', { name: 'Crear mi cuenta' }).last().click();
  await texto('Verifica tu contacto').waitFor({ timeout: 30000 });
  const inicio = llamadas.find((l) => l.startsWith('POST /customer-onboarding/start'));
  if (!inicio || !/ 20\d$/.test(inicio)) throw new Error(`el alta no llegó al servidor: ${inicio ?? 'sin llamada'}`);
  return inicio;
});

/* ---- 3 · Ingreso ---- */
await paso('ingreso', async () => {
  await contexto.clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento */
    }
  });
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await caja('Correo o teléfono').fill(CORREO);
  await caja('PIN').fill(PIN);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 20000 });
  await texto('Tu línea Atlas').waitFor({ timeout: 40000 });
  const login = llamadas.find((l) => l.startsWith('POST /auth/login'));
  if (!login || !/ 20\d$/.test(login)) throw new Error(`login sin 2xx: ${login ?? 'sin llamada'}`);
  return login;
});

/* ---- 4 · Soporte ---- */
await paso('soporte: perfil → ayuda → soporte', async () => {
  const saltar = page.getByRole('button', { name: 'Saltar' });
  if (await saltar.count()) await saltar.first().click();
  const pestana = page.getByRole('tab', { name: 'Perfil' }).or(page.getByRole('link', { name: 'Perfil' })).first();
  if (await pestana.count()) await pestana.click();
  else await page.goto(`${BASE}/perfil`, { waitUntil: 'load' });
  await texto('Ayuda').waitFor({ timeout: 20000 });
  // El tour de inicio también se ofrece aquí; se salta como haría la persona.
  await page.waitForTimeout(800);
  const saltarPerfil = page.getByRole('button', { name: 'Saltar' });
  if (await saltarPerfil.count()) await saltarPerfil.first().click();
  await texto('Preguntas frecuentes').click();
  await texto('Ir a soporte').waitFor({ timeout: 20000 });
  await texto('Ir a soporte').click();
  await page.waitForURL(/\/soporte/, { timeout: 20000 });
});
await paso('soporte: hablar con soporte', async () => {
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Hablar con soporte' }).first().click();
  await page.waitForTimeout(800);
  // «¿Sobre qué es?»: como en el teléfono, se puede saltar la clasificación y contarlo directamente.
  await texto('Ninguno de estos / prefiero contarlo').click();
  await page.waitForURL(/\/soporte\/.+/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const apertura = llamadas.filter((l) => l.startsWith('POST /support') || l.startsWith('POST /mobile/support')).pop();
  if (!apertura) throw new Error('no salió ningún POST de soporte');
  if (!/ 20\d$/.test(apertura)) throw new Error(`soporte respondió: ${apertura}`);
  return apertura;
});
await paso('soporte: enviar un mensaje', async () => {
  const cajaMensaje = page.getByRole('textbox').last();
  await cajaMensaje.fill('Prueba desde la web');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const envio = llamadas.filter((l) => /^POST \/(mobile\/)?support\/channels\/[^/]+\/messages/.test(l)).pop();
  if (!envio) {
    const enviar = page.getByRole('button', { name: /Enviar/ }).last();
    if (await enviar.count()) await enviar.click();
    await page.waitForTimeout(2500);
  }
  const final = llamadas.filter((l) => /^POST \/(mobile\/)?support\/channels\/[^/]+\/messages/.test(l)).pop();
  if (!final) throw new Error('el mensaje no salió al servidor');
  if (!/ 20\d$/.test(final)) throw new Error(`el mensaje respondió: ${final}`);
  return final;
});

await browser.close();

const md = [
  `# Flujos de la web — ${new Date().toISOString()}`,
  '',
  `Base: ${BASE} · cliente de ingreso: ${CORREO} · alta nueva: ${nuevoCorreo}`,
  '',
  '| # | Paso | Estado | Detalle | Llamadas al backend | Captura |',
  '|---|---|---|---|---|---|',
  ...informe.map((f) => `| ${f.n} | ${f.nombre} | ${f.estado} | ${f.detalle.replace(/\|/g, '/')} | ${f.red.join('<br>') || '—'} | \`${f.archivo}\` |`),
  '',
  errores.length ? `Errores de página: ${errores.map((e) => `\`${e}\``).join(', ')}` : 'Sin errores de página.',
];
writeFileSync(join(SALIDA, 'flujos.md'), md.join('\n'));
console.log(`\nInforme: ${join(SALIDA, 'flujos.md')}`);
process.exit(informe.some((f) => f.estado !== 'ok') ? 1 : 0);
