/**
 * El alta por fases, de punta a punta en el navegador, contra un entorno REAL (dev o test).
 *
 * Recorre las cuatro fases con toques de verdad —bienvenida, registro, código, carnet (cámara falsa
 * de Chromium con el carnet sintético), confirmación de datos, domicilio, economía, referencias,
 * permisos, hábitos, envío— y despues comprueba EN LA BASE que la bitácora quedó escrita: eventos
 * de campo, pantallas con tiempos, toques con posición, resumen calculado, variables al Motor y
 * respuestas de la encuesta. No se da por bueno ningún paso por la pantalla: cuenta la respuesta
 * del servidor y la fila en la base.
 *
 * Uso:
 *   node e2e-web/alta-por-fases.mjs --base http://app.161.97.85.216.sslip.io --ssh root@161.97.85.216 \
 *     --db atlas --carnet /ruta/carnet.y4m [--salida carpeta]
 *
 * `--ssh` es el host donde vive `atlas-postgres` (para leer el código de verificación y comprobar
 * las tablas); sin él se salta la verificación en base y el código hay que pasarlo con `--codigo`.
 * `--hasta N` para en el paso N (depuración). `PLAYWRIGHT_DIR` apunta a un `node_modules/playwright`
 * (la app no lo instala; el del ERP frontend sirve).
 *
 * La cámara falsa: un y4m cuyos cuadros DIFIEREN entre sí. Con una imagen fija las tres capturas
 * tienen el mismo SHA-256 y el paquete choca con `ux_evidence_documents_customer_hash` (409). Se
 * genera a partir del carnet sintético con un marcador que se mueve:
 *   ffmpeg -loop 1 -i carnet.png -f lavfi -i "color=red:s=12x12:r=30" \
 *     -filter_complex "[0][1]overlay=x='mod(t*90,600)':y=main_h-16:shortest=1,format=yuv420p" -t 20 -r 30 carnet-movil.y4m
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const BASE = (args.get('base') ?? 'http://localhost:8790').replace(/\/+$/, '');
const SSH = args.get('ssh');
const DB = args.get('db') ?? 'atlas';
// Chromium sólo admite UN archivo como cámara falsa: la selfie sale del mismo cuadro que el carnet.
// Lo que se prueba aquí es el recorrido y la bitácora; el cotejo facial se mide con cédulas reales.
const CARNET = args.get('carnet');
const SALIDA = args.get('salida') ?? 'e2e-web/salida-alta';
const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');

mkdirSync(SALIDA, { recursive: true });
const informe = [];
const inicioDelAlta = Date.now();

/* ------------------------------------------------------------------ base de datos por ssh */
function sql(consulta, base = DB) {
  if (!SSH) return '';
  return execFileSync('ssh', ['-o', 'ConnectTimeout=10', SSH, `docker exec atlas-postgres psql -U atlas_admin -d ${base} -Atc ${JSON.stringify(consulta)}`], {
    encoding: 'utf8',
    timeout: 60_000,
  }).trim();
}

/** El código es de seis dígitos y solo se guarda su SHA-256: se recupera probando el millón. */
function recuperarCodigo(hash) {
  for (let n = 0; n < 1_000_000; n += 1) {
    const codigo = String(n).padStart(6, '0');
    if (createHash('sha256').update(codigo).digest('hex') === hash) return codigo;
  }
  return null;
}

