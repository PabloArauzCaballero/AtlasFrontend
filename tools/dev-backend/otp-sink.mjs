/**
 * Sumidero de notificaciones para DESARROLLO LOCAL.
 *
 * El stack local de AtlasBackend no tiene proveedor de SMS/WhatsApp/correo, asi que
 * `POST /customer-onboarding/:id/contact-verification/request` responde
 * `SERVICE_UNAVAILABLE: VERIFICATION_CHANNEL_UNAVAILABLE`. Este proceso implementa el proveedor
 * `webhook` que el backend ya soporta (`NOTIFICATION_SMS_PROVIDER=webhook`), recibe el mensaje
 * real que el backend genera y expone el ultimo codigo para poder terminar el onboarding en un
 * emulador sin telefonia.
 *
 * No inventa codigos: solo muestra el que el backend genero y envio. Nunca debe correr fuera de
 * desarrollo — de ahi que viva en tools/ y no en el bundle de la app.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.OTP_SINK_PORT ?? 4599);
const received = [];

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
  });

const extractCode = (text) => {
  const match = /\b(\d{4,8})\b/.exec(text ?? '');
  return match ? match[1] : null;
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/notify') {
    const raw = await readBody(req);
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }
    const body = payload.body ?? payload.message ?? raw;
    const entry = {
      receivedAt: new Date().toISOString(),
      channel: payload.channel ?? 'unknown',
      to: payload.to ?? payload.phone ?? payload.recipient ?? null,
      body,
      code: extractCode(typeof body === 'string' ? body : JSON.stringify(body)),
    };
    received.unshift(entry);
    received.length = Math.min(received.length, 50);
    console.log(`[otp-sink] ${entry.channel} -> ${entry.to ?? '?'} code=${entry.code ?? '?'}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id: entry.receivedAt }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/last') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(received[0] ?? null));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/all') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(received));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
}).listen(PORT, () => console.log(`[otp-sink] escuchando en http://localhost:${PORT} (POST /notify, GET /last)`));
