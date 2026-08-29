/**
 * El camino completo del cliente, de punta a punta y contra el backend real.
 *
 * Recorre lo mismo que la app, en el mismo orden y con los mismos endpoints: alta, verificación del
 * contacto, perfil, documento de identidad con sus fotos, domicilio, economía, referencias y el envío
 * del expediente a revisión. Después toma el tramo que NO es del cliente —la resolución de identidad
 * y la habilitación, decisiones del back-office— y cierra con la solicitud de crédito.
 *
 * Esa segunda mitad está aquí a propósito: sin ella el recorrido termina en un rechazo correcto
 * (`ACCOUNT_NOT_ACTIVE, IDENTITY_NOT_VERIFIED, EVIDENCE_PENDING_REVIEW, RISK_NOT_APPROVED`) y no se
 * llega a ver nunca lo que pasa cuando el expediente sí está aprobado. El informe distingue los dos
 * tramos por el `(operador)` en el nombre del paso.
 *
 * ## Por qué existe
 *
 * Tecleado a mano en el simulador, este recorrido son ~40 pantallas y no se puede repetir después de
 * cada cambio. Aquí queda ejecutable: dice EN QUÉ PASO se rompe y con qué respuesta del servidor, que
 * es lo que un `tsc` verde nunca contesta.
 *
 * ## El código de verificación
 *
 * El backend sólo guarda su SHA-256 (`iam.auth_one_time_codes.code_hash`) y manda el claro por
 * correo o SMS. Sin buzón, aquí se recupera probando los 10⁶ códigos de seis dígitos contra ese
 * hash: cuesta menos de un segundo. **Es una técnica de desarrollo local**, y de paso demuestra que
 * lo que se persiste es un hash de verdad. Nunca debe correr contra un entorno real; de ahí que viva
 * en `tools/` y exija `ATLAS_API` explícito.
 *
 *   node tools/dev-backend/recorrido-completo.mjs
 *   ATLAS_API=http://localhost:53005/api/v1 node tools/dev-backend/recorrido-completo.mjs
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const API = process.env.ATLAS_API ?? 'http://localhost:53005/api/v1';
const TENANT = process.env.ATLAS_TENANT ?? '1';
const PG = process.env.ATLAS_PG_CONTAINER ?? 'atlasbackend-postgres-1';
/** Sólo para leer las credenciales del operador en local; nunca se imprime su contenido. */
const ENV_BACKEND = process.env.ATLAS_BACKEND_ENV ?? '../../../AtlasBackend/.env';

const sello = Date.now();
const CORREO = `recorrido.${sello}@atlas.test`;
const TELEFONO = `7${String(sello).slice(-7)}`;
const PIN = '4816';

let token = null;
let tokenOperador = null;
let customerId = null;
const pasos = [];

function anota(paso, ok, detalle) {
  pasos.push({ paso, ok, detalle });
  console.log(`  ${ok ? '✓' : '✗'} ${paso}${detalle ? ` — ${detalle}` : ''}`);
}

async function llamar(metodo, ruta, cuerpo, opciones = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-tenant-id': TENANT };
  const portador = opciones.operador ? tokenOperador : token;
  if (portador && !opciones.anonimo) headers.Authorization = `Bearer ${portador}`;
  if (opciones.idempotente) headers['X-Idempotency-Key'] = randomUUID();

  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let sobre;
  try {
    sobre = JSON.parse(texto);
  } catch {
    sobre = { raw: texto.slice(0, 200) };
  }
  return { ok: respuesta.ok, status: respuesta.status, data: sobre?.data ?? sobre, error: sobre?.error };
}

/** Lee un valor de la base del contenedor. Sólo lectura y sólo para lo que la API no expone. */
function consultarBase(sql) {
  return execFileSync('docker', ['exec', '-e', 'PGPASSWORD=atlas', PG, 'psql', '-U', 'atlas', '-d', 'atlas', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
  }).trim();
}

/**
 * Recupera el código de verificación a partir de su hash.
 *
 * No lo inventa ni lo sobreescribe: encuentra el que el backend generó y envió. Si el hash no
 * corresponde a un código de seis dígitos, se dice y se para — es preferible a seguir con uno falso.
 */
