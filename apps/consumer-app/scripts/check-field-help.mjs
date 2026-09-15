#!/usr/bin/env node
/**
 * Guardián: ningún campo sin «qué poner», ninguna opción sin «qué significa».
 *
 * En móvil no hay ratón ni tooltip: la ayuda de un campo es la prop `ayuda`, que pinta un ⓘ junto
 * a la etiqueta y abre una hoja con la explicación (`src/ui/help-sheet.tsx`). Y la explicación de
 * una opción es su `detalle`, que se ve en la fila de la hoja y bajo el control al elegirla. Hasta
 * el 2026-09-15 casi ningún campo la tenía y 11 de 15 listas de opciones no decían qué significaba
 * cada fila. Esto impide que vuelva. Falla (exit 1, con `ruta:línea` y motivo) si en `app/` o
 * `src/`:
 *
 *   1. un `<IconField`, `<Field`, `<SelectField`, `<DateField`, `<PhoneField`, `<PinField`,
 *      `<AmountField`, `<CheckRow`, `<OptionGroup` o `<Switch` no lleva `ayuda`;
 *   2. un objeto de opción —`{ valor, etiqueta }` de `OpcionSelect`, `{ value, label }` de
 *      `OptionGroup` o `{ etiqueta }` de un catálogo— no lleva `detalle`;
 *   3. un texto de `ayuda` o `detalle` escrito en el código repite la etiqueta (sin tildes ni
 *      mayúsculas) o tiene menos de cuatro palabras.
 *
 * Qué hacer en su lugar: `ayuda="Qué poner y por qué importa. Ej.: …"` en el campo; `detalle:
 * 'Qué significa y cuándo elegirla'` en la opción. Una excepción legítima lleva
 * `// sin-ayuda: <motivo>` en la misma línea o en la de encima (p. ej. una lista de nombres propios:
 * departamentos, ciudades, zonas). Una `ayuda={expresión}` que llega del servidor cuenta como
 * presente: su redacción la comprueba quien la escribe, no la app.
 *
 * Los componentes se DEFINEN en `src/ui/` y ahí no se usan como campo de formulario: esa carpeta no
 * se recorre para la regla 1.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = (process.env.AYUDA_DIRS ?? 'app,src').split(',');
const EXCEPCION = /\/\/\s*sin-ayuda:/;
const CAMPOS = /<(IconField|Field|SelectField|DateField|PhoneField|PinField|AmountField|CheckRow|OptionGroup|Switch)(?=[\s<>/])/g;
const DEFINICIONES = /^src\/ui\//;

const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

function archivos(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(tsx?|jsx?)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/** Desde un `{`, hasta su llave de cierre, saltando cadenas. */
function objetoDesde(texto, inicio) {
  let profundidad = 0;
  let enCadena = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i += 1;
      else if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') enCadena = c;
    else if (c === '{') profundidad += 1;
    else if (c === '}') {
      profundidad -= 1;
      if (profundidad === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

/** Una etiqueta JSX hasta su `>` o `/>`, saltando `{…}`, cadenas y comentarios de línea. */
function etiquetaDesde(texto, inicio) {
  let llaves = 0;
  let enCadena = null;
  for (let i = inicio + 1; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i += 1;
      else if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === '/' && texto[i + 1] === '/') {
      i = texto.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') enCadena = c;
    else if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    // `<SelectField<Gender>`: el `>` del genérico no cierra la etiqueta.
    else if (c === '>' && llaves === 0 && texto[i - 1] !== '=' && !/<\w+$/.test(texto.slice(inicio + 1, i))) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

const lineaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;

/** El texto literal de `clave="…"`, `clave={'…'}`, `clave={`…`}` o `clave: '…'`; `null` si no es literal. */
function literal(bloque, clave) {
  const m = bloque.match(new RegExp(`\\b${clave}(?:=\\{?|:)\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`));
  return m ? m[2].replace(/\$\{[^}]*\}/g, ' x ') : null;
}
const tiene = (bloque, clave) => new RegExp(`\\b${clave}(=|\\s*:|\\s*,|\\s*\\})`).test(bloque);

function malRedactado(texto, etiqueta) {
  if (texto === null) return null;
  if (normalizar(texto).split(' ').filter(Boolean).length < 4) return 'tiene menos de cuatro palabras';
  if (etiqueta && normalizar(texto) === normalizar(etiqueta)) return 'repite la etiqueta';
  return null;
}

const hallazgos = [];
let campos = 0;
let opciones = 0;
for (const carpeta of CARPETAS) {
  let lista = [];
  try {
    lista = archivos(join(RAIZ, carpeta));
  } catch {
    continue;
  }
  for (const archivo of lista) {
    const texto = readFileSync(archivo, 'utf8');
    const lineas = texto.split('\n');
    const rel = relative(RAIZ, archivo).split('\\').join('/');
    const exenta = (linea) => EXCEPCION.test(lineas[linea - 1] ?? '') || EXCEPCION.test(lineas[linea - 2] ?? '');

    // 1 y 3. campos
    if (!DEFINICIONES.test(rel)) {
      for (const m of texto.matchAll(CAMPOS)) {
        const linea = lineaDe(texto, m.index);
        campos += 1;
        if (exenta(linea)) continue;
        const etiqueta = etiquetaDesde(texto, m.index);
        const rotulo = literal(etiqueta, 'label') ?? literal(etiqueta, 'accessibilityLabel') ?? '?';
        if (!tiene(etiqueta, 'ayuda')) {
          hallazgos.push(`${rel}:${linea}  <${m[1]}> «${rotulo}» sin ayuda: di qué poner y por qué importa`);
          continue;
        }
        const motivo = malRedactado(literal(etiqueta, 'ayuda'), rotulo);
        if (motivo) hallazgos.push(`${rel}:${linea}  la ayuda de <${m[1]}> «${rotulo}» ${motivo}`);
      }
    }

    // 2 y 3. opciones
    for (const m of texto.matchAll(/\{\s*(valor|value|etiqueta)\s*:/g)) {
      const objeto = objetoDesde(texto, m.index);
      // Un tipo (`{ valor: Canal; etiqueta: string }`) separa con `;`: no es una opción.
      if (/;/.test(objeto.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, ''))) continue;
      const esOpcion =
        m[1] === 'etiqueta' || (m[1] === 'valor' && tiene(objeto, 'etiqueta')) || (m[1] === 'value' && tiene(objeto, 'label'));
      if (!esOpcion) continue;
      const linea = lineaDe(texto, m.index);
      opciones += 1;
      if (exenta(linea)) continue;
      const rotulo = literal(objeto, 'etiqueta') ?? literal(objeto, 'label') ?? '?';
      if (!tiene(objeto, 'detalle')) {
        hallazgos.push(`${rel}:${linea}  opción «${rotulo}» sin detalle: di qué significa y cuándo elegirla`);
        continue;
      }
      const motivo = malRedactado(literal(objeto, 'detalle'), rotulo);
      if (motivo) hallazgos.push(`${rel}:${linea}  el detalle de «${rotulo}» ${motivo}`);
    }

    // 3. catálogos con `detalle` escrito aunque no se llamen `etiqueta` (p. ej. `ACTIVIDADES`)
    for (const m of texto.matchAll(/\{\s*codigo\s*:[^}]*\bdetalle\s*:/g)) {
      const objeto = objetoDesde(texto, m.index);
      const linea = lineaDe(texto, m.index);
      opciones += 1;
      if (exenta(linea)) continue;
      const rotulo = literal(objeto, 'nombre') ?? '?';
      const motivo = malRedactado(literal(objeto, 'detalle'), rotulo);
      if (motivo) hallazgos.push(`${rel}:${linea}  el detalle de «${rotulo}» ${motivo}`);
    }
  }
}

if (hallazgos.length) {
  console.error(`check-field-help: ${hallazgos.length} campo(s) u opción(es) sin explicar:\n`);
  for (const hallazgo of hallazgos) console.error(`  ${hallazgo}`);
  console.error('\nVer la cabecera de scripts/check-field-help.mjs para el arreglo o la excepción `// sin-ayuda: <motivo>`.');
  process.exit(1);
}
console.log(`check-field-help: ${campos} campos y ${opciones} opciones revisados; todos dicen qué poner y qué significan.`);
