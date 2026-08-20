/**
 * Resuelve las DOS decisiones de operaciones que habilitan a un cliente para pedir credito.
 *
 * ## Por que existe
 *
 * Un cliente que termina el registro en la app queda `under_review`, no elegible. Faltan dos
 * decisiones que **no son suyas**: las toma un operador desde el back-office, y son deliberadamente
 * humanas —elegibilidad e identidad—. Sin ellas la app se comporta como debe: deja pedir credito y
 * el dominio lo rechaza.
 *
 * Hasta ahora esas dos llamadas solo existian enterradas al final de `provision-demo-customer.mjs`,
 * que ademas crea el cliente entero. Cuando el registro se hace **desde la app** —que es como se
 * demuestra el producto— no habia forma de completar solo el tramo del operador sin volver a crear
 * un cliente desde cero.
 *
 * No es un atajo: pega contra los mismos endpoints que usa el portal de operaciones, autenticado
 * como el usuario interno. Lo unico que ahorra es abrir el portal.
 *
 * Uso:
 *   ATLAS_ADMIN_PASSWORD='...' node tools/dev-backend/approve-customer.mjs --customerId 23
 *
 * Variables: ATLAS_API (por defecto http://localhost:3105/api/v1), ATLAS_ADMIN_EMAIL
 * (pablo@atlas.internal). Solo para desarrollo local.
 */
const API = process.env.ATLAS_API ?? 'http://localhost:3105/api/v1';
const ADMIN_EMAIL = process.env.ATLAS_ADMIN_EMAIL ?? 'pablo@atlas.internal';
const ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD ?? '';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const CUSTOMER_ID = args.get('customerId');
const REASON = args.get('reasonCode') ?? 'dev_demo_provisioning';

if (!CUSTOMER_ID || !ADMIN_PASSWORD) {
  console.error('Faltan --customerId o la variable ATLAS_ADMIN_PASSWORD.');
  process.exit(1);
}

async function call(method, path, { body, token } = {}) {
  const headers = { 'content-type': 'application/json', 'x-tenant-id': '1' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  return { status: response.status, body: parsed.data ?? parsed };
}

/** Corta al primer paso que falla: seguir dejaria el expediente a medias y sin avisar. */
function must(label, result) {
  const ok = result.status >= 200 && result.status < 300;
  console.log(`  ${ok ? 'ok  ' : 'FALLO'} ${label} [${result.status}]`);
  if (!ok) {
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
  return result.body;
}

const admin = must(
  'login del admin interno',
  await call('POST', '/auth/login', {
    body: { actorType: 'internal_user', identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  }),
);

must(
  'decision de elegibilidad',
  await call('POST', `/operations/customers/${CUSTOMER_ID}/eligibility/decision`, {
    body: { decision: 'approve', reasonCode: REASON, notes: 'Revision de operaciones.' },
    token: admin.accessToken,
  }),
);

must(
  'decision de verificacion de identidad',
  await call('POST', `/operations/customers/${CUSTOMER_ID}/identity-verification/decision`, {
    body: { decision: 'approve', reasonCode: REASON },
    token: admin.accessToken,
  }),
);

console.log(`\nCliente ${CUSTOMER_ID} habilitado. Ya puede pedir credito desde la app.`);
