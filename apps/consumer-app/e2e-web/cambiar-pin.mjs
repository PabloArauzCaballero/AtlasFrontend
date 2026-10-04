/**
 * Cambiar el PIN, de punta a punta en un navegador real.
 *
 * Qué prueba (y por qué existe): el cliente decía «nunca manda el correo». El correo sí salía, pero la pantalla no decía a
 * dónde, no dejaba reenviar ni volver, y al terminar dejaba una sesión que el servidor ya había revocado. Esta prueba
 * recorre el flujo como lo hace la persona y comprueba cada una de esas cosas contra una API simulada que aplica las
 * mismas reglas que el servidor (`api-simulada.mjs`): el código viaja a un buzón, sólo ese código confirma, hay 60 s entre
 * envíos y al confirmar se revocan todas las sesiones.
 *
 * Qué NO prueba: la entrega real del correo (Gmail) ni el backend real: eso lo cubren las pruebas del backend. Aquí se
 * prueba que la APP hace lo correcto con lo que el servidor le contesta.
 *
 * Uso:
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-pin
 *   (servir /tmp/web-pin como SPA en 8766)
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/cambiar-pin.mjs --base http://127.0.0.1:8766 [--salida carpeta]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { crearApiSimulada } from './api-simulada.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = args.get('base') ?? 'http://127.0.0.1:8766';
const SALIDA = args.get('salida') ?? 'e2e-web/salida-cambiar-pin';
const PUERTO_API = Number(args.get('api') ?? 8799);
const PIN_ACTUAL = '4821';
const PIN_NUEVO = '7391';

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

mkdirSync(SALIDA, { recursive: true });
const api = crearApiSimulada({ puerto: PUERTO_API, pinInicial: PIN_ACTUAL });
await api.escuchar();

const browser = await chromium.launch();
const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 } });
const page = await contexto.newPage();
const errores = [];
const ruta = [];
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) ruta.push(new URL(f.url()).pathname);
});
page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));

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
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, archivo) }).catch(() => undefined);
  resultados.push({ nombre, estado, detalle });
  console.log(`${estado === 'ok' ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};
const texto = (t) => page.getByText(t, { exact: false }).first();
const caja = (nombre) => page.getByRole('textbox', { name: nombre }).first();
const bandeja = async () => (await (await fetch(`http://127.0.0.1:${PUERTO_API}/api/v1/__bandeja`)).json()).bandeja;

/** Entra con un PIN y espera salir de /ingresar. */
async function entrar(pin) {
  await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await caja('Correo o teléfono').fill('pablo@example.com');
  await caja('PIN').fill(pin);
  await page.keyboard.press('Enter');
}

await paso('entrar con el PIN actual', async () => {
  await entrar(PIN_ACTUAL);
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
});

await paso('abrir «Cambiar mi PIN»', async () => {
  await page.goto(`${BASE}/cambiar-pin`, { waitUntil: 'load' });
  await texto('Paso 1 de 2').waitFor({ timeout: 30000 });
  // La secuencia de marca se reproduce una vez por pestaña y tapa la pantalla unos segundos: se espera a que acabe.
  await page.waitForTimeout(6000);
  afirmar((await page.getByRole('button', { name: /Enviarme el código/ }).count()) > 0, 'falta el botón «Enviarme el código»');
});

await paso('un PIN actual equivocado se dice y NO manda ningún correo', async () => {
  await caja('Tu PIN actual').fill('0000');
  await page.getByRole('button', { name: /Enviarme el código/ }).click();
  await page.waitForTimeout(1200);
  afirmar((await bandeja()).length === 0, 'se mandó un correo con el PIN actual equivocado');
  afirmar((await page.getByText('Paso 1 de 2').count()) > 0, 'avanzó al paso 2 con un PIN equivocado');
  return 'bandeja vacía';
});

await paso('con el PIN correcto manda el correo y el paso 2 dice A DÓNDE', async () => {
  await caja('Tu PIN actual').fill(PIN_ACTUAL);
  await page.getByRole('button', { name: /Enviarme el código/ }).click();
  await texto('Paso 2 de 2').waitFor({ timeout: 15000 });
  await texto('Te enviamos un código de 6 dígitos a pa***@gmail.com').waitFor({ timeout: 5000 });
  const correos = await bandeja();
  afirmar(correos.length === 1, `se esperaba 1 correo y hay ${correos.length}`);
  afirmar(/^\d{6}$/.test(correos[0].codigo), 'el correo no trae un código de 6 dígitos');
  afirmar((await page.getByText('Spam o Promociones').count()) > 0, 'no dice dónde mirar si no llega');
  return `correo a ${correos[0].para}, destino enmascarado en pantalla`;
});

await paso('el reenvío está bloqueado con cuenta atrás (los 60 s del servidor)', async () => {
  const boton = page.getByRole('button', { name: /Reenviar código en \d+ s/ });
  await boton.waitFor({ timeout: 5000 });
  afirmar(await boton.isDisabled(), 'el reenvío no está bloqueado durante la espera');
  afirmar((await bandeja()).length === 1, 'se mandó un segundo correo antes de tiempo');
});

await paso('un código EQUIVOCADO se dice y se queda en el paso 2', async () => {
  const [real] = await bandeja();
  const malo = real.codigo === '000000' ? '111111' : '000000';
  await caja('Código de 6 dígitos').fill(malo);
  await caja('Tu PIN nuevo').fill(PIN_NUEVO);
  await page.getByRole('button', { name: /Guardar mi PIN nuevo/ }).click();
  await page.waitForTimeout(1200);
  afirmar((await page.getByText('Paso 2 de 2').count()) > 0, 'salió del paso 2 con un código malo');
  afirmar((await page.getByText('PIN actualizado').count()) === 0, 'dio por cambiado el PIN con un código malo');
});

await paso('el código del CORREO confirma el cambio', async () => {
  const [real] = await bandeja();
  await caja('Código de 6 dígitos').fill(real.codigo);
  await caja('Tu PIN nuevo').fill(PIN_NUEVO);
  await page.getByRole('button', { name: /Guardar mi PIN nuevo/ }).click();
  await texto('PIN actualizado').waitFor({ timeout: 15000 });
  await texto('cerramos todas tus sesiones, también ésta').waitFor({ timeout: 5000 });
  afirmar((await page.getByRole('button', { name: /Volver a mi perfil/ }).count()) === 0, 'ofrece volver al perfil con la sesión ya muerta');
});

await paso('«Entrar con mi PIN nuevo» cierra la sesión y lleva a entrar', async () => {
  await page.getByRole('button', { name: /Entrar con mi PIN nuevo/ }).click();
  await page.waitForURL(/\/ingresar|\/bienvenida/, { timeout: 15000 });
});

await paso('el PIN VIEJO ya no entra', async () => {
  await entrar(PIN_ACTUAL);
  await page.waitForTimeout(2500);
  afirmar(new URL(page.url()).pathname.startsWith('/ingresar'), 'el PIN viejo siguió entrando');
});

await paso('el PIN NUEVO sí entra', async () => {
  await entrar(PIN_NUEVO);
  await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
});

await browser.close();
await api.cerrar();

const fallos = resultados.filter((r) => r.estado !== 'ok');
if (errores.length) console.log(`errores de página: ${errores.length}\n  ${errores.slice(0, 5).join('\n  ')}`);
console.log(`rutas visitadas: ${ruta.join(' → ')}`);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} pasos ok · capturas en ${SALIDA}`);
process.exit(fallos.length ? 1 : 0);
