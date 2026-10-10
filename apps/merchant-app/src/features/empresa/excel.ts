/**
 * Leer y escribir Excel (.xlsx) y CSV en el teléfono, sin dependencias.
 *
 * Es un PORTE de `AtlasERPFrontend/lib/excel.ts` y `lib/csv.ts`, con el mismo alcance deliberado:
 * una sola hoja (la primera), valores como texto, sin fórmulas ni formatos. Lo que se importa son
 * registros, no hojas de cálculo.
 *
 * Lo único que cambia son las dos piezas que la web toma del navegador y el teléfono no tiene:
 * `DecompressionStream` (el deflate, ahora en `inflar.ts`) y `DOMParser` (el XML). Un `.xlsx` usa un
 * XML muy pequeño y siempre igual —filas, celdas, cadenas compartidas, la relación del libro con su
 * primera hoja—, así que basta con buscar esos elementos por su nombre; no hace falta un analizador
 * XML completo. Los topes contra archivos hostiles (ASVS 12.1.1/12.1.2) son los mismos que en la web.
 */
import { DemasiadoGrande, inflar } from './inflar';
import { utf8 } from './utf8';

export const LIMITES_DE_LECTURA = {
  bytesArchivo: 10 * 1024 * 1024,
  entradasZip: 1000,
  bytesDescomprimidos: 50 * 1024 * 1024,
} as const;

function megas(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export interface TablaLeida {
  cabeceras: string[];
  filas: Record<string, string>[];
}

/* ───────────────────────── XML mínimo ───────────────────────── */

interface Elemento {
  atributos: Record<string, string>;
  interior: string;
}

const ENTIDADES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** El texto de un nodo, con las entidades resueltas (`&amp;` → `&`, `&#233;` → `é`). */
export function textoXml(crudo: string): string {
  return crudo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, nombre: string) => {
    if (nombre[0] === '#') {
      const punto = nombre[1] === 'x' || nombre[1] === 'X' ? parseInt(nombre.slice(2), 16) : parseInt(nombre.slice(1), 10);
      return Number.isFinite(punto) && punto <= 0x10ffff ? String.fromCodePoint(punto) : entera;
    }
    return ENTIDADES[nombre] ?? entera;
  });
}

function atributosDe(texto: string): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const [, nombre, , valor] of texto.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    if (nombre) atributos[nombre] = textoXml(valor ?? '');
  }
  return atributos;
}

/**
 * Los elementos con ESE nombre (sin prefijo, como `getElementsByTagName` de la web). Sirve porque
 * en un `.xlsx` ninguno de los que se buscan se anida dentro de otro del mismo nombre.
 */
export function elementos(xml: string, nombre: string): Elemento[] {
  const patron = new RegExp(`<${nombre}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</${nombre}\\s*>)`, 'g');
  return [...xml.matchAll(patron)].map((m) => ({ atributos: atributosDe(m[1] ?? ''), interior: m[2] ?? '' }));
}

/* ───────────────────────── Lectura ───────────────────────── */

/** Lee la primera hoja de un `.xlsx`, o un `.csv`; se distinguen por la firma (`PK` = ZIP). */
export function leerTabla(bytes: Uint8Array): TablaLeida {
  if (bytes.length > LIMITES_DE_LECTURA.bytesArchivo) {
    throw new Error(`El archivo pesa demasiado: el máximo es ${megas(LIMITES_DE_LECTURA.bytesArchivo)}. Divídelo en varios.`);
  }
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!esZip) return desdeCsv(utf8.decodificar(bytes));

  const entradas = abrirZip(bytes);
  const hoja = entradas.get(rutaDeLaPrimeraHoja(entradas));
  if (!hoja) throw new Error('El archivo no trae ninguna hoja legible.');
  const compartidas = leerCadenasCompartidas(entradas.get('xl/sharedStrings.xml'));
  return desdeHoja(utf8.decodificar(hoja), compartidas);
}

