/**
 * Reenvia la API del anfitrion para que el emulador de Android la alcance.
 *
 * ## Por que existe
 *
 * El emulador llega sin problemas a un servidor Node del anfitrion por `10.0.2.2`, pero NO al proxy
 * de puertos de Docker Desktop: la conexion TCP se queda colgada aunque `ping 10.0.2.2` responda en
 * milisegundos y el mismo puerto conteste desde el anfitrion. Se comprobo lado a lado —un servidor
 * Node responde `200` desde dentro del emulador; el puerto publicado por Docker no devuelve nada—
 * asi que no es carga, ni ruta, ni el backend, ni el cortafuegos (una regla de entrada explicita no
 * lo cambia).
 *
 * El sintoma en la app es enganoso: la pantalla dice «Sin conexion», que es exactamente lo que hay
 * que mostrarle a una persona sin red, y no da ninguna pista de que el problema esta en la capa de
 * red del entorno de desarrollo.
 *
 * ## Por que HTTP y no un tunel TCP
 *
 * La primera version reenviaba sockets en crudo. Funcionaba desde el anfitrion y seguia sin
 * funcionar desde el emulador, igual que Docker: lo que atraviesa es un servidor HTTP de Node
 * atendiendo peticiones completas, no un socket reenviado. Asi que esto habla HTTP en los dos
 * extremos.
 *
 * ## Uso
 *
 *   node tools/dev-backend/host-port-bridge.mjs --listen 3106 --target 3105
 *
 * Y se compila la app apuntando a `http://10.0.2.2:3106/api/v1`.
 *
 * Solo para desarrollo. En un dispositivo real no hace falta: alcanza la IP LAN del anfitrion.
 */
import http from 'node:http';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}

const LISTEN_PORT = Number(args.get('listen') ?? 3106);
const TARGET_PORT = Number(args.get('target') ?? 3105);
const TARGET_HOST = args.get('host') ?? '127.0.0.1';
const VERBOSE = args.get('verbose') === 'true';

const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      path: request.url,
      method: request.method,
      // Las cabeceras se pasan tal cual: `x-tenant-id`, `authorization` y `x-idempotency-key` son
      // parte del contrato, y filtrarlas convertiria el puente en una fuente de errores propios.
      headers: { ...request.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', (error) => {
    if (VERBOSE) console.error(`${request.method} ${request.url} -> ${error.message}`);
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'BRIDGE_UPSTREAM_ERROR', message: error.message } }));
  });

  if (VERBOSE) console.log(`${request.method} ${request.url}`);
  request.pipe(upstream);
});

server.on('error', (error) => {
  console.error(`No se pudo abrir el puerto ${LISTEN_PORT}: ${error.message}`);
  process.exit(1);
});

// `0.0.0.0` y no `127.0.0.1`: el emulador llega desde su propia red NAT.
server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`puente HTTP ${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`desde el emulador: http://10.0.2.2:${LISTEN_PORT}`);
});
