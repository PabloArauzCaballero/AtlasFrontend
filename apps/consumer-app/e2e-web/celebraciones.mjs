/**
 * Las celebraciones de logros, en un navegador real: la ceremonia al ganar, la carta y la vitrina.
 *
 * Qué prueba (y por qué existe): jest ve el árbol, no el dibujo. Aquí se comprueba que
 *  1. tres logros nuevos (bronce, oro y una subida de nivel) salen como UNA ceremonia: «1 de 3», «2 de 3», y el nivel
 *     el último;
 *  2. «Saltar todas» cierra la ceremonia entera;
 *  3. la vitrina abre la carta de una insignia ganada y la de una pendiente;
 *  4. en NINGÚN momento la página se ensancha: ni en el golpe (rayos y chispas en vuelo), ni en reposo, ni durante la
 *     secuencia de arranque. Una capa decorativa que sobresalía ensanchaba el documento y el navegador lo desplazaba de
 *     lado (2026-10-15: la ceremonia salía 31-41 px corrida a la izquierda; el arranque llevaba el ancho a 576 px);
 * y deja capturas de cada momento, en claro y en oscuro, para mirarlas.
 *
 * Uso:
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-celebr
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/celebraciones.mjs --dist /tmp/web-celebr [--salida carpeta] [--temas claro,oscuro]
 *
 * Sirve el `dist` él mismo (como SPA) y levanta la API simulada. `--canal chrome` usa el Chrome instalado si Playwright
 * no tiene navegadores propios.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { crearApiSimulada } from './api-simulada.mjs';
import { PROGRESO } from './api-simulada-credito.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const DIST = args.get('dist') ?? '/tmp/web-celebr';
const SALIDA = args.get('salida') ?? 'e2e-web/salida-celebraciones';
const PUERTO_WEB = Number(args.get('web') ?? 8767);
const TEMAS = (args.get('temas') ?? 'claro,oscuro').split(',');
const CANAL = args.get('canal');
// `--antes 1`: la versión anterior, sin «Saltar todas»; sólo para sacar las capturas de comparación.
const ANTES = args.has('antes');
const PIN = '4821';

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

const insignia = (code, label, icon, rank, category, earned, current, target, extra = {}) => ({
  code, label, detail: `${label}: así se gana.`, icon, rank, category, secret: false, hint: null, earned, current, target, ...extra,
});
// 1.200 puntos: nivel «Constante» (4 de 12). El teléfono recordaba «En crecimiento»: hay subida de nivel.
PROGRESO.experience = {
  ...PROGRESO.experience,
  xp: 1200,
  badges: [
    insignia('primer_pago', 'Primer pago', 'check', 'bronce', 'pagos', true, 1, 1),
    insignia('racha_6', 'Racha de 6', 'fuego', 'oro', 'rachas', true, 6, 6, { detail: 'Seis cuotas seguidas pagadas a tiempo.' }),
    insignia('racha_3', 'Racha de 3', 'fuego', 'plata', 'rachas', true, 3, 3),
    insignia('racha_12', 'Racha de 12', 'rayo', 'platino', 'rachas', false, 6, 12),
    insignia('mil_bs', 'Mil a tiempo', 'moneda', 'oro', 'dinero', false, 640, 1000),
    insignia('remontada', 'La remontada', 'estrella', 'diamante', 'estilo', false, 0, 1, { secret: true, hint: 'Tropezar no es el final.' }),
    insignia('primera_compra', 'Primera compra', 'bolsa', 'bronce', 'compras', true, 1, 1),
  ],
};
delete PROGRESO.level;
delete PROGRESO.nextLevel;
delete PROGRESO.levelLadder;
const VISTOS = JSON.stringify({ insignias: ['racha_3', 'primera_compra'], nivel: 'EN_CONSTRUCCION' });

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const web = createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = join(DIST, ruta);
  if (!existsSync(archivo) || statSync(archivo).isDirectory()) archivo = existsSync(`${archivo}.html`) ? `${archivo}.html` : join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
  createReadStream(archivo).pipe(res);
});

mkdirSync(SALIDA, { recursive: true });
const resultados = [];
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

async function recorrer(tema) {
  const api = crearApiSimulada({ pinInicial: PIN });
  await api.escuchar();
  const browser = await chromium.launch(CANAL ? { channel: CANAL } : {});
  const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await contexto.addInitScript(([t, vistos]) => {
    localStorage.setItem('atlas.apariencia', t);
    if (!localStorage.getItem('atlas.logros.vistos.v1:53')) localStorage.setItem('atlas.logros.vistos.v1:53', vistos);
  }, [tema, VISTOS]);
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
  let n = 0;
  /**
   * Que el documento no sea más ancho que la ventana ni esté desplazado de lado. No corta el recorrido: anota el momento
   * y lo que sobresale, y el paso final falla con la lista entera (así un desborde en el arranque no esconde los demás).
   */
  const desbordes = [];
  const sinDesborde = async (momento) => {
    const m = await page.evaluate(() => {
      const se = document.scrollingElement;
      const W = window.innerWidth;
      const fuera = [...document.querySelectorAll('body *')]
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.right > W + 1)
        .slice(-3)
        .map(({ e, r }) => `${e.tagName.toLowerCase()}${e.getAttribute('data-testid') ? `#${e.getAttribute('data-testid')}` : ''} ${Math.round(r.width)}px→${Math.round(r.right)}`);
      return { ancho: se.scrollWidth, ventana: W, desplazado: se.scrollLeft, fuera };
    });
    if (m.ancho > m.ventana + 1 || m.desplazado !== 0)
      desbordes.push(`${momento}: mide ${m.ancho} px en ${m.ventana}, desplazada ${m.desplazado} px (${m.fuera.join(', ')})`);
  };
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(SALIDA, `${tema}-${String(n).padStart(2, '0')}-${nombre}.png`) });
    await sinDesborde(nombre);
  };
  async function paso(nombre, fn) {
    let estado = 'ok';
    let detalle = '';
    try {
      detalle = (await fn()) ?? '';
    } catch (e) {
      estado = 'FALLO';
      detalle = String(e.message ?? e).split('\n')[0].slice(0, 240);
      await foto(`fallo-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`).catch(() => undefined);
    }
    resultados.push({ tema, nombre, estado, detalle });
    console.log(`${estado === 'ok' ? '✓' : '✗'} [${tema}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
  const boton = (nombre) => page.getByRole('button', { name: nombre }).first();

  await paso('entrar', async () => {
    await page.goto(`http://127.0.0.1:${PUERTO_WEB}/ingresar`, { waitUntil: 'load' });
    // A mitad de la secuencia de arranque, que es cuando su resplandor es más grande.
    await page.waitForTimeout(700);
    await sinDesborde('arranque');
    await page.waitForTimeout(800);
    await page.getByRole('textbox', { name: 'Correo o teléfono' }).first().fill('pablo@example.com');
    await page.getByRole('textbox', { name: 'PIN' }).first().fill(PIN);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
  });

  await paso('la ceremonia: bronce, oro y el nivel al final', async () => {
    const escena = page.getByTestId('celebracion-logro');
    // El recorrido de bienvenida sale la primera vez y la celebración espera a que se cierre.
    const saltar = page.getByRole('button', { name: 'Saltar', exact: true });
    await saltar.first().waitFor({ timeout: 15000 }).then(() => saltar.first().click()).catch(() => undefined);
    await escena.waitFor({ timeout: 40000 });
    await page.waitForTimeout(450);
    await foto('ceremonia-1-impacto');
    await page.waitForTimeout(2600);
    await foto('ceremonia-1-reposo');
    afirmar((await page.getByText('Primer pago', { exact: true }).count()) > 0, 'la primera no es la de bronce');
    afirmar((await page.getByText(/1 de 3/).count()) > 0, 'no dice «1 de 3»');
    afirmar(ANTES || (await boton(/Saltar todas/).count()) > 0, 'no ofrece «Saltar todas» con tres en cola');
    await boton(/Siguiente/).click();
    await page.waitForTimeout(700);
    await foto('ceremonia-2-impacto');
    await page.waitForTimeout(2600);
    await foto('ceremonia-2-reposo');
    afirmar((await page.getByText('Racha de 6', { exact: true }).count()) > 0, 'la segunda no es la de oro');
    await boton(/Siguiente/).click();
    await page.waitForTimeout(3200);
    await foto('ceremonia-3-nivel');
    afirmar((await page.getByText('¡SUBISTE DE NIVEL!').count()) > 0, 'el nivel no cierra la ceremonia');
    afirmar(ANTES || (await boton(/Saltar todas/).count()) === 0, '«Saltar todas» sigue en la última');
    await boton(/Genial/).click();
    await page.waitForTimeout(800);
    afirmar((await escena.count()) === 0, 'la escena no se cerró');
  });

  await paso('la vitrina y sus cartas', async () => {
    await page.goto(`http://127.0.0.1:${PUERTO_WEB}/progreso`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Pestaña Logros' }).first().click({ timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.getByTestId('vitrina-paginada').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await foto('vitrina');
    await page.getByTestId('insignia-primer_pago').click();
    await page.getByTestId('carta-de-insignia').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2200);
    await foto('carta-ganada');
    await page.getByTestId('carta-cerrar').click();
    await page.waitForTimeout(600);
    await page.getByRole('tab', { name: 'Colección Rachas' }).click();
    await page.waitForTimeout(900);
    await foto('vitrina-rachas');
    await page.getByTestId('insignia-racha_12').click();
    await page.getByTestId('carta-de-insignia').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2200);
    await foto('carta-pendiente');
    await page.getByTestId('carta-cerrar').click();
  });

  await paso('sin desborde horizontal en ningún momento', async () => {
    afirmar(desbordes.length === 0, desbordes.join(' | '));
    return `${n + 1} momentos medidos`;
  });

  await paso('sin errores de JavaScript en la página', async () => {
    afirmar(errores.length === 0, errores.join(' | '));
  });

  await browser.close();
  await api.cerrar();
}

await new Promise((r) => web.listen(PUERTO_WEB, '127.0.0.1', r));
for (const tema of TEMAS) await recorrer(tema);
web.close();

const fallos = resultados.filter((r) => r.estado !== 'ok');
console.log(`\n${resultados.length - fallos.length} de ${resultados.length} pasos en verde. Capturas en ${SALIDA}`);
process.exit(fallos.length ? 1 : 0);
