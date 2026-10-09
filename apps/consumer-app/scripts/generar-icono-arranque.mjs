/**
 * Genera el icono del ARRANQUE NATIVO (`assets/splash-icon*.png`): el simbolo de la marca sobre fondo
 * TRANSPARENTE, para que el color de fondo lo ponga `app.json` (blanco en claro, casi negro en oscuro).
 *
 * Se corre al cambiar de marca (`docs/marca-y-temas.md`). Los colores salen del tema calculado:
 * `npx jest __tests__/temas-contraste.test.ts --verbose` los imprime («icono del arranque»).
 *
 * Uso:
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node scripts/generar-icono-arranque.mjs \
 *     <svg-del-simbolo> <colorLuz> <colorSombra> <colorTravesano> <salida.png>
 *   Si <svg-del-simbolo> es `atlas`, dibuja la «A» de Atlas (geometria de `src/ui/marca-letra.tsx`).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [simbolo, luz, sombra, travesano, salida] = process.argv.slice(2);
if (!salida) {
  console.error('Uso: node scripts/generar-icono-arranque.mjs <svg|atlas> <colorLuz> <colorSombra> <colorTravesano> <salida.png>');
  process.exit(1);
}
const ATLAS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path d="M24 5 L24 21 L14 43 H5 Z" fill="${luz}"/>
  <path d="M24 5 L43 43 H34 L24 21 Z" fill="${sombra}"/>
  <path d="M17.5 31 H30.5 L34 38 H14 Z" fill="${travesano}"/>
</svg>`;
const svg = simbolo === 'atlas' ? ATLAS : readFileSync(simbolo, 'utf8');

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1024, height: 1024 } });
// El simbolo ocupa el 42 % del lienzo: `imageWidth` en app.json lo escala al tamano final.
await pagina.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;height:1024px">
  <div style="width:430px;height:430px">${svg.replace('<svg', '<svg width="430" height="430"')}</div></body></html>`);
await pagina.screenshot({ path: salida, omitBackground: true });
await navegador.close();
console.log('escrito', salida);