function desdeCsv(texto: string): TablaLeida {
  const filas = parseCsv(texto);
  const primera = filas[0];
  return { cabeceras: primera ? Object.keys(primera) : [], filas };
}

function columnaDeReferencia(referencia: string): number {
  const letras = referencia.replace(/[0-9]/g, '');
  let indice = 0;
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

/** Los `<t>` de un trozo, unidos: una cadena con formatos distintos llega partida en varios. */
function textosDe(xml: string): string {
  return elementos(xml, 't').map((t) => textoXml(t.interior)).join('');
}

function leerCadenasCompartidas(xml: Uint8Array | undefined): string[] {
  if (!xml) return [];
  return elementos(utf8.decodificar(xml), 'si').map((si) => textosDe(si.interior));
}

/** La hoja que el libro declara primera (workbook → rels); si falla, la primera que haya. */
function rutaDeLaPrimeraHoja(entradas: Map<string, Uint8Array>): string {
  const workbook = entradas.get('xl/workbook.xml');
  const rels = entradas.get('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const primera = elementos(utf8.decodificar(workbook), 'sheet')[0];
    const id = primera?.atributos['r:id'] ?? primera?.atributos.id;
    if (id) {
      const destino = elementos(utf8.decodificar(rels), 'Relationship').find((relacion) => relacion.atributos.Id === id)?.atributos.Target;
      if (destino) {
        const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
        if (entradas.has(ruta)) return ruta;
      }
    }
  }
  const alguna = [...entradas.keys()].find((nombre) => nombre.startsWith('xl/worksheets/') && nombre.endsWith('.xml'));
  return alguna ?? 'xl/worksheets/sheet1.xml';
}

function valorDeCelda(celda: Elemento, compartidas: string[]): string {
  const tipo = celda.atributos.t;
  const v = elementos(celda.interior, 'v')[0];
  if (tipo === 's') return compartidas[Number(textoXml(v?.interior ?? ''))] ?? '';
  if (tipo === 'inlineStr') return textosDe(celda.interior);
  return textoXml(v?.interior ?? '');
}

function desdeHoja(xml: string, compartidas: string[]): TablaLeida {
  const matriz = elementos(xml, 'row').map((fila) => {
    const celdas: string[] = [];
    for (const celda of elementos(fila.interior, 'c')) {
      const referencia = celda.atributos.r ?? '';
      const columna = referencia ? columnaDeReferencia(referencia) : celdas.length;
      celdas[columna] = valorDeCelda(celda, compartidas);
    }
    return celdas;
  });

  // La primera fila con algo escrito manda: un archivo real suele traer filas vacías arriba.
  const inicio = matriz.findIndex((fila) => fila.some((celda) => (celda ?? '').trim() !== ''));
  if (inicio === -1) return { cabeceras: [], filas: [] };
  const cabeceras = Array.from(matriz[inicio] ?? [], (celda) => (celda ?? '').trim());

  const filas = matriz
    .slice(inicio + 1)
    .filter((fila) => fila.some((celda) => (celda ?? '').trim() !== ''))
    .map((fila) =>
      cabeceras.reduce<Record<string, string>>((registro, cabecera, indice) => {
        if (cabecera) registro[cabecera] = (fila[indice] ?? '').trim();
        return registro;
      }, {}),
    );
  return { cabeceras: cabeceras.filter(Boolean), filas };
}

/** Número de serie de una fecha de Excel → `AAAA-MM-DD`. Ver el comentario de la web sobre 1900. */
export function fechaDeSerieExcel(serie: number): string {
  const dias = Math.round(serie);
  const base = dias < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10);
}

/* ───────────────────────── CSV ───────────────────────── */

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  values.push(current.trim());
  return values;
}

/** CSV a registros, con la primera fila como cabeceras. Igual que `parseCsv` de la web. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {});
  });
}

/* ───────────────────────── Escritura (la plantilla) ───────────────────────── */

export interface HojaExtra {
  nombre: string;
  filas: string[][];
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escaparXml = (texto: string) => texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter] ?? caracter);

