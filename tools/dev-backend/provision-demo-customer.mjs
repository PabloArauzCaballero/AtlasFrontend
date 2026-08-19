/**
 * Deja un cliente DEMO habilitado para pedir credito, recorriendo la API real de AtlasBackend.
 *
 * Existe porque no hay atajo honesto: la elegibilidad no es una columna que se pueda poner a mano,
 * es el resultado de un expediente completo —contacto verificado, perfil, economia, domicilio,
 * referencias, documentos subidos al almacenamiento y dos decisiones de operaciones—. Un seeder que
 * escribiera `credit_eligibility_status = 'eligible'` directamente produciria un cliente que la
 * pantalla acepta y el dominio no, que es peor que no tener ninguno.
 *
 * Cada paso va por su endpoint real, incluido el codigo de verificacion, que se lee del sumidero
 * (`otp-sink.mjs`) tal y como lo emitio el backend.
 *
 * Uso:
 *   node tools/dev-backend/provision-demo-customer.mjs \
 *     --email a2020115468@estudiantes.upsa.edu.bo \
 *     --password '...' --phone +59170000001
 *
 * Variables: ATLAS_API (por defecto http://localhost:3105/api/v1), ATLAS_OTP_SINK
 * (http://localhost:4599/last), ATLAS_ADMIN_EMAIL y ATLAS_ADMIN_PASSWORD para las decisiones de
 * operaciones. Solo para desarrollo local.
 */
import { createHash } from 'node:crypto';

const API = process.env.ATLAS_API ?? 'http://localhost:3105/api/v1';
const OTP_SINK = process.env.ATLAS_OTP_SINK ?? 'http://localhost:4599/last';
const ADMIN_EMAIL = process.env.ATLAS_ADMIN_EMAIL ?? 'pablo@atlas.internal';
const ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD ?? '';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const EMAIL = args.get('email');
const PASSWORD = args.get('password');
const PHONE = args.get('phone');
const FIRST_NAME = args.get('firstName') ?? 'Cliente';
const LAST_NAME = args.get('lastName') ?? 'Demo';
const BIRTH_DATE = args.get('birthDate') ?? '1995-04-12';

