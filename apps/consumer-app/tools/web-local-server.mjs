#!/usr/bin/env node
/**
 * Sirve `dist/` (la salida de `expo export --platform web`) como lo hará nginx en Coolify:
 *
 * - cualquier ruta que no sea un archivo devuelve `index.html` (la web es una sola página y
 *   expo-router resuelve la ruta en el navegador);
 * - `/api/v1/*` se reenvía al backend, así el bundle usa la base RELATIVA `/api/v1` y no hay CORS,
 *   exactamente como en el despliegue.
 *
 * Uso: `node tools/web-local-server.mjs [puerto] [backend]`
 *      (por defecto 8790 y http://localhost:53005, el puerto que publica `atlasbackend-api-1`).
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 8790);
const backend = new URL(process.argv[3] ?? 'http://localhost:53005');
const root = new URL('../dist/', import.meta.url).pathname;
/** Prefijo bajo el que vive la web (como el Funnel del H310): se recorta antes de servir, igual que hará el proxy. */
const base = (process.argv[4] ?? '').replace(/\/$/, '');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    if (base && req.url.startsWith(base)) req.url = req.url.slice(base.length) || '/';
    if (req.url.startsWith('/api/v1')) {
      const upstream = http.request(
        { host: backend.hostname, port: backend.port, method: req.method, path: req.url, headers: { ...req.headers, host: backend.host } },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on('error', (error) => {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'backend no responde', detail: error.message }));
      });
      req.pipe(upstream);
      return;
    }
    const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, clean);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`web en http://localhost:${port} · /api/v1 → ${backend.origin}`));
