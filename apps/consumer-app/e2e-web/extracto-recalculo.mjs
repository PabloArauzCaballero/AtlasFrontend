/**
 * «Recalcular mi línea» en un navegador real, en sus cuatro estados.
 *
 * Qué prueba (y por qué existe): Pablo (2026-10-15) dijo que la solicitud de recalcular con el extracto «no se está
 * viendo o leyendo bien». Aquí se comprueba, con la respuesta que manda AtlasBackend, que
 *  1. en curso se ven las etapas y la hora comprometida en una fila legible (ya no en una pastilla diminuta);
 *  2. en revisión humana la lectura sigue en curso;
 *  3. aplicado, se ve la línea de antes → la de ahora y la cuenta que las une, con el tope que manda marcado;
 *  4. aplicado SIN línea (la retiene una persona) no dice «tu línea se actualizó»;
 * y deja capturas de cada estado.
 *
 * Uso (`--api` y `--web` cambian los puertos; el de la API va también en el export):
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-extracto
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/extracto-recalculo.mjs --dist /tmp/web-extracto [--salida carpeta] [--temas claro,oscuro]
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { crearApiSimulada } from './api-simulada.mjs';
import { EXTRACTOS } from './api-simulada-credito.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const DIST = args.get('dist') ?? '/tmp/web-extracto';
const SALIDA = args.get('salida') ?? 'e2e-web/salida-extracto';
const PUERTO_WEB = Number(args.get('web') ?? 8768);
const PUERTO_API = Number(args.get('api') ?? 8799);
const TEMAS = (args.get('temas') ?? 'claro,oscuro').split(',');
const CANAL = args.get('canal');
const PIN = '4821';

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

const BASE = { ...EXTRACTOS[0] };
const ESTADOS = {
  'en-curso': {
    ...BASE,
    status: 'processing',
    statusLabel: 'Calculando tu nueva capacidad',
    statusDetail: 'Ya leímos tu extracto y estamos recalculando cuánto puedes gastar.',
    appliedCreditLineId: null,
    lineChange: null,
    inHumanReview: false,
    lineAwaitingApproval: false,
  },
  'en-revision': {
    ...BASE,
    status: 'processing',
    statusLabel: 'Tu extracto está en revisión',
    statusDetail: 'Reconocimos tu banco pero todavía no leemos automáticamente su formato. Una persona lo está revisando; no necesitas hacer nada.',
    appliedCreditLineId: null,
    institutionName: null,
    period: null,
    lineChange: null,
    inHumanReview: true,
    lineAwaitingApproval: false,
  },
  aplicado: {
    ...BASE,
    status: 'applied',
    statusLabel: 'Listo, tu línea se actualizó',
    statusDetail: 'Tu capacidad de pago se recalculó con los movimientos reales de tu cuenta.',
    inHumanReview: false,
    lineAwaitingApproval: false,
    capacity: {
      monthsAnalyzed: 3,
      monthlyIncome: 6200,
      committedExpenses: 3100,
      monthlyObligations: 900,
      maxAffordableInstallment: 1500,
      score: 71,
      band: 'B',
      reasons: [],
    },
    lineChange: {
      previousLimit: 900,
      newLimit: 1275,
      currencyCode: 'BOB',
      calculation: {
        monthlyInstallment: 1500,
        termMonths: 3,
        byCapacity: 4500,
        byRelationship: 1500,
        relationshipTier: 'NUEVO',
        byGraduation: 1800,
        productCeiling: 20000,
        recommendedLimit: 1500,
        bindingConstraint: 'RELACION',
        riskBand: 'B',
        approvedLimit: 1275,
      },
    },
  },
  retenido: {
    ...BASE,
    status: 'applied',
    statusLabel: 'Leímos tu extracto',
    statusDetail:
      'Tu capacidad de pago ya quedó medida con tus movimientos. Una persona del equipo confirma tu nueva línea; la verás en Inicio en cuanto la apruebe.',
    appliedCreditLineId: null,
    lineAwaitingApproval: true,
    inHumanReview: false,
    lineChange: null,
  },
};

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
  const api = crearApiSimulada({ puerto: PUERTO_API, pinInicial: PIN });
  await api.escuchar();
  const browser = await chromium.launch(CANAL ? { channel: CANAL } : {});
  const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await contexto.addInitScript((t) => localStorage.setItem('atlas.apariencia', t), tema);
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
  let estadoActual = 'en-curso';
  // El estado del extracto lo decide la prueba: se responde antes de que la petición llegue a la API simulada.
  await page.route('**/customers/53/bank-statements/latest', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ESTADOS[estadoActual]) }),
  );
  let n = 0;
  const foto = async (nombre) => {
    n += 1;
    await page.screenshot({ path: join(SALIDA, `${tema}-${String(n).padStart(2, '0')}-${nombre}.png`), fullPage: true });
  };
  async function paso(nombre, fn) {
    let estado = 'ok';
    let detalle = '';
    try {
      detalle = (await fn()) ?? '';
    } catch (e) {
      estado = 'FALLO';
      detalle = String(e.message ?? e).split('\n')[0].slice(0, 240);
    }
    resultados.push({ tema, nombre, estado, detalle });
    console.log(`${estado === 'ok' ? '✓' : '✗'} [${tema}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
  const texto = (t) => page.getByText(t, { exact: false }).first();
  /** La página no se desborda en horizontal; si lo hace, dice qué elemento sobresale. */
  const sinScrollLateral = async () => {
    const fuera = await page.evaluate(() => {
      const w = window.innerWidth;
      if (document.scrollingElement.scrollWidth <= w) return '';
      const malos = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > w + 1);
      const hojas = malos.filter((e) => !malos.some((o) => o !== e && e.contains(o)));
      return `${document.scrollingElement.scrollWidth} > ${w}: ${hojas.slice(0, 3).map((e) => `${e.tagName.toLowerCase()} «${(e.textContent ?? '').trim().slice(0, 40)}»`).join(' · ')}`;
    });
    afirmar(!fuera, `la página se desborda en horizontal (${fuera})`);
  };
  const abrir = async (estado) => {
    estadoActual = estado;
    await page.goto(`http://127.0.0.1:${PUERTO_WEB}/extracto-bancario`, { waitUntil: 'load' });
    await page.getByTestId('extracto-estado').waitFor({ timeout: 30000 });
    // La secuencia de marca se reproduce al cargar y tapa la pantalla unos segundos: se espera a que acabe.
    await page.waitForTimeout(6500);
  };

  await paso('entrar', async () => {
    await page.goto(`http://127.0.0.1:${PUERTO_WEB}/ingresar`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.getByRole('textbox', { name: 'Correo o teléfono' }).first().fill('pablo@example.com');
    await page.getByRole('textbox', { name: 'PIN' }).first().fill(PIN);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
    const saltar = page.getByRole('button', { name: 'Saltar', exact: true });
    await saltar.first().waitFor({ timeout: 8000 }).then(() => saltar.first().click()).catch(() => undefined);
  });

  await paso('en curso: etapas y hora comprometida legible', async () => {
    await abrir('en-curso');
    await texto('Recalculamos tu línea').waitFor();
    afirmar(await page.getByText('Respuesta a más tardar').count(), 'no se ve «Respuesta a más tardar»');
    afirmar((await page.getByText(/Tendrás respuesta antes/).count()) === 0, 'volvió la pastilla con la hora');
    await sinScrollLateral();
    await foto('en-curso');
  });

  await paso('en revisión humana: la lectura sigue en curso', async () => {
    await abrir('en-revision');
    await texto('Una persona lo está revisando').waitFor();
    await sinScrollLateral();
    await foto('en-revision');
  });

  await paso('aplicado: antes → ahora y la cuenta', async () => {
    await abrir('aplicado');
    await page.getByTestId('extracto-cambio-de-linea').waitFor();
    afirmar(await page.getByText('Bs 900', { exact: true }).count(), 'no se ve la línea de antes');
    afirmar(await page.getByText('Bs 1.275', { exact: true }).count(), 'no se ve la línea nueva');
    afirmar(await page.getByText('Subió Bs 375.').count(), 'no se ve cuánto subió');
    afirmar(await page.getByText('Es lo que manda').count(), 'no se marca el tope que manda');
    afirmar(await page.getByText('−Bs 225').count(), 'no se ve el ajuste por riesgo');
    await sinScrollLateral();
    await foto('aplicado');
  });

  await paso('retenido: no dice «tu línea se actualizó»', async () => {
    await abrir('retenido');
    await texto('Leímos tu extracto').waitFor();
    afirmar((await page.getByText('Listo, tu línea se actualizó').count()) === 0, 'dice que la línea se actualizó');
    afirmar((await page.getByText('Ver mi línea actualizada').count()) === 0, 'ofrece ver una línea que no cambió');
    afirmar(await page.getByText('Una persona del equipo la confirma.').count(), 'la etapa de la línea no dice quién la confirma');
    await sinScrollLateral();
    await foto('retenido');
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
