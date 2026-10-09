/**
 * Ningun color fuera de `src/theme/`.
 *
 * El rediseno de 2026-10 movio la app entera a un tema claro cambiando VALORES en `src/theme/` y no
 * pantallas. Eso solo es posible mientras ninguna pantalla ni primitiva escriba un color: el dia que
 * una escribe `#2BE0A8` a mano, ese pixel ya no cambia con el tema y la app vuelve a tener dos
 * identidades. Esta prueba falla en cuanto aparece un literal de color o una importacion de la paleta
 * cruda fuera de `src/theme/`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..');
const CARPETAS = ['app', 'src'];
const FUERA = [join(RAIZ, 'src', 'theme')];

/** Un color hexadecimal (`#fff`, `#2BE0A8`, `#2BD9A133`) cuando va como VALOR: tras comilla, `=`, `:`, espacio o `(`. */
const HEX = /(?<=['"`=:\s(,])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z_-])/g;
/** `rgb(…)`/`rgba(…)` con numeros escritos: `rgba(var(--b2-rgb),.16)` sale de una variable y vale. */
const RGB = /rgba?\(\s*\d/g;
const PALETA = /from '[./]*(?:src\/)?theme\/palette'|\bpalette\./g;

/** Excepciones con nombre y motivo. Cada una es un SELECTOR o un dato de terceros, nunca un color de diseno. */
const PERMITIDO = [
  // React Navigation pinta cada pantalla sobre ese gris con estilo EN LINEA: la hoja web lo busca para anularlo.
  'div[style*="background-color: rgb(242, 242, 242)"]',
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (FUERA.includes(ruta) || n === 'node_modules') return [];
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) ? [ruta] : [];
  });
}

describe('colores: solo desde los tokens', () => {
  const hallazgos: string[] = [];
  for (const archivo of CARPETAS.flatMap((c) => archivos(join(RAIZ, c)))) {
    readFileSync(archivo, 'utf8')
      .split('\n')
      .forEach((linea, i) => {
        let limpia = linea;
        for (const p of PERMITIDO) limpia = limpia.split(p).join('');
        // Los comentarios pueden citar un valor para explicar un token.
        if (/^\s*(\*|\/\/|\/\*)/.test(limpia)) return;
        const malos = [...(limpia.match(HEX) ?? []), ...(limpia.match(RGB) ?? []), ...(limpia.match(PALETA) ?? [])];
        if (malos.length) hallazgos.push(`${relative(RAIZ, archivo)}:${i + 1} ${malos.join(' ')}`);
      });
  }

  it('ningun archivo fuera de src/theme escribe un color ni importa la paleta cruda', () => {
    expect(hallazgos).toEqual([]);
  });
});
