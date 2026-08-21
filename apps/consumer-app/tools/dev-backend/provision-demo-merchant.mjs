/**
 * Deja un COMERCIO demo verificado y con su QR de caja operativo, recorriendo la API real.
 *
 * Contraparte de `provision-demo-customer.mjs`, y existe por lo mismo: un comercio verificado no es
 * una columna que se pueda poner a mano. Es un expediente completo —contacto probado por correo,
 * matricula, representante legal, sucursal, QR del negocio y QR bancario subidos al almacenamiento,
 * terminal activado— y una decision de operaciones que lo aprueba. Un seeder que escribiera
 * `onboarding_status = 'approved'` produciria un comercio que el QR resuelve y el expediente no
 * respalda, que es peor que no tener ninguno.
 *
 * Uso:
 *   ATLAS_ADMIN_PASSWORD='...' node tools/dev-backend/provision-demo-merchant.mjs \
 *     --email cpacentropreaparacionacademica@gmail.com --password '...'
 *
 * Variables: ATLAS_API (http://localhost:3105/api/v1), ATLAS_OTP_SINK (http://localhost:4599/last),
 * ATLAS_ADMIN_EMAIL, ATLAS_ADMIN_PASSWORD. Solo para desarrollo local.
 */
const API = process.env.ATLAS_API ?? 'http://localhost:3105/api/v1';
const OTP_SINK = process.env.ATLAS_OTP_SINK ?? 'http://localhost:4599/last';
const ADMIN_EMAIL = process.env.ATLAS_ADMIN_EMAIL ?? 'pablo@atlas.internal';
const ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD ?? '';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);

const EMAIL = args.get('email');
const PASSWORD = args.get('password');
const LEGAL_NAME = args.get('legalName') ?? 'Centro de Preparacion Academica CPA S.R.L.';
const TRADE_NAME = args.get('tradeName') ?? 'CPA Centro de Preparacion Academica';
const CATEGORY = args.get('category') ?? 'educacion';
const TAX_ID = args.get('taxId') ?? String(Math.floor(1000000 + Math.random() * 8999999));
const TERMINAL = args.get('terminal') ?? 'CPA-POS-' + Math.floor(1000 + Math.random() * 8999);

