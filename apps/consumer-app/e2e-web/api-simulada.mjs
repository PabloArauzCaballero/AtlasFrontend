/**
 * Una API simulada que habla el MISMO protocolo que AtlasBackend para lo que necesitan las pruebas de navegador.
 *
 * No es un doble de «todo ok»: implementa las reglas que importan del cambio de PIN, para que la prueba falle si la app
 * las incumple —
 *  - el PIN actual se comprueba antes de mandar nada (400 si no es);
 *  - no se manda otro código antes de 60 s (429), igual que el servidor;
 *  - el código viaja a un BUZÓN (`GET /__bandeja`), que es lo único que la prueba puede leer —como la persona lee su
 *    correo—, y sólo ese código confirma el cambio;
 *  - un código malo es 400 y no cambia nada;
 *  - al confirmar se revocan TODAS las sesiones: desde ese momento cualquier llamada autenticada es 401.
 *
 * Y la sesión de la web en modo cookie (APP-02), como `customer-session-cookie.ts` del backend: con
 * `x-atlas-session-mode: cookie`, el token de refresco va en la cookie `atlas_customer_refresh` (HttpOnly,
 * SameSite=Strict, sólo en las rutas de refresco y cierre) y no en el cuerpo; el refresco lee la cookie y el
 * cierre la borra. `estado.sesionWeb` anota cada llamada de sesión para que la prueba compruebe qué viajó.
 *
 * Y el tope ABSOLUTO de la sesión (8 h): tras `POST /__vencer-sesion` toda llamada autenticada responde 401 y el
 * refresco 401 `SESSION_EXPIRED`, como AtlasBackend cuando la sesión supera su tope. Con `pagos: true`, un crédito con
 * una cuota que se paga con confirmación diferida (`api-simulada-pagos.mjs`).
 */
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { atenderCredito } from './api-simulada-credito.mjs';
import { crearMundoDePagos } from './api-simulada-pagos.mjs';