if (!EMAIL || !PASSWORD || !PHONE) {
  console.error('Faltan --email, --password o --phone.');
  process.exit(1);
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path, { body, token, idempotencyKey } = {}) {
  const headers = { 'content-type': 'application/json', 'x-tenant-id': '1' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['x-idempotency-key'] = idempotencyKey;
  const response = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  return { status: response.status, body: parsed.data ?? parsed };
}

/** Aborta al primer paso que no sale bien: seguir dejaria un expediente a medias sin avisar. */
function must(name, result) {
  const ok = result.status >= 200 && result.status < 300;
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${name} [${result.status}]`);
  if (!ok) {
    console.error(JSON.stringify(result.body, null, 2).slice(0, 600));
    process.exit(1);
  }
  return result.body;
}

/**
 * El codigo NO se inventa: se espera a que el backend lo entregue al sumidero.
 *
 * Se compara contra la marca de tiempo previa a pedirlo, porque el sumidero conserva el ultimo
 * mensaje: sin esa comparacion se leeria el codigo de una ejecucion anterior y el `submit` fallaria
 * con un error que no explica nada.
 */
async function readVerificationCode(requestedAfter) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(OTP_SINK);
      const payload = await response.json();
      if (payload && new Date(payload.receivedAt).getTime() >= requestedAfter) {
        const match = JSON.stringify(payload).match(/\b(\d{4,8})\b/g);
        if (match?.length) return match[match.length - 1];
      }
    } catch {
      // El sumidero puede no estar listo todavia; se reintenta.
    }
    await sleep(2000);
  }
  throw new Error('El backend no entrego el codigo al sumidero. Esta corriendo otp-sink.mjs?');
}

const stamp = Date.now().toString();
const deviceFingerprint = sha256(`demo-device-${EMAIL}`);

const consents = must('documentos de consentimiento', await call('GET', '/consent-documents/active'));
const consentDocument = Array.isArray(consents) ? consents[0] : consents.data?.[0];

const started = must(
  'alta de cuenta',
  await call('POST', '/customer-onboarding/start', {
    body: {
      customer: { phone: PHONE, email: EMAIL, firstName: FIRST_NAME, lastName: LAST_NAME, birthDate: BIRTH_DATE },
      password: PASSWORD,
      consents: [{ consentDocumentId: consentDocument.id, purposeCode: 'onboarding', granted: true }],
      device: { deviceFingerprintHash: deviceFingerprint, fingerprintVersion: 'v1', channel: 'mobile_app' },
    },
    idempotencyKey: `demo-start-${stamp}`,
  }),
);

const customerId = started.customerId;
const token = started.tokens.accessToken;
console.log(`  customerId ${customerId}`);

const requestedAt = Date.now();
must(
  'pedir codigo de verificacion',
  await call('POST', `/customer-onboarding/${customerId}/contact-verification/request`, {
    body: { contactType: 'phone', verificationChannel: 'sms' },
    token,
    idempotencyKey: `demo-vr-${stamp}`,
  }),
);

const code = await readVerificationCode(requestedAt);
console.log(`  codigo entregado por el backend: ${code}`);

must(
  'verificar contacto',
  await call('POST', `/customer-onboarding/${customerId}/contact-verification/submit`, {
    body: { contactType: 'phone', verificationChannel: 'sms', verificationCode: code },
    token,
    idempotencyKey: `demo-vs-${stamp}`,
  }),
);

must(
  'perfil',
  await call('PATCH', `/customer-onboarding/${customerId}/profile`, {
    body: { firstName: FIRST_NAME, lastName: LAST_NAME, birthDate: BIRTH_DATE, preferredLanguage: 'es' },
    token,
  }),
);

must(
  'situacion economica',
  await call('PUT', `/customer-onboarding/${customerId}/financial-profile`, {
    body: {
      employmentStatus: 'employee',
      employerName: 'Atlas Dev',
      employmentSeniorityMonths: 36,
      monthlyIncomeDeclared: 6500,
      otherMonthlyIncome: 0,
      monthlyExpensesDeclared: 2200,
      economicActivityCode: 'servicios',
      sourceOfFunds: 'salary',
    },
    token,
  }),
);

must(
  'domicilio',
  await call('POST', `/customer-onboarding/${customerId}/address-package`, {
    body: {
      address: { countryCode: 'BOL', department: 'Santa Cruz', city: 'Santa Cruz de la Sierra', zone: 'Equipetrol' },
    },
    token,
    idempotencyKey: `demo-ad-${stamp}`,
  }),
);

must(
  'referencias personales',
  await call('POST', `/customer-onboarding/${customerId}/reference-contacts`, {
    body: {
      references: [
        { relationshipType: 'family', fullName: 'Ana Demo', phone: '+59171111111', consentBasis: 'customer_declared' },
        { relationshipType: 'friend', fullName: 'Luis Demo', phone: '+59172222222', consentBasis: 'customer_declared' },
      ],
    },
    token,
  }),
);

/**
 * Un PNG minimo distinto por evidencia.
 *
 * `ux_evidence_documents_customer_hash` es unico por (tenant, cliente, sha256): subir el mismo
 * fichero byte a byte para las tres evidencias choca contra el indice y el paquete de identidad
 * muere con un 409 que parece un problema de idempotencia y no lo es.
 */
const PNG_BASE = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000001f15c4890000000a49444154789c636000000200010005fe02fea7f4b4bc0000000049454e44ae426082',
  'hex',
);

async function uploadEvidence(documentType) {
  const blob = Buffer.concat([PNG_BASE, Buffer.from(`${documentType}${stamp}`)]);
  const ticket = must(
    `url firmada ${documentType}`,
    await call('POST', `/customer-onboarding/${customerId}/documents/upload-url`, {
      body: { documentType, contentType: 'image/png', sizeBytes: blob.length },
      token,
    }),
  );
  const uploaded = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: ticket.requiredHeaders ?? { 'content-type': 'image/png' },
    body: blob,
  });
  if (!uploaded.ok) {
    console.error(` FALLO subida ${documentType} [${uploaded.status}]`);
    process.exit(1);
  }
  console.log(`  ok   subida ${documentType} -> ${ticket.storageKey}`);
  return {
    evidenceType: documentType,
    storageKey: ticket.storageKey,
    mimeType: 'image/png',
    sha256Hash: createHash('sha256').update(blob).digest('hex'),
    fileSizeBytes: String(blob.length),
  };
}

const evidence = [];
for (const documentType of ['identity_front', 'identity_back', 'selfie']) {
  evidence.push(await uploadEvidence(documentType));
}

const documentNumber = `9${stamp.slice(-6)}`;
must(
  'paquete de identidad',
  await call('POST', `/customer-onboarding/${customerId}/identity-package`, {
    body: {
      identity: {
        documentType: 'ci',
        documentNumber,
        documentNumberHash: sha256(documentNumber),
        documentLast4: documentNumber.slice(-4),
        countryCode: 'BOL',
        issuedIn: 'Santa Cruz',
        expiresAt: '2032-01-01',
      },
      evidence,
    },
    token,
    idempotencyKey: `demo-id-${stamp}`,
  }),
);

must(
  'verificacion de identidad',
  await call('POST', `/customer-onboarding/${customerId}/identity-verification`, {
    body: { documentNumber },
    token,
    idempotencyKey: `demo-iv-${stamp}`,
  }),
);

must(
  'enviar a revision',
  await call('POST', `/customer-onboarding/${customerId}/submit`, {
    body: { acknowledgement: true },
    token,
    idempotencyKey: `demo-sub-${stamp}`,
  }),
);

if (!ADMIN_PASSWORD) {
  console.log('\nExpediente enviado a revision. Sin ATLAS_ADMIN_PASSWORD no se puede habilitar:');
  console.log('resuelve a mano las dos decisiones de operaciones o vuelve a ejecutar con la variable.');
  process.exit(0);
}

const admin = must(
  'login del admin interno',
  await call('POST', '/auth/login', {
    body: { actorType: 'internal_user', identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  }),
);

must(
  'habilitar cliente (operaciones)',
  await call('POST', `/operations/customers/${customerId}/eligibility/decision`, {
    body: { decision: 'approve', reasonCode: 'dev_demo_provisioning', notes: 'Cliente de demostracion local.' },
    token: admin.accessToken,
  }),
);

must(
  'aprobar identidad (operaciones)',
  await call('POST', `/operations/customers/${customerId}/identity-verification/decision`, {
    body: { decision: 'approve', reasonCode: 'dev_demo_provisioning' },
    token: admin.accessToken,
  }),
);

const me = must('estado final', await call('GET', `/customers/${customerId}/me`, { token }));
console.log(`\ncustomerId ${customerId} · ${me.customer.status} · elegible: ${me.eligibility.eligible}`);
console.log(`Entra en la app con ${EMAIL} o ${PHONE}.`);
