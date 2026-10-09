/**
 * Metro para la app del comercio.
 *
 * La app comparte el aspecto con su hermana, la app del cliente, importando sus MISMOS archivos
 * (`@cliente/*` → `apps/consumer-app/src/*`) en vez de copiarlos: así el día que el cliente cambia
 * un color o un botón, el comercio cambia con él. Ver `README.md`.
 *
 * Eso trae una trampa: un archivo de `consumer-app/src` resuelve sus paquetes desde su propia
 * carpeta, y `apps/consumer-app/node_modules` tiene su copia de `react` (la app la fija exacta). Dos
 * React en el mismo árbol = «Invalid hook call» al primer render. Por eso todo import de PAQUETE que
 * salga de `consumer-app/src` se resuelve como si saliera de esta app: una sola copia de cada uno.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const cliente = path.resolve(__dirname, '../consumer-app/src');
const raizPropia = path.join(__dirname, 'app', '_layout.tsx');

const esPaquete = (nombre) => !nombre.startsWith('.') && !nombre.startsWith('/');

config.watchFolders = [...(config.watchFolders ?? []), cliente];
config.resolver.extraNodeModules = { ...config.resolver.extraNodeModules, '@cliente': cliente };

const resolverPrevio = config.resolver.resolveRequest;
config.resolver.resolveRequest = (contexto, nombre, plataforma) => {
  const resolver = resolverPrevio ?? contexto.resolveRequest;
  if (nombre.startsWith('@cliente/')) {
    return resolver(contexto, path.join(cliente, nombre.slice('@cliente/'.length)), plataforma);
  }
  if (esPaquete(nombre) && contexto.originModulePath.startsWith(cliente + path.sep)) {
    return resolver({ ...contexto, originModulePath: raizPropia }, nombre, plataforma);
  }
  return resolver(contexto, nombre, plataforma);
};

module.exports = config;
