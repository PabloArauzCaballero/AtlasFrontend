/**
 * Configuracion dinamica de la app. Extiende `app.json`, que sigue siendo la base estatica.
 *
 * ## Por que existe este fichero
 *
 * Resuelve dos problemas que solo aparecen al construir el binario de release:
 *
 * **1. El `.env` no llegaba al bundle.** `expo start` carga los `.env` por su cuenta, pero Gradle
 * invoca `expo export:embed`, y ahi la carga no esta documentada ni garantizada. El binario acababa
 * con el valor por defecto que tiene el codigo —una IP de desarrollo—, aunque se hubiera compilado
 * «con el `.env` de produccion». Es un riesgo de publicacion: un release que apunta a una IP
 * privada arranca, no falla al compilar, y solo se descubre cuando ningun cliente puede entrar.
 *
 * Aqui el `.env` se lee de forma explicita y sus valores se copian a `extra.atlas`. El plugin de
 * Gradle de `expo-constants` serializa esta configuracion en los assets **en cada compilacion**, asi
 * que lo que se lee aqui es lo que viaja dentro del APK y lo que la app ve en `Constants`.
 *
 * **2. El trafico en claro.** Ver `plugins/with-cleartext-when-http.js`: el permiso se concede solo
 * si la direccion configurada es `http://`, y solo para ese host.
 *
 * ## Que fichero gana
 *
 * `.env.local` sobre `.env`, y cualquier variable ya presente en el entorno sobre las dos. Es el
 * orden que espera quien construye desde CI: exportar la variable en el runner tiene que bastar
 * para mandar sobre lo que haya en el repositorio.
 *
 * No se usa `dotenv` porque no es dependencia del proyecto y este formato —`CLAVE=valor`, con
 * comentarios— no necesita una libreria para leerse.
 */
const fs = require('fs');
const path = require('path');

const withCleartextWhenHttp = require('./plugins/with-cleartext-when-http');

/** Variables que la app consume. Se declaran para no volcar el entorno entero dentro del binario. */
const PUBLIC_KEYS = [
  'EXPO_PUBLIC_ATLAS_API_URL',
  'EXPO_PUBLIC_ATLAS_TENANT_ID',
  'EXPO_PUBLIC_ATLAS_TIMEOUT_MS',
  'EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE',
  'EXPO_PUBLIC_ATLAS_DECISION_SOURCE',
];

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
    // Se admiten comillas porque las plantillas las usan; el valor es lo de dentro.
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

module.exports = ({ config }) => {
  const env = resolvePublicEnv(__dirname);
  const apiUrl = env.EXPO_PUBLIC_ATLAS_API_URL;

  /*
   * La clave del mapa de Android, si la hay.
   *
   * `expo-maps` usa Apple Maps en iOS —que no pide clave— y Google Maps en Android, que SÍ la pide:
   * sin ella el mapa se monta y se queda en gris, sin error y sin nada que explique por qué. Se lee
   * del entorno y no se versiona: una clave de Maps se restringe por paquete y huella SHA-1, pero
   * dejarla en el repositorio la convierte igualmente en algo que rotar el día que se filtre.
   *
   * Si no está definida, el bloque no se añade y la compilación de Android sigue siendo válida: lo
   * único que no funcionará es el mapa del domicilio, que es opcional.
   */
  const androidMapsKey = process.env.ANDROID_MAPS_API_KEY;

  const withExtra = {
    ...config,
    ...(androidMapsKey
      ? {
          android: {
            ...config.android,
            config: { ...config.android?.config, googleMaps: { apiKey: androidMapsKey } },
          },
        }
      : {}),
    extra: {
      ...config.extra,
      /*
        Se agrupan bajo `atlas` en vez de esparcirse por `extra`: `extra` es un cajon compartido con
        los plugins —EAS mete ahi su `projectId`— y una clave suelta llamada `apiUrl` es una colision
        esperando a ocurrir.
      */
      atlas: {
        apiUrl,
        tenantId: env.EXPO_PUBLIC_ATLAS_TENANT_ID,
        timeoutMs: env.EXPO_PUBLIC_ATLAS_TIMEOUT_MS,
        purchaseSource: env.EXPO_PUBLIC_ATLAS_PURCHASE_SOURCE,
        decisionSource: env.EXPO_PUBLIC_ATLAS_DECISION_SOURCE,
      },
    },
  };

  return withCleartextWhenHttp(withExtra, { apiUrl });
};