function recuperarCodigo(proposito) {
  const hash = consultarBase(
    `SELECT code_hash FROM iam.auth_one_time_codes
      WHERE actor_type='customer' AND actor_id=${customerId} AND purpose='${proposito}' AND consumed_at IS NULL
      ORDER BY _id DESC LIMIT 1;`,
  );
  if (!hash) return null;
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidato = String(n).padStart(6, '0');
    if (createHash('sha256').update(candidato).digest('hex') === hash) return candidato;
  }
  return null;
}

/** Sube un archivo de `assets/dev/` con el ticket firmado y devuelve lo que el paquete debe declarar. */
async function subirEvidencia(tipo, rutaLocal) {
  const bytes = readFileSync(rutaLocal);
  const mime = rutaLocal.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const ticket = await llamar('POST', `/customer-onboarding/${customerId}/documents/upload-url`, {
    documentType: tipo,
    contentType: mime,
    sizeBytes: bytes.length,
  });
  if (!ticket.ok) throw new Error(`ticket de ${tipo}: ${ticket.error?.message ?? ticket.status}`);

  const subida = await fetch(ticket.data.uploadUrl, {
    method: ticket.data.method,
    headers: ticket.data.requiredHeaders,
    body: bytes,
  });
  if (!subida.ok) throw new Error(`subida de ${tipo}: HTTP ${subida.status}`);

  return {
    evidenceType: tipo,
    storageKey: ticket.data.storageKey,
    mimeType: mime,
    sha256Hash: createHash('sha256').update(bytes).digest('hex'),
    fileSizeBytes: String(bytes.length),
  };
}

