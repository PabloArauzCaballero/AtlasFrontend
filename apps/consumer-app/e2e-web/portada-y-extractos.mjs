/**
 * La portada y los extractos, en un navegador real.
 *
 * Qué prueba (y por qué existe): tres cosas que son pedido de negocio y que jest sólo ve como árbol —
 *  1. el ORDEN de la portada medido en píxeles: primero cuánto crédito hay habilitado, después los puntos XP y
 *     después la calificación parte por parte. Ni con pagos vencidos el aviso rojo pasa por encima de la línea;
 *  2. que «Mis datos» lista los extractos bancarios que subió la persona;
 *  3. que el PDF se DESCARGA de verdad: salen los bytes que mandó el servidor, pedidos con la sesión.
 *
 * Qué NO prueba: el backend real ni el motor (lo cubren sus repos). Aquí se prueba que la APP hace lo correcto con lo
 * que el servidor le contesta (`api-simulada.mjs` + `api-simulada-credito.mjs`).
 *
 * Uso:
 *   EXPO_PUBLIC_ATLAS_API_URL=http://127.0.0.1:8799/api/v1 npx expo export --platform web --output-dir /tmp/web-portada
 *   (servir /tmp/web-portada como SPA en 8766)
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node e2e-web/portada-y-extractos.mjs --base http://127.0.0.1:8766 [--salida carpeta] [--anchos 390,1280]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { crearApiSimulada } from './api-simulada.mjs';
import { PDF_DE_PRUEBA } from './api-simulada-credito.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = args.get('base') ?? 'http://127.0.0.1:8766';
const SALIDA = args.get('salida') ?? 'e2e-web/salida-portada';
const PUERTO_API = Number(args.get('api') ?? 8799);
const ANCHOS = (args.get('anchos') ?? '390').split(',').map(Number);
const PIN = '4821';

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

mkdirSync(SALIDA, { recursive: true });
const resultados = [];
const afirmar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

async function recorrer({ ancho, vencido }) {
  const api = crearApiSimulada({ puerto: PUERTO_API, pinInicial: PIN, vencido });
  await api.escuchar();
  const browser = await chromium.launch();
  const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: ancho, height: 844 }, acceptDownloads: true });
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
  const etiqueta = `${ancho}${vencido ? '-con-mora' : ''}`;
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
    const archivo = `${etiqueta}-${String(n).padStart(2, '0')}-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SALIDA, archivo), fullPage: true }).catch(() => undefined);
    resultados.push({ ancho, vencido, nombre, estado, detalle });
    console.log(`${estado === 'ok' ? '✓' : '✗'} [${etiqueta}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
  const texto = (t) => page.getByText(t, { exact: false }).first();
  /**
   * La TARJETA que contiene ese texto: dónde empieza en el documento (no en la ventana).
   *
   * Se mide la tarjeta y no el texto porque en pantallas anchas la portada va en dos columnas: el crédito a la
   * izquierda y, a su derecha, los puntos y la calificación. Ahí «primero» es orden de LECTURA —fila y después
   * columna—, no sólo altura.
   */
  const lugar = async (t) => {
    const caja = await texto(t).boundingBox();
    afirmar(caja, `no se ve «${t}»`);
    return { x: Math.round(caja.x), y: Math.round(caja.y + (await page.evaluate(() => window.scrollY))) };
  };
  /** `a` se lee antes que `b`: más arriba, o en la misma franja y más a la izquierda. */
  const antes = (a, b) => (Math.abs(a.y - b.y) > 24 ? a.y < b.y : a.x < b.x);
  const diga = (l) => `(${l.x},${l.y})`;

  await paso('entrar', async () => {
    await page.goto(`${BASE}/ingresar`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.getByRole('textbox', { name: 'Correo o teléfono' }).first().fill('pablo@example.com');
    await page.getByRole('textbox', { name: 'PIN' }).first().fill(PIN);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/ingresar'), { timeout: 30000 });
  });

  await paso('la portada: crédito, puntos XP y calificación, en ese orden', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await texto('Disponible para comprar').waitFor({ timeout: 30000 });
    // La secuencia de marca se reproduce una vez por pestaña y tapa la pantalla unos segundos: se espera a que acabe.
    await page.waitForTimeout(6000);
    await texto('PUNTOS XP').waitFor({ timeout: 15000 });
    await texto('Tu calificación, parte por parte').waitFor({ timeout: 15000 });

    // El recorrido de bienvenida se abre solo la primera vez y tapa media portada: se cierra antes de medir.
    const saltar = page.getByRole('button', { name: 'Saltar' });
    if (await saltar.count()) await saltar.first().click();
    await page.waitForTimeout(600);

    const orden = {
      credito: await lugar('Disponible para comprar'),
      puntos: await lugar('PUNTOS XP'),
      calificacion: await lugar('Tu calificación, parte por parte'),
    };
    afirmar(antes(orden.credito, orden.puntos), `los puntos ${diga(orden.puntos)} se leen antes que el crédito ${diga(orden.credito)}`);
    afirmar(antes(orden.puntos, orden.calificacion), `la calificación ${diga(orden.calificacion)} se lee antes que los puntos ${diga(orden.puntos)}`);
    // Nada de la portada empieza por encima de la línea de crédito.
    for (const otro of ['PUNTOS XP', 'Tu calificación, parte por parte', 'Tus compras']) {
      afirmar((await lugar(otro)).y >= orden.credito.y - 24, `«${otro}» empieza por encima del crédito`);
    }

    // El importe de la línea que mandó el servidor, y los puntos, tal cual.
    afirmar((await page.getByText(/1[.,]000/).count()) > 0, 'no se ve el disponible (Bs 1.000) de la línea');
    afirmar((await page.getByText('350 XP').count()) > 0, 'no se ven los 350 XP');
    for (const parte of ['Pagos a tiempo', 'Compras terminadas de pagar', 'Antigüedad', 'Identidad verificada']) {
      afirmar((await page.getByText(parte).count()) > 0, `la calificación no desglosa «${parte}»`);
    }

    if (vencido) {
      const mora = await lugar('Tienes pagos que regularizar');
      afirmar(antes(orden.credito, mora), `el aviso de mora ${diga(mora)} se lee antes que el crédito ${diga(orden.credito)}`);
      afirmar(antes(mora, orden.puntos), `los puntos ${diga(orden.puntos)} se leen antes que el aviso de mora ${diga(mora)}`);
      return `crédito ${diga(orden.credito)} → mora ${diga(mora)} → puntos ${diga(orden.puntos)} → calificación ${diga(orden.calificacion)}`;
    }
    afirmar((await page.getByText('Tienes pagos que regularizar').count()) === 0, 'aparece un aviso de mora sin pagos vencidos');
    return `crédito ${diga(orden.credito)} → puntos ${diga(orden.puntos)} → calificación ${diga(orden.calificacion)}`;
  });

  await paso('sin desborde horizontal en la portada', async () => {
    const [ventana, documento] = await page.evaluate(() => [window.innerWidth, document.documentElement.scrollWidth]);
    afirmar(documento <= ventana + 1, `el documento mide ${documento} px en una ventana de ${ventana}`);
    return `${documento} ≤ ${ventana}`;
  });

  if (!vencido) {
    await paso('Mis datos pide el PIN y enseña los extractos subidos', async () => {
      await page.goto(`${BASE}/mis-datos`, { waitUntil: 'load' });
      await page.waitForTimeout(6000);
      const pin = page.getByRole('textbox').first();
      if ((await page.getByText('Tus extractos bancarios').count()) === 0) {
        await pin.fill(PIN);
        await page.keyboard.press('Enter');
      }
      await texto('Tus extractos bancarios').waitFor({ timeout: 30000 });
      await texto('Aplicado a tu línea').waitFor({ timeout: 15000 });
      afirmar((await page.getByText(/Banco Unión/).count()) > 0, 'no dice de qué banco es el extracto');
      afirmar((await page.getByText('No pudimos usarlo').count()) > 0, 'no lista el extracto rechazado');
      afirmar((await page.getByRole('button', { name: /Ver o descargar/ }).count()) === 1, 'debe haber UN botón: el segundo archivo ya no está guardado');
      afirmar((await page.getByText(/ya no está guardado en Atlas/).count()) > 0, 'no explica por qué el segundo no se descarga');
      afirmar(api.estado.llamadas.includes('GET /customers/53/bank-statements'), 'la pantalla no pidió la lista de extractos');
    });

    await paso('el PDF del extracto se descarga con los bytes del servidor', async () => {
      const [descarga] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.getByRole('button', { name: /Ver o descargar/ }).first().click(),
      ]);
      afirmar(descarga.suggestedFilename() === 'extracto-2026-09-14.pdf', `nombre inesperado: ${descarga.suggestedFilename()}`);
      const bytes = readFileSync(await descarga.path());
      afirmar(bytes.equals(PDF_DE_PRUEBA), `llegaron ${bytes.length} bytes distintos de los ${PDF_DE_PRUEBA.length} del servidor`);
      afirmar(bytes.subarray(0, 5).toString() === '%PDF-', 'lo descargado no es un PDF');
      afirmar(api.estado.llamadas.includes('GET /customers/53/bank-statements/7/file'), 'no se pidió el archivo del extracto 7');
      return `${descarga.suggestedFilename()} · ${bytes.length} bytes`;
    });
  }

  await paso('sin errores de JavaScript en la página', async () => {
    afirmar(errores.length === 0, errores.join(' | '));
  });

  await browser.close();
  await api.cerrar();
}

for (const ancho of ANCHOS) {
  await recorrer({ ancho, vencido: 0 });
  await recorrer({ ancho, vencido: 320 });
}

const fallos = resultados.filter((r) => r.estado !== 'ok');
console.log(`\n${resultados.length - fallos.length} de ${resultados.length} pasos en verde. Capturas en ${SALIDA}`);
process.exit(fallos.length ? 1 : 0);