function letraDeColumna(indice: number): string {
  let resto = indice + 1;
  let letras = '';
  while (resto > 0) {
    const modulo = (resto - 1) % 26;
    letras = String.fromCharCode(65 + modulo) + letras;
    resto = Math.floor((resto - modulo) / 26);
  }
  return letras;
}

function filaXml(valores: string[], numero: number): string {
  const celdas = valores
    .map((valor, columna) => `<c r="${letraDeColumna(columna)}${numero}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`)
    .join('');
  return `<row r="${numero}">${celdas}</row>`;
}

/**
 * La plantilla `.xlsx` como bytes: cabeceras, filas de ejemplo y las hojas de ayuda detrás.
 *
 * La web la entrega al navegador como descarga; en el teléfono la pantalla la guarda y abre la hoja
 * de compartir (`guardarArchivo`). Las entradas del ZIP van sin comprimir, como en la web.
 */
export function plantillaExcel(cabeceras: string[], ejemplos: string[][] = [], hojasExtra: HojaExtra[] = []): Uint8Array {
  const filas = [filaXml(cabeceras, 1), ...ejemplos.map((fila, indice) => filaXml(fila, indice + 2))].join('');
  const hojaXml = (contenido: string) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${contenido}</sheetData></worksheet>`;
  const hoja = hojaXml(filas);
  const extras = hojasExtra.map((extra) => hojaXml(extra.filas.map((fila, indice) => filaXml(fila, indice + 1)).join('')));

  const archivos: [string, string][] = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        extras
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 2}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('') +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Plantilla" sheetId="1" r:id="rId1"/>' +
        hojasExtra.map((extra, i) => `<sheet name="${escaparXml(extra.nombre.slice(0, 31))}" sheetId="${i + 2}" r:id="rId${i + 1 + 1}"/>`).join('') +
        '</sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        extras
          .map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 2}.xml"/>`)
          .join('') +
        '</Relationships>',
    ],
    ['xl/worksheets/sheet1.xml', hoja],
    ...extras.map((xml, i): [string, string] => [`xl/worksheets/sheet${i + 2}.xml`, xml]),
  ];
  return construirZip(archivos);
}

/* ───────────────────────── ZIP ───────────────────────── */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let indice = 0; indice < 256; indice += 1) {
    let valor = indice;
    for (let vuelta = 0; vuelta < 8; vuelta += 1) valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    tabla[indice] = valor >>> 0;
  }
  return tabla;
})();

function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of datos) crc = (crc >>> 8) ^ (TABLA_CRC[(crc ^ byte) & 0xff] as number);
  return (crc ^ 0xffffffff) >>> 0;
}

function construirZip(archivos: [string, string][]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const [nombre, texto] of archivos) {
    const nombreBytes = utf8.codificar(nombre);
    const datos = utf8.codificar(texto);
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombreBytes.length);
    const vistaLocal = new DataView(local.buffer);
    vistaLocal.setUint32(0, 0x04034b50, true);
    vistaLocal.setUint16(4, 20, true);
    vistaLocal.setUint32(14, crc, true);
    vistaLocal.setUint32(18, datos.length, true);
    vistaLocal.setUint32(22, datos.length, true);
    vistaLocal.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);
    partes.push(local, datos);

    const entrada = new Uint8Array(46 + nombreBytes.length);
    const vistaEntrada = new DataView(entrada.buffer);
    vistaEntrada.setUint32(0, 0x02014b50, true);
    vistaEntrada.setUint16(4, 20, true);
    vistaEntrada.setUint16(6, 20, true);
    vistaEntrada.setUint32(16, crc, true);
    vistaEntrada.setUint32(20, datos.length, true);
    vistaEntrada.setUint32(24, datos.length, true);
    vistaEntrada.setUint16(28, nombreBytes.length, true);
    vistaEntrada.setUint32(42, desplazamiento, true);
    entrada.set(nombreBytes, 46);
    central.push(entrada);

    desplazamiento += local.length + datos.length;
  }

  const tamanoCentral = central.reduce((total, parte) => total + parte.length, 0);
  const fin = new Uint8Array(22);
  const vistaFin = new DataView(fin.buffer);
  vistaFin.setUint32(0, 0x06054b50, true);
  vistaFin.setUint16(8, archivos.length, true);
  vistaFin.setUint16(10, archivos.length, true);
  vistaFin.setUint32(12, tamanoCentral, true);
  vistaFin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, fin];
  const salida = new Uint8Array(todo.reduce((suma, parte) => suma + parte.length, 0));
  let posicion = 0;
  for (const parte of todo) {
    salida.set(parte, posicion);
    posicion += parte.length;
  }
  return salida;
}