async function main() {
  console.log(`\nRecorrido completo contra ${API}`);
  console.log(`Cliente nuevo: ${CORREO} · PIN ${PIN}\n`);

  // 1. ALTA -------------------------------------------------------------------------------------
  const documentos = consultarBase("SELECT _id FROM privacy.consent_documents WHERE status='published' ORDER BY _id;")
    .split('\n')
    .filter(Boolean);
  const finalidad = consultarBase('SELECT purpose_code FROM privacy.privacy_processing_purposes ORDER BY _id LIMIT 1;');

  const alta = await llamar(
    'POST',
    '/customer-onboarding/start',
    {
      customer: { email: CORREO, phone: TELEFONO, firstName: 'Recorrido', lastName: 'Completo' },
      password: PIN,
      consents: documentos.map((id) => ({ consentDocumentId: id, purposeCode: finalidad, granted: true })),
      device: {
        deviceFingerprintHash: createHash('sha256').update(`recorrido-${sello}`).digest('hex'),
        fingerprintVersion: '1',
        channel: 'mobile_app',
      },
      onboarding: { sourceType: 'mobile_app' },
    },
    { anonimo: true, idempotente: true },
  );
  if (!alta.ok) {
    anota('Alta', false, alta.error?.message ?? `HTTP ${alta.status}`);
    return resumen();
  }
  customerId = alta.data.customerId;
  token = alta.data.tokens?.accessToken ?? null;
  anota('Alta', true, `cliente ${customerId}, siguiente paso: ${alta.data.nextStep}`);

  if (!token) {
    const acceso = await llamar('POST', '/auth/login', { actorType: 'customer', identifier: CORREO, password: PIN }, { anonimo: true });
    token = acceso.data?.accessToken ?? null;
    anota('Ingreso', Boolean(token), token ? 'sesión iniciada' : acceso.error?.message);
  }

  // 2. VERIFICACIÓN DEL CONTACTO ----------------------------------------------------------------
  for (const contacto of ['phone', 'email']) {
    const canal = contacto === 'phone' ? 'sms' : 'email';
    const pedido = await llamar(
      'POST',
      `/customer-onboarding/${customerId}/contact-verification/request`,
      { contactType: contacto, verificationChannel: canal },
      { idempotente: true },
    );
    if (!pedido.ok) {
      const sinCanal = String(pedido.error?.message ?? '').includes('VERIFICATION_CHANNEL_UNAVAILABLE');
      // Sin proveedor de SMS en local no hay nada que probar: se anota como omitido, no como roto.
      anota(`Verificar ${contacto}`, sinCanal, sinCanal ? 'omitido: no hay proveedor de SMS en local' : pedido.error?.message);
      continue;
    }
    const codigo = recuperarCodigo(`contact_verification_${contacto}`) ?? recuperarCodigo(contacto);
    if (!codigo) {
      anota(`Verificar ${contacto}`, false, 'no se pudo recuperar el código emitido');
      continue;
    }
    const envio = await llamar(
      'POST',
      `/customer-onboarding/${customerId}/contact-verification/submit`,
      { contactType: contacto, verificationChannel: canal, verificationCode: codigo },
      { idempotente: true },
    );
    anota(`Verificar ${contacto}`, envio.ok, envio.ok ? `${envio.data.verificationStatus} → ${envio.data.nextStep}` : envio.error?.message);
  }

  // 3. PERFIL -----------------------------------------------------------------------------------
  const perfil = await llamar('PATCH', `/customer-onboarding/${customerId}/profile`, {
    firstName: 'Recorrido',
    lastName: 'Completo',
    birthDate: '1995-04-12',
    genderDeclared: 'undisclosed',
    preferredLanguage: 'es',
    marketingOptIn: false,
  });
  anota('Perfil', perfil.ok, perfil.ok ? 'datos personales guardados' : perfil.error?.message);

  // 4. DOCUMENTO DE IDENTIDAD -------------------------------------------------------------------
  try {
    const evidencias = [
      await subirEvidencia('identity_front', 'assets/dev/carnet-anverso.png'),
      await subirEvidencia('identity_back', 'assets/dev/carnet-reverso.png'),
      await subirEvidencia('selfie', 'assets/dev/selfie.png'),
    ];
    const numero = `9${String(sello).slice(-6)}`;
    const identidad = await llamar(
      'POST',
      `/customer-onboarding/${customerId}/identity-package`,
      {
        identity: {
          documentType: 'ci',
          documentNumber: numero,
          documentNumberHash: createHash('sha256').update(numero).digest('hex'),
          documentLast4: numero.slice(-4),
          countryCode: 'BOL',
          issuedIn: 'SC',
          expiresAt: '2032-04-12',
        },
        evidence: evidencias,
      },
      { idempotente: true },
    );
    anota('Documento de identidad', identidad.ok, identidad.ok ? `${identidad.data.status} → ${identidad.data.nextStep}` : identidad.error?.message);
  } catch (error) {
    anota('Documento de identidad', false, String(error.message ?? error));
  }

  // 5. DOMICILIO --------------------------------------------------------------------------------
  const domicilio = await llamar(
    'POST',
    `/customer-onboarding/${customerId}/address-package`,
    {
      address: { countryCode: 'BOL', department: 'Santa Cruz', city: 'Santa Cruz de la Sierra', zone: 'Equipetrol', addressLine: 'Calle 5 Oeste #120' },
      gpsObservation: { lat: -17.7663, lng: -63.1889, accuracyMeters: 12 },
    },
    { idempotente: true },
  );
  anota('Domicilio', domicilio.ok, domicilio.ok ? `${domicilio.data.status} → ${domicilio.data.nextStep}` : domicilio.error?.message);

  // 6. ECONOMÍA ---------------------------------------------------------------------------------
  const economia = await llamar('PUT', `/customer-onboarding/${customerId}/financial-profile`, {
    employmentStatus: 'employee',
    employerName: 'Comercial Andina SRL',
    employmentSeniorityMonths: 26,
    monthlyIncomeDeclared: 6500,
    otherMonthlyIncome: 0,
    monthlyExpensesDeclared: 2800,
    // Obligatorio para habilitar: sin él la sección queda incompleta y el crédito se bloquea con
    // `FINANCIAL_PROFILE_INCOMPLETE` aunque todo lo demás esté puesto.
    economicActivityCode: 'comercio_minorista',
    sourceOfFunds: 'salary',
  });
  anota('Economía', economia.ok, economia.ok ? `atributos: ${economia.data.updatedAttributes?.length ?? 0}` : economia.error?.message);

  // 7. REFERENCIAS ------------------------------------------------------------------------------
  const referencias = await llamar('POST', `/customer-onboarding/${customerId}/reference-contacts`, {
    references: [
      { relationshipType: 'family', fullName: 'Marta Gutiérrez', phone: '76512345', consentBasis: 'customer_declared' },
      { relationshipType: 'coworker', fullName: 'Luis Peña', phone: '76598765', consentBasis: 'customer_declared' },
    ],
  });
  anota('Referencias', referencias.ok, referencias.ok ? `${referencias.data.totalReferences} declaradas` : referencias.error?.message);

  // 8. ESTADO DEL EXPEDIENTE --------------------------------------------------------------------
  const estado = await llamar('GET', `/customer-onboarding/${customerId}/status`);
  const pendientes = (estado.data?.sections ?? []).filter((s) => s.status !== 'completed').map((s) => s.code);
  anota(
    'Expediente',
    estado.ok,
    estado.ok ? `siguiente: ${estado.data.nextStep} · pendientes: ${pendientes.length ? pendientes.join(', ') : 'ninguna'}` : estado.error?.message,
  );

  // 9. ENVÍO A REVISIÓN --------------------------------------------------------------------------
  //
  // El último paso QUE HACE EL CLIENTE, y el único punto del flujo donde se valida completitud.
  // Mueve el expediente a `under_review`, cierra el flujo de onboarding y dispara la evaluación de
  // riesgo. Sin él, el cliente se queda en `registered` para siempre y el crédito se rechaza con
  // `ACCOUNT_NOT_ACTIVE` — que fue exactamente lo que pasaba antes de incluirlo aquí.
  const envio = await llamar('POST', `/customer-onboarding/${customerId}/submit`, { acknowledgement: true }, { idempotente: true });
  anota(
    'Envío a revisión',
    envio.ok,
    envio.ok ? `${envio.data.lifecycleStatus} · ${listarBloqueadores(envio.data.blockers)}` : envio.error?.message,
  );

  // 10. OPERACIONES ------------------------------------------------------------------------------
  //
  // Lo que queda NO es del cliente: aprobar la evidencia documental y habilitar la cuenta son
  // decisiones humanas del back-office, y el producto está bien en negárselas al cliente. Aquí se
  // toman contra los mismos endpoints que usa el portal interno, autenticado como el operador.
  const entrada = await ingresarComoOperador();
  anota('Ingreso de operaciones', Boolean(tokenOperador), entrada);

  if (tokenOperador) {
    const identidad = await llamar(
      'POST',
      `/operations/customers/${customerId}/identity-verification/decision`,
      { decision: 'approve', reasonCode: 'recorrido_dev_local' },
      { operador: true },
    );
    anota(
      'Identidad resuelta (operador)',
      identidad.ok,
      identidad.ok ? listarBloqueadores(identidad.data.eligibility?.blockers ?? identidad.data.blockers) : identidad.error?.message,
    );

    const habilitacion = await llamar(
      'POST',
      `/operations/customers/${customerId}/eligibility/decision`,
      { decision: 'approve', reasonCode: 'recorrido_dev_local' },
      { operador: true },
    );
    anota(
      'Habilitación (operador)',
      habilitacion.ok,
      habilitacion.ok
        ? `${habilitacion.data.previousStatus ?? '—'} → ${habilitacion.data.newStatus ?? habilitacion.data.lifecycleStatus} · ${listarBloqueadores(habilitacion.data.blockers)}`
        : habilitacion.error?.message,
    );
  }

  // 11. SOLICITAR CRÉDITO ------------------------------------------------------------------------
  const productos = await llamar('GET', `/customers/${customerId}/credit-products`);
  if (!productos.ok || !(productos.data?.products ?? []).length) {
    anota('Productos de crédito', false, productos.ok ? 'sin productos elegibles' : productos.error?.message);
    return resumen();
  }
  const producto = productos.data.products[0];
  anota('Productos de crédito', true, `${productos.data.products.length} disponible(s): ${producto.productCode ?? producto.name ?? producto.productId}`);

  const solicitud = await llamar(
    'POST',
    `/customers/${customerId}/credit-applications`,
    { productId: String(producto.productId ?? producto.id), requestedAmount: 3000, requestedTermMonths: 6, purposeCode: 'consumo' },
    { idempotente: true },
  );
  anota(
    'Solicitud de crédito',
    solicitud.ok,
    solicitud.ok ? `${solicitud.data.applicationCode} · estado ${solicitud.data.status}` : solicitud.error?.message,
  );

  return resumen();
}

