/**
 * Recorre el PORTAL DEL COMERCIO como lo recorre su duenio: entra, mira lo que espera su respuesta
 * y decide. Es la contraparte de `provision-demo-merchant.mjs`, y sirve para comprobar de punta a
 * punta que una compra hecha en la app aparece del otro lado del mostrador.
 *
 * Uso:
 *   node tools/dev-backend/merchant-portal-check.mjs --email ... --password ... --partnerId 6
 *   node tools/dev-backend/merchant-portal-check.mjs ... --accept 18
 */
const API = process.env.ATLAS_API ?? 'http://localhost:3105/api/v1';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);

const EMAIL = args.get('email');
const PASSWORD = args.get('password');
const PARTNER_ID = args.get('partnerId');
const ACCEPT = args.get('accept');
const REJECT = args.get('reject');

if (!EMAIL || !PASSWORD || !PARTNER_ID) {
  console.error('Faltan --email, --password o --partnerId.');
  process.exit(1);
}

const cookieJar = new Map();

async function call(method, path, body) {
  const headers = { 'content-type': 'application/json', 'x-tenant-id': '1' };
  if (cookieJar.size > 0) headers.cookie = [...cookieJar.entries()].map(([k, v]) => k + '=' + v).join('; ');
  const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookieJar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed.data ?? parsed };
}

function must(label, result) {
  if (result.status >= 400) {
    console.error('\nFallo en: ' + label + ' (HTTP ' + result.status + ')');
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
  return result.body;
}

must('login del comercio', await call('POST', '/merchant/auth/login', { email: EMAIL, password: PASSWORD }));
console.log('Sesion del comercio abierta: ' + EMAIL + '\n');

if (ACCEPT || REJECT) {
  const applicationId = ACCEPT ?? REJECT;
  const body = ACCEPT ? { accepted: true } : { accepted: false, reasonCode: 'CUPO_AGOTADO' };
  const decided = must(
    'decision del comercio',
    await call('POST', '/merchant/partners/' + PARTNER_ID + '/credit-applications/' + applicationId + '/acceptance', body),
  );
  console.log('Decision registrada:');
  console.log('  solicitud   ' + decided.applicationId);
  console.log('  aceptacion  ' + decided.businessAcceptance);
  console.log('  estado      ' + decided.status + '\n');
}

const pending = must('pendientes del comercio', await call('GET', '/merchant/partners/' + PARTNER_ID + '/credit-applications'));
console.log('Esperando respuesta del comercio: ' + pending.applications.length);
for (const application of pending.applications) {
  console.log(
    '  #' + application.applicationId +
      '  ' + application.requestedAmount + ' ' + application.currencyCode +
      '  ' + application.requestedTermMonths + ' meses' +
      '  motor=' + application.status +
      '  aceptacion=' + application.businessAcceptance,
  );
}

const all = must('historial del comercio', await call('GET', '/merchant/partners/' + PARTNER_ID + '/credit-applications?onlyPending=false'));
console.log('\nTotal atribuido a este comercio: ' + all.applications.length);