async function codigoDeVerificacion(customerId) {
  if (args.get('codigo')) return args.get('codigo');
  if (!SSH) throw new Error('sin --ssh ni --codigo no hay forma de leer el código');
  // El último código emitido para este cliente que no se ha consumido.
  for (let intento = 0; intento < 10; intento += 1) {
    const hash = sql(`select code_hash from iam.auth_one_time_codes where actor_id = ${customerId} and consumed_at is null order by _id desc limit 1`);
    if (hash) {
      const codigo = recuperarCodigo(hash);
      if (codigo) return codigo;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('no apareció ningún código en iam.auth_one_time_codes');
}

/* ------------------------------------------------------------------ navegador */
const flags = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
if (CARNET) flags.push(`--use-file-for-fake-video-capture=${CARNET}`);
// `getUserMedia` sólo existe en contexto seguro: en TEST la web va por HTTP plano y sin esto la
// cámara no abre (la captura moría con «No pudimos completar la operación»). Es un ajuste del
// navegador de la prueba; a una persona en HTTP la cámara no le funcionará hasta tener HTTPS.
// La marca sólo la respeta el Chromium completo (`channel: 'chromium'`), no el headless shell.
const inseguro = BASE.startsWith('http://');
if (inseguro) flags.push(`--unsafely-treat-insecure-origin-as-secure=${new URL(BASE).origin}`);
const browser = await chromium.launch({ args: flags, ...(inseguro ? { channel: 'chromium' } : {}) });
const contexto = await browser.newContext({ locale: 'es-BO', viewport: { width: 390, height: 844 }, permissions: ['camera'] });
const page = await contexto.newPage();
const llamadas = [];
const cuerpos = new Map();
page.on('response', async (r) => {
  if (!r.url().includes('/api/v1')) return;
  // En DEV la API cuelga de `/app/api/v1` (Funnel); en TEST, de `/api/v1`: lo que importa es lo que sigue.
  const ruta = new URL(r.url()).pathname.replace(/^.*\/api\/v1/, '');
  llamadas.push(`${r.request().method()} ${ruta} ${r.status()}`);
  if (ruta === '/customer-onboarding/start' || ruta.startsWith('/telemetry') || ruta.includes('/telemetry/batch')) {
    try {
      cuerpos.set(`${r.request().method()} ${ruta}`, await r.json());
    } catch {
      /* sin json */
    }
  }
});
const errores = [];
page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 200)));
// Los errores de consola y las peticiones que no llegaron también cuentan: un `fetch` a un origen
// inalcanzable no es «error de página» y sin esto el informe diría «sin errores» con el alta rota.
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(`consola: ${m.text().slice(0, 200)}`);
});
page.on('requestfailed', (r) => errores.push(`sin respuesta: ${r.method()} ${r.url().slice(0, 120)} (${r.failure()?.errorText ?? '?'})`));
const HASTA = Number(args.get('hasta') ?? 0); // depuración: parar tras N pasos

