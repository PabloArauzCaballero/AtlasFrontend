/**
 * Configuracion de ESLint de la app.
 *
 * El script `lint` existia desde el principio y no podia ejecutarse: ni eslint estaba instalado ni
 * habia configuracion, asi que `npm run lint` moria con «eslint: command not found» y
 * `turbo run lint` en la raiz no comprobaba nada. Una comprobacion que no corre es peor que no
 * tenerla: aparenta que el codigo esta revisado.
 *
 * Se parte de `eslint-config-expo`, que es la que mantiene Expo para este stack: trae las reglas de
 * React, hooks y React Native ya afinadas para el runtime del movil. Encima solo van los ajustes
 * propios, y cada uno con su motivo.
 */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'node_modules/*', '.expo/*', 'nginx.web.conf'],
  },
  {
    /*
     * `tools/` son guiones de NODE, no codigo de la app: se ejecutan con `node` para sembrar datos
     * de desarrollo o generar recursos. Sin declarar sus globales, `Buffer` y `process` salian como
     * «no definido» — un fallo del entorno declarado, no del codigo.
     */
    files: ['tools/**/*.{js,mjs,cjs}', 'app.config.js', 'babel.config.js', 'jest.config.js', 'jest.setup.js', 'jest.env.js'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly',
        // `jest.setup.js` corre DENTRO de jest: `jest.mock` es su global, no un import.
        jest: 'readonly',
      },
    },
  },
  {
    rules: {
      /*
       * El proyecto escribe identificadores y comentarios en castellano, y muchos textos de
       * pantalla llevan tilde. La regla de importacion no aporta nada aqui y marcaba ficheros
       * enteros por el nombre.
       */
      'import/no-unresolved': 'off',
    },
  },
]);
