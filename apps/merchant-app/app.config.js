/**
 * Configuracion dinamica de la app del comercio. Extiende `app.json`.
 *
 * Es el mismo patron que `apps/consumer-app/app.config.js` (ver su cabecera para el porque): el
 * `.env` se lee de forma explicita y sus valores viajan en `extra.atlas`, porque el build de release
 * no garantiza cargarlo por su cuenta; y el trafico en claro solo se permite para el host `http://`
 * configurado, que en un build de iPhone no puede ser ninguno (la API va siempre por https).
 *
 * La URL apunta al backend del ERP (`/api/v1` del portal), no a AtlasBackend: el comercio entra y
 * opera por la misma pasarela que su portal web.
 */
const fs = require('fs');
const path = require('path');

const withCleartextWhenHttp = require('./plugins/with-cleartext-when-http');

const PUBLIC_KEYS = ['EXPO_PUBLIC_ATLAS_API_URL', 'EXPO_PUBLIC_ATLAS_TIMEOUT_MS'];

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function resolvePublicEnv(projectRoot) {
  const fromFiles = {
    ...parseEnvFile(path.join(projectRoot, '.env')),
    ...parseEnvFile(path.join(projectRoot, '.env.local')),
  };
  const resolved = {};
  for (const key of PUBLIC_KEYS) {
    const value = process.env[key] ?? fromFiles[key];
    if (value !== undefined && value !== '') resolved[key] = value;
  }
  return resolved;
}

/** Un build de EAS sin URL de la API no se construye: el error lo ve quien compila, no el comercio. */
function exigirUrlEnBuildDeEas(apiUrl, entorno = process.env) {
  const enEas = entorno.EAS_BUILD === 'true' || entorno.EAS_BUILD === '1' || Boolean(entorno.EAS_BUILD_PROFILE);
  if (enEas && !apiUrl) {
    throw new Error(
      `[app.config] El perfil de EAS «${entorno.EAS_BUILD_PROFILE ?? '?'}» no declara EXPO_PUBLIC_ATLAS_API_URL. ` +
        'Ponla en el bloque `env` del perfil en eas.json.',
    );
  }
}

module.exports = ({ config }) => {
  const env = resolvePublicEnv(__dirname);
  const apiUrl = env.EXPO_PUBLIC_ATLAS_API_URL;
  exigirUrlEnBuildDeEas(apiUrl);

  /*
    Misma forma que la app del cliente (`extra.atlas.apiUrl`): los componentes compartidos arrastran
    su `src/api/config.ts`, que la lee de ahí, aunque esta app nunca use ese cliente.
  */
  const extra = { ...config.extra, atlas: { apiUrl, timeoutMs: env.EXPO_PUBLIC_ATLAS_TIMEOUT_MS } };

  return withCleartextWhenHttp({ ...config, extra }, { apiUrl });
};

module.exports.exigirUrlEnBuildDeEas = exigirUrlEnBuildDeEas;