if (!EMAIL || !PASSWORD || (!ADMIN_PASSWORD && !process.env.ATLAS_ADMIN_TOKEN)) {
  console.error('Faltan --email, --password o ATLAS_ADMIN_PASSWORD / ATLAS_ADMIN_TOKEN.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * El canal del comercio responde `tokenType: "Cookie"`: la sesion viaja en cookies HttpOnly, no en
 * un Bearer. Un tarro de galletas minimo es lo que permite recorrer el portal como lo recorre un
 * navegador; el canal interno sigue usando su token.
 */
const cookieJar = new Map();

function jarHeader() {
  return [...cookieJar.entries()].map(([name, value]) => name + '=' + value).join('; ');
}

async function call(method, path, options = {}) {
  const headers = { 'content-type': 'application/json', 'x-tenant-id': '1' };
  if (options.token) headers.authorization = 'Bearer ' + options.token;
  if (options.cookies && cookieJar.size > 0) headers.cookie = jarHeader();
  if (options.idempotencyKey) headers['x-idempotency-key'] = options.idempotencyKey;
  const response = await fetch(API + path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
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

function must(label, result, options = {}) {
  const allow = options.allow ?? [];
  if (result.status >= 400 && !allow.includes(result.status)) {
    console.error('\nFallo en: ' + label + ' (HTTP ' + result.status + ')');
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
  console.log('  ok  ' + label);
  return result.body;
}

/** El codigo que el backend acaba de emitir, leido del sumidero tal cual salio. */
async function readCode(since) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(OTP_SINK).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    const code = payload && (payload.code ?? payload.otp ?? (payload.body && payload.body.code));
    const at = payload && (payload.receivedAt ?? payload.at ?? null);
    if (code && (!since || !at || new Date(at).getTime() >= since - 2000)) return String(code);
    await sleep(400);
  }
  console.error('No llego ningun codigo al sumidero.');
  process.exit(1);
}

/**
 * El login interno pide un PIN de un solo uso desde que se endurecio el acceso de operaciones.
 * Se resuelve leyendo el codigo del sumidero, igual que hace una persona con su correo.
 */
async function loginInternal() {
  /*
   * Atajo deliberado para desarrollo: el segundo factor del login interno entrega el PIN por correo
   * REAL (`NOTIFICATION_EMAIL_PROVIDER=gmail_api`), asi que en local no hay bandeja que leer. Con
   * `ATLAS_ADMIN_TOKEN` se usa un token firmado por `scripts/create-dev-jwt.ts`. No es un rodeo de
   * la autorizacion: el token lleva el mismo rol y el mismo usuario interno, y los permisos se
   * siguen resolviendo contra la base.
   */
  if (process.env.ATLAS_ADMIN_TOKEN) {
    console.log('  ok  token de admin provisto por el entorno');
    return process.env.ATLAS_ADMIN_TOKEN;
  }

  const started = Date.now();
  const first = must(
    'login del admin interno',
    await call('POST', '/auth/login', {
      body: { actorType: 'internal_user', identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  );
  if (first.accessToken) return first.accessToken;

  const code = await readCode(started);
  const second = must(
    'PIN del admin interno',
    await call('POST', '/auth/login/pin', { body: { challengeToken: first.challengeToken, code } }),
  );
  return second.accessToken;
}

/** Una imagen PNG minima y valida: el registro del QR MIRA el objeto antes de aceptarlo. */
function pngBytes() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQAAAADrRVxmAAAAEklEQVR4AWMAgv9QzMDAwMAAAAyGAgEZ7WRVAAAAAElFTkSuQmCC',
    'base64',
  );
}

async function uploadQr(token, partnerId, qrKind) {
  const bytes = pngBytes();
  const ticket = must(
    'permiso de subida del QR ' + qrKind,
    await call('POST', '/partner-onboarding/' + partnerId + '/qr-codes/upload-url', {
      body: { qrKind, contentType: 'image/png', sizeBytes: bytes.length },
      cookies: true,
    }),
  );

  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.requiredHeaders, body: bytes });
  if (!put.ok) {
    console.error('\nFallo subiendo el QR ' + qrKind + ' al almacenamiento (HTTP ' + put.status + ').');
    console.error(await put.text());
    process.exit(1);
  }
  console.log('  ok  objeto del QR ' + qrKind + ' subido');
  return ticket.storageKey;
}

console.log('\nAprovisionando comercio ' + TRADE_NAME + ' (' + EMAIL + ')\n');

const adminToken = await loginInternal();

// 1. La identidad del usuario de comercio. La crea operaciones, no el propio comercio.
const created = await call('POST', '/merchant/users', {
  body: { email: EMAIL, fullName: 'Responsable CPA', password: PASSWORD },
  token: adminToken,
});
if (created.status === 409) console.log('  ok  identidad de comercio ya existente, se reutiliza');
else must('alta de la identidad de comercio', created);

// Nace `invited`: hasta activarla no hay portal al que entrar.
const merchantUserId = created.body && (created.body.merchantUserId ?? created.body.id);
if (merchantUserId) {
  await call('PATCH', '/merchant/users/' + merchantUserId + '/status', {
    body: { status: 'active', reason: 'Alta de comercio para la demostracion local.' },
    token: adminToken,
  });
  console.log('  ok  identidad de comercio activa');
}

const merchantSession = must(
  'login del comercio',
  await call('POST', '/merchant/auth/login', { body: { email: EMAIL, password: PASSWORD }, cookies: true }),
);
const merchantToken = merchantSession.accessToken ?? null;
if (!merchantToken) console.log('      sesion del comercio por cookie');

// 2. El expediente. Quien lo abre queda como dueno: de ahi cuelga toda la comprobacion de propiedad.
const startedAt = Date.now();
const profile = must(
  'apertura del expediente',
  await call('POST', '/partner-onboarding/start', {
    body: {
      legalName: LEGAL_NAME,
      tradeName: TRADE_NAME,
      taxId: TAX_ID,
      businessCategory: CATEGORY,
      contactEmail: EMAIL,
      contactPhone: '+59170000002',
    },
    cookies: true,
  }),
);
const partnerId = String(profile.partnerId ?? profile.id);
console.log('      partnerId = ' + partnerId);

// 3. El contacto declarado, probado con el codigo que emite el backend.
must(
  'solicitud del codigo de contacto',
  await call('POST', '/partner-onboarding/' + partnerId + '/contact-verification/request', { cookies: true }),
);
const contactCode = await readCode(startedAt);
must(
  'verificacion del contacto',
  await call('POST', '/partner-onboarding/' + partnerId + '/contact-verification/submit', {
    body: { code: contactCode },
    cookies: true,
  }),
);

must(
  'matricula de comercio',
  await call('POST', '/partner-onboarding/' + partnerId + '/commercial-registry', {
    body: { commercialRegistry: 'MC-' + TAX_ID },
    cookies: true,
  }),
);

/*
 * El poder notarial. AVISO HONESTO: el expediente exige la clave del objeto para poder enviarse,
 * pero NO existe endpoint que emita un permiso de subida para este documento —solo los hay para los
 * QR—. Aqui se pasa una clave bien formada bajo el prefijo del expediente; el objeto no existe y
 * nadie lo comprueba. Es un hueco real del producto, anotado en la evidencia.
 */
must(
  'representante legal',
  await call('POST', '/partner-onboarding/' + partnerId + '/legal-representative', {
    body: {
      fullName: 'Maria Elena Rojas Vargas',
      documentType: 'ci',
      documentNumber: '4821936',
      powerOfAttorneyKey: '1/partner-' + partnerId + '/power-of-attorney/pendiente-de-endpoint.pdf',
    },
    cookies: true,
  }),
);

const branch = must(
  'sucursal',
  await call('POST', '/partner-onboarding/' + partnerId + '/branches', {
    body: {
      branchCode: 'CASA-MATRIZ',
      name: 'Casa Matriz',
      addressLine: 'Av. San Martin 1234',
      city: 'Santa Cruz de la Sierra',
    },
    cookies: true,
  }),
);
const branchId = String(branch.branchId ?? branch.id);

const businessKey = await uploadQr(null, partnerId, 'business');
must(
  'registro del QR del negocio',
  await call('POST', '/partner-onboarding/' + partnerId + '/qr-codes', {
    body: { qrKind: 'business', storageKey: businessKey },
    cookies: true,
  }),
);

const bankKey = await uploadQr(null, partnerId, 'bank');
must(
  'registro del QR bancario',
  await call('POST', '/partner-onboarding/' + partnerId + '/qr-codes', {
    body: { qrKind: 'bank', storageKey: bankKey, bankInstitutionCode: 'BNB', accountNumberMasked: '****4471' },
    cookies: true,
  }),
);

// 4. El terminal. Nace `registered`: activarlo es un acto explicito, y sin eso el QR no resuelve.
const terminal = must(
  'alta del terminal de caja',
  await call('POST', '/partner-onboarding/' + partnerId + '/branches/' + branchId + '/pos-terminals', {
    body: { terminalSerial: TERMINAL, terminalAlias: 'Caja 1', provider: 'Atlas', model: 'A910' },
    cookies: true,
  }),
);
const terminalId = String(terminal.terminalId ?? terminal.id);
must(
  'activacion del terminal',
  await call('PATCH', '/partner-onboarding/' + partnerId + '/pos-terminals/' + terminalId, {
    body: { status: 'active' },
    cookies: true,
  }),
);

must('envio del expediente a revision', await call('POST', '/partner-onboarding/' + partnerId + '/submit', { cookies: true }));

// 5. La firma de una persona. Es lo unico que convierte el expediente en un comercio verificado.
const decided = must(
  'decision de operaciones',
  await call('POST', '/operations/partners/' + partnerId + '/decision', { body: { approved: true }, token: adminToken }),
);

console.log('\nComercio listo.');
console.log('  partnerId          ' + partnerId);
console.log('  estado             ' + (decided.onboardingStatus ?? 'aprobado'));
console.log('  categoria          ' + CATEGORY);
console.log('  token del QR       ' + TERMINAL);
console.log('  usuario del portal ' + EMAIL);
