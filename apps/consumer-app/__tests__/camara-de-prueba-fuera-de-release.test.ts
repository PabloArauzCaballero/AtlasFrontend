/**
 * APP-25: las imagenes sinteticas del carnet y la selfie NO viajan en un bundle de release.
 *
 * Se reproduce lo que hace Metro con `dev: false` ANTES de recoger dependencias —sustituir `__DEV__`
 * por `false` (`inlinePlugin`) y plegar las ramas muertas (`constantFoldingPlugin`)— y se comprueba
 * que no queda ningun `require` de `assets/dev/`. Si alguien saca un `require` del guardia, el
 * empaquetador lo vuelve a ver y las PNG vuelven al binario: esta prueba es la que lo nota.
 *
 * Medido el 2026-10-09 sobre `expo export --platform android`: con el guardia, ninguna de las cinco
 * PNG (por su md5) sale entre los assets; con `--dev`, salen las cinco.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Las dos son de la cadena de Metro y no publican tipos utiles para esto: se cargan como CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const babel = require('@babel/core');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { inlinePlugin, constantFoldingPlugin } = require('metro-transform-plugins');

const FUENTE = join(__dirname, '..', 'src', 'device', 'camara-de-prueba.ts');

function compilar(dev: boolean): string {
  const codigo = readFileSync(FUENTE, 'utf8');
  const js = babel.transformSync(codigo, {
    filename: FUENTE,
    babelrc: false,
    configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
  }).code as string;
  if (dev) return js;
  return babel.transformSync(js, {
    filename: 'camara-de-prueba.js',
    babelrc: false,
    configFile: false,
    plugins: [
      [inlinePlugin, { dev: false, inlinePlatform: true, platform: 'ios', isWrapped: false }],
      [constantFoldingPlugin, {}],
    ],
  }).code as string;
}

describe('camara de prueba (APP-25)', () => {
  it('en desarrollo las cinco imagenes siguen ahi', () => {
    expect(compilar(true).match(/assets\/dev\/[a-z-]+\.png/g)).toHaveLength(5);
  });

  it('en release no queda ningun require de assets/dev', () => {
    expect(compilar(false)).not.toMatch(/assets\/dev\//);
  });
});