export function crearApiSimulada({ puerto = 8799, correo = 'pablo@example.com', pinInicial = '4821', enmascarado = 'pa***@gmail.com', vencido = 0, pagos = false } = {}) {
  const estado = { pin: pinInicial, sesionViva: false, topeVencido: false, ultimoEnvio: 0, desafios: new Map(), bandeja: [], llamadas: [], envios: 0, sesionWeb: [] };
  const mundoDePagos = pagos ? crearMundoDePagos() : null;
  const COOKIE = 'atlas_customer_refresh';
  const RUTAS_COOKIE = ['/api/v1/auth/refresh', '/api/v1/auth/logout'];
  const modoCookie = (req) => String(req.headers['x-atlas-session-mode'] ?? '').toLowerCase() === 'cookie';
  const leerCookie = (req) =>
    String(req.headers.cookie ?? '')
      .split(';')
      .map((p) => p.trim().split('='))
      .find(([k]) => k === COOKIE)?.[1] ?? null;
  const ponerCookie = (res, valor) =>
    res.setHeader(
      'set-cookie',
      RUTAS_COOKIE.map((ruta) => `${COOKIE}=${valor}; Path=${ruta}; HttpOnly; SameSite=Strict${valor ? '; Max-Age=2592000' : '; Max-Age=0'}`),
    );

  const jwt = () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'none' })}.${b64({ sub: '53', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
  };
  const usuario = () => ({ actorType: 'customer', actorId: '53', tenantId: '1', role: 'customer', customerId: '53' });

  const responder = (res, estatus, cuerpo) => {
    // Con credenciales el navegador no acepta comodines: se refleja el origen y las cabeceras pedidas.
    const pedido = res.req?.headers ?? {};
    res.writeHead(estatus, {
      'content-type': 'application/json',
      'access-control-allow-origin': pedido.origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': pedido['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    });
    res.end(JSON.stringify(cuerpo));
  };
  const ok = (res, data) => responder(res, 200, { requestId: 'sim', data, timestamp: new Date().toISOString() });
  const fallo = (res, estatus, code, message) => responder(res, estatus, { requestId: 'sim', error: { code, message }, timestamp: new Date().toISOString() });

  const servidor = createServer((req, res) => {
    if (req.method === 'OPTIONS') return responder(res, 204, {});
    let texto = '';
    req.on('data', (c) => (texto += c));
    req.on('end', () => {
      const ruta = (req.url ?? '').split('?')[0].replace('/api/v1', '');
      // El comprobante sube en bytes al «almacén» (`/__almacen/…`): no todo cuerpo es JSON.
      let cuerpo = {};
      try {
        cuerpo = texto ? JSON.parse(texto) : {};
      } catch {
        cuerpo = {};
      }
      estado.llamadas.push(`${req.method} ${ruta}`);

      if (ruta === '/__bandeja') return responder(res, 200, { bandeja: estado.bandeja, envios: estado.envios });
      if (ruta === '/__reiniciar') {
        Object.assign(estado, { pin: pinInicial, sesionViva: false, ultimoEnvio: 0, bandeja: [], envios: 0, llamadas: [], sesionWeb: [] });
        estado.desafios.clear();
        return ok(res, { reiniciado: true });
      }
      if (ruta === '/__llamadas') return responder(res, 200, { llamadas: estado.llamadas });
      if (ruta === '/__vencer-sesion') {
        estado.topeVencido = true;
        return ok(res, { vencida: true });
      }
      if (ruta === '/__pagos') return responder(res, 200, mundoDePagos?.estado ?? {});

      if (['/auth/login', '/auth/refresh', '/auth/logout'].includes(ruta)) {
        estado.sesionWeb.push({ ruta, modo: modoCookie(req) ? 'cookie' : 'cuerpo', cookie: leerCookie(req), cuerpo, origin: req.headers.origin ?? null });
      }
      const tokens = (req) =>
        modoCookie(req)
          ? (ponerCookie(res, 'refresco'), { accessToken: jwt(), tokenType: 'Bearer', expiresIn: '15m', sessionMode: 'cookie' })
          : { accessToken: jwt(), refreshToken: 'refresco', tokenType: 'Bearer', expiresIn: '15m' };
      if (ruta === '/auth/login') {
        if (cuerpo.password !== estado.pin) return fallo(res, 401, 'UNAUTHORIZED', 'Credenciales inválidas.');
        estado.sesionViva = true;
        estado.topeVencido = false;
        return ok(res, tokens(req));
      }
      if (ruta === '/auth/refresh') {
        const token = modoCookie(req) ? (leerCookie(req) ?? cuerpo.refreshToken) : cuerpo.refreshToken;
        if (estado.topeVencido) {
          if (modoCookie(req)) ponerCookie(res, '');
          return fallo(res, 401, 'SESSION_EXPIRED', 'SESSION_EXPIRED: la sesión superó su duración máxima.');
        }
        if (!estado.sesionViva || !token) {
          if (modoCookie(req)) ponerCookie(res, '');
          return fallo(res, 401, 'UNAUTHORIZED', 'Sesión revocada.');
        }
        return ok(res, tokens(req));
      }
      if (ruta === '/auth/logout') {
        estado.sesionViva = false;
        if (modoCookie(req)) ponerCookie(res, '');
        return ok(res, { loggedOut: true });
      }

      // Todo lo que sigue exige sesión viva: tras el cambio de PIN el servidor real también responde 401.
      if (!estado.sesionViva) return fallo(res, 401, 'UNAUTHORIZED', 'Sesión revocada.');
      // El almacén no pide sesión: la URL firmada es la credencial.
      if (mundoDePagos && ruta.startsWith('/__almacen/') && mundoDePagos.atender({ req, ruta, res, ok })) return undefined;
      if (estado.topeVencido) return fallo(res, 401, 'TOKEN_EXPIRED', 'TOKEN_EXPIRED');

      if (ruta === '/auth/me') return ok(res, usuario());
      if (ruta === '/customer-onboarding/53/status')
        return ok(res, {
          customerId: '53',
          lifecycleStatus: 'active',
          creditEligibilityStatus: 'eligible',
          onboarding: { onboardingFlowId: '1', flowVersion: '1', completionStatus: 'completed', startedAt: '2026-09-01T00:00:00Z', completedAt: '2026-09-02T00:00:00Z' },
          completionPercentage: 100,
          sections: [],
          canSubmit: false,
          nextStep: 'completed',
          blockers: [],
        });
      if (ruta === '/customers/53/me')
        return ok(res, {
          customer: { customerId: '53', customerCode: 'CUS-secreto', status: 'active', phoneLast4: '7232', emailDomain: '@gmail.com' },
          profile: { firstName: 'Pablo', lastName: 'Arauz', birthDate: '2001-12-06', preferredLanguage: 'es-BO' },
          onboarding: null,
          eligibility: { eligible: true, completionPercentage: 100, blockerCodes: [] },
          contacts: [
            { contactType: 'phone', status: 'verified', isPrimary: true, valueLast4: '7232', maskedValue: null },
            { contactType: 'email', status: 'verified', isPrimary: true, valueLast4: null, maskedValue: enmascarado },
          ],
          consents: { accepted: [], declined: [] },
        });
      if (ruta === '/customers/53/sessions/start') return ok(res, { sessionId: 's1', deviceId: 'd1' });
      if (ruta === '/auth/pin/verify') return cuerpo.pin === estado.pin ? ok(res, { verified: true, verifiedAt: new Date().toISOString() }) : fallo(res, 400, 'PIN_INCORRECT', 'El PIN no es correcto.');
      if (ruta === '/customer-onboarding/53/answers')
        return ok(res, {
          customerId: '53',
          personalData: null,
          financialProfile: { monthlyIncome: 4500, incomeSource: 'self_employed', dependents: 2 },
          address: { countryCode: 'BO', department: 'Santa Cruz', city: 'Santa Cruz de la Sierra', zone: 'Zona Norte', addressLine: null, gps: null },
        });
      if (ruta === '/mobile/support/faq')
        return ok(res, {
          faq: [
            {
              articleId: '1',
              articleKey: 'pagar-cuota',
              title: 'Cómo pago mi cuota',
              question: '¿Cómo pago mi cuota?',
              shortAnswer: 'Con **QR**, transferencia o en efectivo.',
              body: '## Por transferencia\n\nUsá los datos que aparecen en la misma pantalla. **Importante:** la transferencia tiene que salir a tu nombre; si la hace otra persona, el pago no se acredita solo y hay que avisarnos.\n\n## En efectivo\n\nEn cualquier comercio de la red con el código de tu cuota.\n\n1. Esperá dos minutos: el mensaje puede demorar.\n2. Comprobá que tengas señal.\n3. Pedí un código nuevo — el anterior deja de servir.',
              escalateWhen: 'Si el pago tiene más de 24 horas y sigue sin acreditarse, abrí un caso con el comprobante.',
            },
          ],
        });

      if (ruta === '/auth/password/change/request') {
        if (cuerpo.currentPassword !== estado.pin) return fallo(res, 400, 'BAD_REQUEST', 'La contraseña actual no es correcta.');
        if (Date.now() - estado.ultimoEnvio < 60_000) return fallo(res, 429, 'TOO_MANY_REQUESTS', 'Ya te enviamos un código hace menos de un minuto. Revisa tu correo antes de pedir otro.');
        estado.ultimoEnvio = Date.now();
        estado.envios += 1;
        const codigo = String(100000 + Math.floor(Math.random() * 900000));
        const desafio = `desafio-${estado.envios}`;
        estado.desafios.set(desafio, codigo);
        estado.bandeja.push({ para: correo, codigo, asunto: 'Código para cambiar tu PIN' });
        return ok(res, { pinChallengeRequired: true, challengeToken: desafio, expiresInMinutes: 10, deliveredTo: enmascarado });
      }
      if (ruta === '/auth/password/change/confirm') {
        const esperado = estado.desafios.get(cuerpo.challengeToken);
        if (!esperado || esperado !== cuerpo.code) return fallo(res, 400, 'BAD_REQUEST', 'Código inválido o expirado.');
        if (!/^\d{4}$/.test(cuerpo.newPassword) || cuerpo.newPassword === estado.pin) return fallo(res, 400, 'BAD_REQUEST', 'El PIN nuevo no es válido.');
        estado.pin = cuerpo.newPassword;
        estado.sesionViva = false; // el servidor revoca TODAS las sesiones, también la que hizo la llamada
        estado.desafios.delete(cuerpo.challengeToken);
        return ok(res, { passwordChanged: true });
      }

      if (mundoDePagos?.atender({ req, ruta, res, ok })) return undefined;

      // La línea, los puntos, la calificación y los extractos: datos fijos, en `api-simulada-credito.mjs`.
      if (atenderCredito({ ruta, res, ok, fallo, vencido })) return undefined;

      // Lo demás (avisos, telemetría, contenido remoto…) no es lo que se prueba: responde vacío sin romper la pantalla.
      if (req.method === 'GET') return fallo(res, 404, 'NOT_FOUND', 'No simulado.');
      return ok(res, {});
    });
  });

  return {
    estado,
    escuchar: () => new Promise((r) => servidor.listen(puerto, '127.0.0.1', r)),
    cerrar: () => new Promise((r) => servidor.close(r)),
    puerto,
  };
}

// Uso directo: `node e2e-web/api-simulada.mjs` la deja escuchando.
if (import.meta.url === `file://${process.argv[1]}`) {
  const api = crearApiSimulada({ puerto: Number(process.env.PUERTO ?? 8799) });
  await api.escuchar();
  console.log(`API simulada en http://127.0.0.1:${api.puerto}/api/v1`);
}