let n = 0;
let desdeElPaso = 0;
async function paso(nombre, fn) {
  n += 1;
  const desde = llamadas.length;
  desdeElPaso = desde;
  let estado = 'ok';
  let detalle = '';
  try {
    detalle = (await fn()) ?? '';
  } catch (e) {
    estado = 'FALLO';
    detalle = String(e.message ?? e).split('\n')[0].slice(0, 240);
  }
  const archivo = `${String(n).padStart(2, '0')}-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: join(SALIDA, archivo), fullPage: true }).catch(() => undefined);
  const red = [...new Set(llamadas.slice(desde))];
  informe.push({ n, nombre, estado, detalle, red, archivo });
  console.log(`${estado === 'ok' ? '✓' : '✗'} ${nombre} ${detalle} ${red.length ? `[${red.join(' · ')}]` : ''}`);
  if (HASTA && n >= HASTA) {
    console.log(errores.length ? `errores: ${errores.join(' · ')}` : 'sin errores');
    await browser.close();
    process.exit(estado === 'ok' ? 0 : 1);
  }
  return estado === 'ok';
}

const texto = (t) => page.getByText(t, { exact: false }).first();
const caja = (nombre) => page.getByRole('textbox', { name: nombre }).first();
const boton = (nombre) => page.getByRole('button', { name: nombre });
const esperarLlamada = async (prefijo, ms = 30_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    // Sólo llamadas de ESTE paso: `POST /customer-onboarding/` casaría con el `start` de dos pasos atrás.
    const l = llamadas.slice(desdeElPaso).find((x) => x.startsWith(prefijo));
    if (l) return l;
    await page.waitForTimeout(250);
  }
  throw new Error(`no salió ${prefijo}`);
};
/** Elige una opción en un SelectField: abre la hoja y toca la opción. */
async function elegir(etiquetaCampo, opcion) {
  await boton(new RegExp(`^${etiquetaCampo}`)).first().click();
  await page.waitForTimeout(400);
  const radio = page.getByRole('radio', { name: new RegExp(`^${opcion}`) }).first();
  if (await radio.count()) await radio.click();
  else await page.getByText(opcion, { exact: true }).last().click();
  await page.waitForTimeout(300);
}
const correo = `fases.${Date.now()}@atlas.test`;
const telefono = `7${String(Date.now()).slice(-7)}`;
let customerId = null;

/* ---- fase 1 · contacto ---- */
await paso('bienvenida → crear mi cuenta (arranca el cronómetro)', async () => {
  await page.goto(`${BASE}/bienvenida`, { waitUntil: 'load' });
  await page.waitForTimeout(4500);
  await texto('Ya tengo cuenta').waitFor({ timeout: 20000 });
  for (let i = 0; i < 3; i += 1) {
    const sig = boton('Siguiente').first();
    if (await sig.count()) {
      await sig.click();
      await page.waitForTimeout(400);
    }
  }
  await boton('Crear mi cuenta').first().click();
  await texto('Crear cuenta').waitFor({ timeout: 15000 });
  const nombre = page.getByRole('textbox', { name: 'Nombre' });
  if (await nombre.count()) throw new Error('el registro sigue pidiendo el nombre: la fase 1 no debe pedirlo');
});
await paso('registro: teléfono, correo y PIN (con correcciones reales)', async () => {
  await caja('Teléfono').fill(`${telefono}9`);
  await caja('Teléfono').press('Backspace');
  await caja('Correo electrónico').fill(correo);
  await caja('Tu PIN').fill('8407');
  const casillas = page.getByRole('checkbox');
  const total = await casillas.count();
  for (let i = 0; i < total; i += 1) if (!(await casillas.nth(i).isChecked())) await casillas.nth(i).click();
  return `${correo} · ${telefono} · ${total} autorizaciones`;
});
await paso('crear la cuenta → sesión y primer lote de bitácora', async () => {
  const crear = boton('Crear mi cuenta').last();
  await crear.click();
  const inicio = await esperarLlamada('POST /customer-onboarding/start', 40_000).catch(async (e) => {
    // El botón bloqueado dice por qué (`blockedReason`): que el informe lo cuente en vez de «no salió».
    const motivo = await page.getByText(/Falta |Estamos cargando|inválid|válido/).first().textContent({ timeout: 1000 }).catch(() => null);
    throw new Error(`${e.message}${motivo ? ` — la pantalla dice: «${motivo.trim()}»` : ''} (aria-disabled=${await crear.getAttribute('aria-disabled')})`);
  });
  if (!/ 20\d$/.test(inicio)) throw new Error(`alta rechazada: ${inicio}`);
  customerId = String(cuerpos.get('POST /customer-onboarding/start')?.customerId ?? cuerpos.get('POST /customer-onboarding/start')?.data?.customerId ?? '');
  if (!customerId) {
    const filas = sql(`select customer_id from customer.customer_contact_methods where contact_type='email' and email_domain='atlas.test' order by _id desc limit 1`);
    customerId = filas;
  }
  if (!customerId) throw new Error('sin customerId');
  await esperarLlamada('POST /customers/', 40_000);
  const lote = await esperarLlamada(`POST /customers/${customerId}/telemetry/batch`, 40_000);
  return `cliente ${customerId} · ${lote}`;
});
await paso('el código sale SOLO al llegar, y se verifica con el real', async () => {
  await page.getByText(/Verifica tu teléfono|Ahora tu correo/).first().waitFor({ timeout: 20000 });
  /*
    AQUÍ NO SE PULSA NADA, y es el punto del paso.

    Hasta el 2026-09-21 esta prueba tocaba «Enviarme el código» y por eso pasaba en verde mientras
    la app real dejaba a todo el mundo esperando un mensaje que nunca se había pedido: la prueba
    hacía por su cuenta lo único que faltaba. Si alguien devuelve el envío a un botón, esta espera
    se queda sin la llamada y el paso falla, que es lo que tenía que haber pasado entonces.
  */
  const pedido = await esperarLlamada('POST /customer-onboarding/', 40_000);
  if (!pedido.includes('contact-verification/request') || !/ 20\d$/.test(pedido)) throw new Error(`el código no se pidió solo: ${pedido}`);
  const codigo = await codigoDeVerificacion(customerId);
  await caja('Código recibido').fill(codigo);
  await boton('Confirmar código').first().click();
  const enviado = await esperarLlamada('POST /customer-onboarding/' + customerId + '/contact-verification/submit', 40_000);
  if (!/ 20\d$/.test(enviado)) throw new Error(`código rechazado: ${enviado}`);
  await page.waitForTimeout(1500);
  // Segunda ronda (correo): también se dispara sola al cambiar de ronda, con su propio código.
  if (await page.getByText('Ahora tu correo').count()) {
    await page.getByText('Código enviado').first().waitFor({ timeout: 40000 });
    const codigo2 = await codigoDeVerificacion(customerId);
    await caja('Código recibido').fill(codigo2);
    await boton('Confirmar código').first().click();
    await page.waitForTimeout(2500);
    return `código ${codigo} y correo ${codigo2}, los dos sin tocar ningún botón de envío`;
  }
  return `código ${codigo}, sin tocar ningún botón de envío`;
});

/* ---- fase 2 · identidad ---- */
await paso('progreso → el siguiente paso es el carnet (antes que los datos)', async () => {
  await page.goto(`${BASE}/progreso`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const continuar = boton(/^Continuar: /).first();
  await continuar.waitFor({ timeout: 20000 });
  const rotulo = await continuar.textContent();
  if (!/documento/i.test(rotulo ?? '')) throw new Error(`el siguiente paso no es el carnet: ${rotulo}`);
  await continuar.click();
  await texto('Anverso del carnet').waitFor({ timeout: 20000 });
});
await paso('carnet: tres capturas con la cámara falsa y datos del documento', async () => {
  // El carrusel pinta UN solo botón de acción, el de la lámina activa; el pie dice cuál es.
  const laminas = ['Anverso del carnet', 'Reverso del carnet', 'Selfie'];
  for (let i = 0; i < laminas.length; i += 1) {
    await page.getByText(laminas[i], { exact: true }).first().waitFor({ timeout: 15000 });
    await boton('Tomar foto').first().click(); // abre la cámara de esa lámina
    await boton('Cancelar').first().waitFor({ timeout: 15000 }); // el visor está abierto
    // Cada apertura de la cámara reinicia el vídeo falso en el cuadro 0: con el mismo retraso, dos
    // capturas salen IGUALES (mismo SHA-256 → 409 por `ux_evidence_documents_customer_hash`).
    // El disparo se escalona por lámina para caer en cuadros distintos del marcador móvil.
    await page.waitForTimeout(1200 + i * 1500);
    await boton('Tomar foto').first().click(); // el disparador
    // Vuelve al carrusel con la foto subida: la acción pasa a «Repetir».
    // Subida la foto, el contador del carrusel sube («Tus capturas (N de 3)») y la app pasa SOLA a
    // la siguiente lámina pendiente: ya no se queda en esta con «Repetir».
    await page.getByText(`Tus capturas (${i + 1} de 3)`).first().waitFor({ timeout: 90000 });
    if (i < laminas.length - 1) {
      // «Siguiente» desplaza el carrusel; en la web el primer toque tras subir la foto a veces se
      // pierde con el repintado (medido en DEV): se insiste hasta que el pie muestra la siguiente.
      const siguiente = page.getByText(laminas[i + 1], { exact: true }).first();
      for (let intento = 0; intento < 5 && !(await siguiente.isVisible()); intento += 1) {
        await boton('Siguiente').first().click();
        await page.waitForTimeout(900);
      }
    }
  }
  await caja('Número de carnet').fill('1234567');
  const fecha = page.locator('input[type="date"]').first();
  if (await fecha.count()) await fecha.fill('2031-06-23');
  else {
    await boton(/Fecha de vencimiento/).first().click();
    await boton('Listo').first().click();
  }
  await boton('Enviar documento').first().click();
  const paquete = await esperarLlamada(`POST /customer-onboarding/${customerId}/identity-package`, 60_000);
  if (!/ 20\d$/.test(paquete)) throw new Error(`paquete rechazado: ${paquete}`);
  const motor = await esperarLlamada('POST /mobile/identity-verifications', 60_000);
  return `${paquete} · ${motor}`;
});
await paso('verificación: esperar el veredicto del Motor y seguir', async () => {
  await page.waitForTimeout(3000);
  for (let i = 0; i < 40; i += 1) {
    if (await boton(/Seguir con el registro|Continuar|Confirmar mis datos/).first().count()) break;
    await page.waitForTimeout(3000);
  }
  const seguir = boton('Seguir con el registro').first();
  if (await seguir.count()) await seguir.click();
  else await page.goto(`${BASE}/perfil`, { waitUntil: 'load' });
  // La pantalla de datos: el campo «Nombre» es inequívoco (el título cambia según haya OCR o no).
  await caja('Nombre').waitFor({ timeout: 40000 });
  const estado = SSH ? sql(`select coalesce(final_result,'PENDING')||' '||coalesce(reason_codes_json->>'reason','') from customer.identity_verification_attempts where customer_id=${customerId} order by _id desc limit 1`) : '';
  if (SSH && !estado) throw new Error('el Motor no recibió ningún intento de identidad de este cliente');
  return estado;
});
await paso('confirmar datos: nombre, apellido y nacimiento', async () => {
  await caja('Nombre').fill('Maria Renee');
  await caja('Apellido').fill('Rodriguez Gonzalez');
  const fecha = page.locator('input[type="date"]').first();
  if (await fecha.count()) await fecha.fill('1995-04-12');
  else {
    await boton(/Fecha de nacimiento/).first().click();
    await boton('Listo').first().click();
  }
  await boton('Confirmar mis datos').first().click();
  const perfil = await esperarLlamada(`PATCH /customer-onboarding/${customerId}/profile`, 40_000);
  if (!/ 20\d$/.test(perfil)) throw new Error(`perfil rechazado: ${perfil}`);
});

/* ---- fase 3 · situación ---- */
await paso('domicilio', async () => {
  await page.goto(`${BASE}/domicilio`, { waitUntil: 'load' });
  await texto('Tu domicilio').waitFor({ timeout: 20000 });
  await elegir('Departamento', 'Santa Cruz');
  await elegir('Ciudad', 'Santa Cruz de la Sierra');
  await caja(/Calle y número/).fill('Av. San Martín 123');
  await boton('Guardar domicilio').first().click();
  const r = await esperarLlamada(`POST /customer-onboarding/${customerId}/address-package`, 40_000);
  if (!/ 20\d$/.test(r)) throw new Error(`domicilio rechazado: ${r}`);
});
await paso('economía', async () => {
  await page.goto(`${BASE}/economia`, { waitUntil: 'load' });
  await texto('Tu situación económica').waitFor({ timeout: 20000 });
  await elegir('Situación laboral', 'Trabajo por mi cuenta');
  await caja(/Años en tu trabajo actual/).fill('3');
  // El ingreso se pide por banda (no por monto) y con su frecuencia de cobro.
  await elegir('Rango de ingreso mensual', 'Bs 3.000 a 5.000');
  await elegir('¿Cada cuánto cobras\\?', 'Mensual');
  await caja(/Gastos mensuales/).fill('2100');
  // La hoja buscable: cada opción es un botón cuyo nombre accesible es «Etiqueta. Detalle».
  await boton(/^Actividad económica/).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Comercio y ventas/ }).first().click();
  await page.waitForTimeout(300);
  await elegir('Origen principal de tus ingresos', 'Mi negocio');
  await boton('Guardar').first().click();
  const r = await esperarLlamada(`PUT /customer-onboarding/${customerId}/financial-profile`, 40_000);
  if (!/ 20\d$/.test(r)) throw new Error(`economía rechazada: ${r}`);
});
await paso('referencias', async () => {
  await page.goto(`${BASE}/referencias`, { waitUntil: 'load' });
  await texto('Tus referencias').waitFor({ timeout: 20000 });
  const nombres = page.getByRole('textbox', { name: 'Nombre completo' });
  const telefonos = page.getByRole('textbox', { name: 'Teléfono' });
  if ((await nombres.count()) < 2) await boton('Agregar otra referencia').first().click();
  for (let i = 0; i < 2; i += 1) {
    await nombres.nth(i).fill(i === 0 ? 'Juan Perez' : 'Ana Lopez');
    await telefonos.nth(i).fill(i === 0 ? '70011223' : '70022334');
    const relacion = page.getByRole('button', { name: /^Qué relación tienen/ }).nth(i);
    if (await relacion.count()) {
      await relacion.click();
      await page.waitForTimeout(300);
      const op = page.getByRole('radio').first();
      if (await op.count()) await op.click();
      else await page.getByText(/Familiar|Amigo/).last().click();
    }
    const aviso = page.getByRole('checkbox', { name: /Le avisé/ }).nth(i);
    if (await aviso.count()) await aviso.click();
  }
  await boton('Guardar referencias').first().click();
  const r = await esperarLlamada(`POST /customer-onboarding/${customerId}/reference-contacts`, 40_000);
  if (!/ 20\d$/.test(r)) throw new Error(`referencias rechazadas: ${r}`);
});
await paso('permisos del teléfono: «ahora no» cierra la sección', async () => {
  await page.goto(`${BASE}/permisos`, { waitUntil: 'load' });
  await texto('Ahora no').waitFor({ timeout: 20000 });
  await boton('Ahora no').first().click();
  await page.waitForTimeout(3000);
  const decision = await esperarLlamada(`POST /customers/${customerId}/privacy/consent-decisions`, 40_000);
  if (!/ 20\d$/.test(decision)) throw new Error(`«ahora no» no quedó registrado: ${decision}`);
  return decision;
});

/* ---- fase 4 · hábitos ---- */
await paso('hábitos: seis preguntas, una por pantalla', async () => {
  await page.goto(`${BASE}/habitos`, { waitUntil: 'load' });
  await texto('Tus hábitos').waitFor({ timeout: 20000 });
  // La primera pregunta del catálogo habitos-v1 (gasto fijo) con sus opciones ya pintadas.
  await boton(/cuarta parte/).first().waitFor({ timeout: 20000 });
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(1800); // leer la pregunta: menos de 1,5 s se anota como «sin leer»
    const monto = page.getByRole('textbox', { name: /Cuota mensual/ });
    if (await monto.count()) {
      await monto.fill('350');
      await boton(/Siguiente|Terminar/).first().click();
    } else {
      const opciones = page.getByRole('button').filter({ hasNotText: /Anterior|Volver|Atrás/ });
      // La primera opción de respuesta es el primer botón secundario después de la pregunta.
      const candidatos = await opciones.allTextContents();
      const indice = candidatos.findIndex((t) => t && !/Anterior|Volver|Atrás|Ayuda|Cerrar/.test(t));
      await opciones.nth(Math.max(0, indice)).click();
    }
    await page.waitForTimeout(1500);
  }
  const guardadas = llamadas.filter((l) => l.startsWith(`PUT /customer-onboarding/${customerId}/consumer-survey`) && / 20\d$/.test(l)).length;
  if (guardadas < 6) throw new Error(`solo ${guardadas} respuestas guardadas`);
  return `${guardadas} respuestas`;
});

/* ---- último paso: el extracto, dentro del alta y sin rebotar a «progreso» ---- */
await paso('extracto bancario: último paso del alta, se puede dejar para después', async () => {
  await page.goto(`${BASE}/extracto`, { waitUntil: 'load' });
  await texto('Tu extracto bancario').waitFor({ timeout: 20000 });
  if (!page.url().includes('/extracto')) throw new Error(`rebotó a ${page.url()}`);
  await boton('Lo subo después').first().click();
  await page.waitForURL(/\/revision/, { timeout: 20000 });
});

/* ---- cierre ---- */
await paso('enviar la solicitud', async () => {
  await page.goto(`${BASE}/revision`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const enviar = boton('Enviar mi solicitud').first();
  await enviar.waitFor({ timeout: 20000 });
  await enviar.click();
  const r = await esperarLlamada(`POST /customer-onboarding/${customerId}/submit`, 60_000);
  if (!/ 20\d$/.test(r)) throw new Error(`envío rechazado: ${r}`);
  await page.waitForTimeout(2500);
  return r;
});

/* ---- lo que quedó en la base ---- */
if (SSH && customerId) {
  const q = (s) => sql(s);
  const flow = q(`select _id from telemetry.onboarding_flows where customer_id=${customerId} order by _id desc limit 1`);
  const comprobaciones = [
    ['eventos de campo', q(`select count(*) from telemetry.form_field_interaction_events where onboarding_flow_id=${flow || 0}`), (v) => Number(v) >= 8],
    ['pantallas con tiempo', q(`select count(*) from telemetry.onboarding_step_events where onboarding_flow_id=${flow || 0} and event_type='leave' and (payload_json->>'sinceEnterMs')::numeric > 0`), (v) => Number(v) >= 5],
    ['toques con posición 0-1', q(`select count(*) from telemetry.customer_action_logs where customer_id=${customerId} and event_name='tap' and (action_payload_json->>'rx')::numeric between 0 and 1`), (v) => Number(v) >= 5],
    ['ningún valor tecleado', q(`select count(*) from telemetry.form_field_interaction_events e where onboarding_flow_id=${flow || 0} and (e.field_code ilike '%${telefono}%' or e.field_code ilike '%atlas.test%')`), (v) => Number(v) === 0],
    ['correcciones anotadas', q(`select coalesce(sum(correction_count),0) from telemetry.form_field_interaction_events where onboarding_flow_id=${flow || 0}`), (v) => Number(v) >= 1],
    ['resumen calculado (identidad + envío)', q(`select count(*) from telemetry.onboarding_behavior_summaries where customer_id=${customerId} and computation_version='behavior-summary-v1' and completion_time_seconds is not null`), (v) => Number(v) >= 2],
    ['cronómetro ≈ tiempo de pared', q(`select completion_time_seconds from telemetry.onboarding_behavior_summaries where customer_id=${customerId} and completion_time_seconds is not null order by _id desc limit 1`), (v) => Math.abs(Number(v) - (Date.now() - inicioDelAlta) / 1000) <= 90],
    ['identidad con resumen enlazado', q(`select coalesce(reason_codes_json->>'behaviorSummaryId','') from customer.identity_verification_attempts where customer_id=${customerId} order by _id desc limit 1`), (v) => v !== '' && v !== 'null'],
    ['seis respuestas de hábitos', q(`select count(*) from customer.customer_consumer_survey_answers where customer_id=${customerId} and survey_version='habitos-v1'`), (v) => Number(v) === 6],
    ['tiempos por respuesta > 0', q(`select min(answered_in_ms) from customer.customer_consumer_survey_answers where customer_id=${customerId}`), (v) => Number(v) > 0],
    ['permisos decididos (ambos)', q(`select count(distinct purpose_code) from privacy.customer_consents where customer_id=${customerId} and purpose_code in ('device_address_book','location_tracking')`), (v) => Number(v) === 2],
    ['solicitud enviada', q(`select lifecycle_status from customer.customers where _id=${customerId}`), (v) => v === 'under_review' || v === 'active'],
  ];
  console.log('\n— en la base —');
  for (const [nombre, valor, ok] of comprobaciones) {
    const bien = ok(valor);
    informe.push({ n: ++n, nombre: `base: ${nombre}`, estado: bien ? 'ok' : 'FALLO', detalle: String(valor), red: [], archivo: '' });
    console.log(`${bien ? '✓' : '✗'} ${nombre}: ${valor}`);
  }
  const ejecucion = sql(`select e.id||' '||e.decision_status||' '||coalesce(e.business_outcome,'')||' '||e.executed_at from decision_execution e order by e.id desc limit 1`, 'atlas_decision');
  console.log(`  última ejecución del Motor: ${ejecucion || '(sin acceso)'}`);
}

const fallos = informe.filter((p) => p.estado !== 'ok');
const lineas = [
  `# Alta por fases en ${BASE} · ${new Date().toISOString()}`,
  `Cliente: ${customerId ?? '?'} · correo ${correo} · teléfono ${telefono}`,
  '',
  '| # | paso | estado | detalle | red |',
  '|---|---|---|---|---|',
  ...informe.map((p) => `| ${p.n} | ${p.nombre} | ${p.estado} | ${p.detalle.replace(/\|/g, '/')} | ${p.red.join('<br>')} |`),
  '',
  errores.length ? `Errores de página: ${errores.join(' · ')}` : 'Sin errores de página.',
];
writeFileSync(join(SALIDA, 'informe.md'), lineas.join('\n'));
await browser.close();
console.log(`\n${fallos.length === 0 ? 'TODO EN VERDE' : `${fallos.length} FALLO(S)`} · informe en ${join(SALIDA, 'informe.md')}`);
process.exit(fallos.length === 0 ? 0 : 1);