const MENSAJE_DEMASIADO_GRANDE = `El archivo descomprimido pasa de ${megas(LIMITES_DE_LECTURA.bytesDescomprimidos)}: no parece una plantilla de importación.`;

function abrirZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // El índice del ZIP está al FINAL, tras un comentario de longitud variable: se busca hacia atrás.
  let fin = -1;
  for (let posicion = bytes.length - 22; posicion >= Math.max(0, bytes.length - 66_000); posicion -= 1) {
    if (vista.getUint32(posicion, true) === 0x06054b50) {
      fin = posicion;
      break;
    }
  }
  if (fin === -1) throw new Error('El archivo no es un Excel válido (falta el índice del ZIP).');

  const cuantas = vista.getUint16(fin + 10, true);
  if (cuantas > LIMITES_DE_LECTURA.entradasZip) {
    throw new Error(`El archivo trae ${cuantas} piezas internas; un Excel válido no pasa de ${LIMITES_DE_LECTURA.entradasZip}.`);
  }
  let puntero = vista.getUint32(fin + 16, true);
  const entradas = new Map<string, Uint8Array>();
  const presupuesto = { restante: LIMITES_DE_LECTURA.bytesDescomprimidos };

  try {
    for (let numero = 0; numero < cuantas; numero += 1) {
      if (puntero + 46 > bytes.length || vista.getUint32(puntero, true) !== 0x02014b50) break;
      const metodo = vista.getUint16(puntero + 10, true);
      const comprimido = vista.getUint32(puntero + 20, true);
      const largoNombre = vista.getUint16(puntero + 28, true);
      const largoExtra = vista.getUint16(puntero + 30, true);
      const largoComentario = vista.getUint16(puntero + 32, true);
      const inicioLocal = vista.getUint32(puntero + 42, true);
      const nombre = utf8.decodificar(bytes.subarray(puntero + 46, puntero + 46 + largoNombre));

      if (inicioLocal + 30 > bytes.length) throw new Error('El archivo no es un Excel válido (una de sus piezas está dañada).');
      const nombreLocal = vista.getUint16(inicioLocal + 26, true);
      const extraLocal = vista.getUint16(inicioLocal + 28, true);
      const inicioDatos = inicioLocal + 30 + nombreLocal + extraLocal;
      const crudo = bytes.subarray(inicioDatos, inicioDatos + comprimido);

      // Sólo interesan las piezas que se van a leer: imágenes y temas no pintan nada aquí.
      if (nombre.endsWith('.xml') || nombre.endsWith('.rels')) {
        if (metodo === 0) {
          presupuesto.restante -= crudo.byteLength;
          if (presupuesto.restante < 0) throw new DemasiadoGrande(MENSAJE_DEMASIADO_GRANDE);
          entradas.set(nombre, crudo);
        } else {
          entradas.set(nombre, inflar(crudo, presupuesto, MENSAJE_DEMASIADO_GRANDE));
        }
      }
      puntero += 46 + largoNombre + largoExtra + largoComentario;
    }
  } catch (error) {
    if (error instanceof DemasiadoGrande) throw new Error(MENSAJE_DEMASIADO_GRANDE);
    throw error;
  }
  return entradas;
}
