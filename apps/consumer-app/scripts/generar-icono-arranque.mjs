/**
 * Genera los iconos del ARRANQUE NATIVO a partir de la marca: `assets/splash-icon.png` (fondo claro) y
 * `assets/splash-icon-oscuro.png` (fondo oscuro), con el simbolo sobre fondo TRANSPARENTE. El color de fondo lo pone
 * `app.json` (`expo-splash-screen`: blanco y `dark.backgroundColor`).
 *
 * Lee el simbolo (`simbolo.luz`, `simbolo.sombra`, `simbolo.detalle`, `simbolo.lienzo`) directamente de
 * `src/theme/marca.ts`, y ademas MIDE el perimetro de `simbolo.silueta` e imprime el valor de `simbolo.contorno`
 * (el arranque dibuja el simbolo trazo a trazo con ese largo): si cambia, se copia a `marca.ts`.
 *
 * Los colores salen del tema calculado: `npx jest __tests__/temas-contraste.test.ts --verbose` los imprime
 * («icono del arranque — claro: luz sombra detalle · oscuro: luz sombra detalle»).
 *
 * Uso (procedimiento completo en `docs/marca-y-temas.md`):
 *   PLAYWRIGHT_DIR=<carpeta con playwright> node scripts/generar-icono-arranque.mjs \
 *     <luzClaro> <sombraClaro> <detalleClaro> <luzOscuro> <sombraOscuro> <detalleOscuro>
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const colores = process.argv.slice(2);
if (colores.length !== 6) {
  console.error('Uso: node scripts/generar-icono-arranque.mjs <luzClaro> <sombraClaro> <detalleClaro> <luzOscuro> <sombraOscuro> <detalleOscuro>');
  process.exit(1);
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fuente = readFileSync(join(raiz, 'src/theme/marca.ts'), 'utf8');
const bloque = fuente.slice(fuente.indexOf('simbolo: {'));
const campo = (nombre) => {
  const m = new RegExp(`\\b${nombre}:\\s*'([^']*)'`).exec(bloque);
  return m ? m[1] : '';
};
const lienzo = Number(/\blienzo:\s*(\d+(?:\.\d+)?)/.exec(bloque)?.[1] ?? 48);
const simbolo = { silueta: campo('silueta'), luz: campo('luz'), sombra: campo('sombra'), detalle: campo('detalle') };
if (!simbolo.silueta) {
  console.error('No encontré `simbolo.silueta` en src/theme/marca.ts');
  process.exit(1);
}

const svg = (luz, sombra, detalle) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lienzo} ${lienzo}" width="430" height="430">
  ${simbolo.luz ? `<path d="${simbolo.luz}" fill="${luz}"/>` : `<path d="${simbolo.silueta}" fill="${luz}"/>`}
  ${simbolo.sombra ? `<path d="${simbolo.sombra}" fill="${sombra}"/>` : ''}
  ${simbolo.detalle ? `<path d="${simbolo.detalle}" fill="${detalle}"/>` : ''}
</svg>`;

const require = createRequire(process.env.PLAYWRIGHT_DIR ? join(process.env.PLAYWRIGHT_DIR, 'package.json') : import.meta.url);
const { chromium } = require('playwright');
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1024, height: 1024 } });

// El simbolo ocupa el 42 % del lienzo: `imageWidth` en app.json lo escala al tamano final.
for (const [salida, [luz, sombra, detalle]] of [
  ['assets/splash-icon.png', colores.slice(0, 3)],
  ['assets/splash-icon-oscuro.png', colores.slice(3, 6)],
]) {
  await pagina.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;height:1024px">${svg(luz, sombra, detalle)}</body></html>`);
  await pagina.screenshot({ path: join(raiz, salida), omitBackground: true });
  console.log('escrito', salida);
}

const contorno = await pagina.evaluate((d) => {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  return Math.ceil(p.getTotalLength());
}, simbolo.silueta);
console.log(`simbolo.contorno = ${contorno}  (cópialo a src/theme/marca.ts si es distinto)`);
await navegador.close();