/** Los bloqueadores en una línea. Es lo que hay que leer cuando un paso «pasa» pero no habilita. */
function listarBloqueadores(bloqueadores) {
  if (!Array.isArray(bloqueadores)) return 'sin lista de bloqueadores';
  return bloqueadores.length ? `bloqueadores: ${bloqueadores.map((b) => b.code ?? b).join(', ')}` : 'sin bloqueadores';
}

/**
 * Entra como el operador interno, con su segundo factor.
 *
 * El admin del motor exige PIN por correo, y aquí no hay buzón: el PIN se recupera del mismo modo
 * que el código de verificación del cliente —probando los seis dígitos contra el hash guardado—,
 * buscándolo por el hash del `challengeToken` que el propio login acaba de devolver. Es la vía
 * exacta del portal, sin apagar el segundo factor: `AUTH_LOGIN_PIN_ENABLED=false` dejaría el
 * recorrido en verde habiendo ejercitado un acceso que no es el de producción.
 *
 * La contraseña NO está en el repositorio: llega por `ATLAS_ADMIN_PASSWORD`, o se lee del `.env`
 * local del backend. Nunca se imprime.
 */
async function ingresarComoOperador() {
  const credenciales = credencialesDeOperaciones();
  if (!credenciales) return 'sin credenciales: define ATLAS_ADMIN_PASSWORD (o deja el .env del backend a mano)';

  const acceso = await llamar(
    'POST',
    '/auth/login',
    { actorType: 'internal_user', identifier: credenciales.email, password: credenciales.password },
    { anonimo: true },
  );
  if (!acceso.ok) return acceso.error?.message ?? `HTTP ${acceso.status}`;

  if (!acceso.data.pinChallengeRequired) {
    tokenOperador = acceso.data.accessToken;
    return 'sesión interna abierta';
  }

  const pin = recuperarPinDelDesafio(acceso.data.challengeToken);
  if (!pin) return 'no se pudo recuperar el PIN del segundo factor';

  const verificado = await llamar('POST', '/auth/login/pin', { challengeToken: acceso.data.challengeToken, pin }, { anonimo: true });
  if (!verificado.ok) return verificado.error?.message ?? `HTTP ${verificado.status}`;
  tokenOperador = verificado.data.accessToken;
  return 'sesión interna abierta con segundo factor';
}

/** Correo y contraseña del operador: del entorno, o del `.env` del backend si está a mano. */
function credencialesDeOperaciones() {
  let email = process.env.ATLAS_ADMIN_EMAIL ?? null;
  let password = process.env.ATLAS_ADMIN_PASSWORD ?? null;
  if (!password) {
    try {
      const env = readFileSync(ENV_BACKEND, 'utf8');
      email ??= env.match(/^DEV_ADMIN_EMAIL=(.*)$/m)?.[1]?.trim() ?? null;
      password = env.match(/^DEV_ADMIN_PASSWORD=(.*)$/m)?.[1]?.trim() ?? null;
    } catch {
      return null;
    }
  }
  return email && password ? { email, password } : null;
}

/** El PIN del segundo factor, por el hash del desafío que el login acaba de emitir. */
function recuperarPinDelDesafio(challengeToken) {
  const desafio = createHash('sha256').update(challengeToken).digest('hex');
  const hash = consultarBase(
    `SELECT code_hash FROM iam.auth_one_time_codes WHERE challenge_hash='${desafio}' AND consumed_at IS NULL ORDER BY _id DESC LIMIT 1;`,
  );
  if (!hash) return null;
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidato = String(n).padStart(6, '0');
    if (createHash('sha256').update(candidato).digest('hex') === hash) return candidato;
  }
  return null;
}

function resumen() {
  const bien = pasos.filter((p) => p.ok).length;
  console.log(`\n${bien}/${pasos.length} pasos completados.`);
  const roto = pasos.find((p) => !p.ok);
  if (roto) console.log(`Se corta en: ${roto.paso} — ${roto.detalle}`);
  process.exit(roto ? 1 : 0);
}

await main();
