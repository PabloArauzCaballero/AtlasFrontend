/**
 * El lector de Excel/CSV y la plantilla de sucursales.
 *
 * Los `.xlsx` de prueba se arman aquí con el ZIP de node (deflate de verdad, como el que escribe
 * Excel), para probar el descompresor contra un compresor que no es el nuestro.
 */
import { deflateRawSync } from 'zlib';
import { inflar } from '@/features/empresa/inflar';
import { leerTabla, parseCsv, plantillaExcel } from '@/features/empresa/excel';
import {
  COLUMNAS_SUCURSALES,
  filasDeEjemplo,
  hojasDeAyuda,
  prepararImportacion,
  resumenDeColumnas,
} from '@/features/empresa/importacion';
import { utf8 } from '@/features/empresa/utf8';

/** Un ZIP mínimo con las entradas comprimidas por zlib (método 8). */
function zip(entradas: [string, string][], comprimir = true): Uint8Array {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let desplazamiento = 0;
  for (const [nombre, texto] of entradas) {
    const datos = Buffer.from(texto, 'utf8');
    const cuerpo = comprimir ? deflateRawSync(datos) : datos;
    const nombreB = Buffer.from(nombre);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(cuerpo.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreB.length, 26);
    partes.push(local, nombreB, cuerpo);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(comprimir ? 8 : 0, 10);
    entrada.writeUInt32LE(cuerpo.length, 20);
    entrada.writeUInt32LE(datos.length, 24);
    entrada.writeUInt16LE(nombreB.length, 28);
    entrada.writeUInt32LE(desplazamiento, 42);
    central.push(entrada, nombreB);
    desplazamiento += 30 + nombreB.length + cuerpo.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(tamCentral, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return new Uint8Array(Buffer.concat([...partes, ...central, fin]));
}

const LIBRO = [
  ['xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="Datos" sheetId="1" r:id="rId7"/></sheets></workbook>'],
  ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId7" Target="worksheets/hoja-rara.xml"/></Relationships>'],
  [
    'xl/sharedStrings.xml',
    '<sst><si><t>Sucursal *</t></si><si><r><t>Ciu</t></r><r><t xml:space="preserve">dad</t></r></si><si><t>Equipetrol &amp; Norte</t></si><si><t>la paz</t></si></sst>',
  ],
  [
    'xl/worksheets/hoja-rara.xml',
    '<worksheet><sheetData>' +
      '<row r="1"><c r="A1"/></row>' +
      '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="D2" t="inlineStr"><is><t>Cantidad de cajas</t></is></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="s"><v>3</v></c><c r="D3"><v>3</v></c></row>' +
      '</sheetData></worksheet>',
  ],
] as [string, string][];

describe('descompresor', () => {
  it('descomprime lo que comprime zlib, también bloques dinámicos largos', () => {
    const texto = Array.from({ length: 4000 }, (_, i) => `fila ${i} · ñandú ${i % 7}`).join('\n');
    const salida = inflar(new Uint8Array(deflateRawSync(Buffer.from(texto))), { restante: 10_000_000 });
    expect(utf8.decodificar(salida)).toBe(texto);
  });

  it('corta en cuanto lo descomprimido pasa del presupuesto (bomba de descompresión)', () => {
    const bomba = new Uint8Array(deflateRawSync(Buffer.alloc(2_000_000)));
    expect(() => inflar(bomba, { restante: 1000 }, 'demasiado')).toThrow('demasiado');
  });
});

describe('leerTabla', () => {
  it('sigue workbook → rels hasta la primera hoja, salta filas vacías y resuelve cadenas partidas', () => {
    const tabla = leerTabla(zip(LIBRO));
    expect(tabla.cabeceras).toEqual(['Sucursal *', 'Ciudad', 'Cantidad de cajas']);
    expect(tabla.filas).toEqual([{ 'Sucursal *': 'Equipetrol & Norte', Ciudad: 'la paz', 'Cantidad de cajas': '3' }]);
  });

  it('lee también entradas sin comprimir', () => {
    expect(leerTabla(zip(LIBRO, false)).filas).toHaveLength(1);
  });

  it('lee un CSV por su firma (no es ZIP), con comillas y BOM', () => {
    const csv = utf8.codificar('﻿Sucursal,Dirección\n"Centro, Mall",Av. 1\n');
    expect(leerTabla(csv)).toEqual({ cabeceras: ['Sucursal', 'Dirección'], filas: [{ Sucursal: 'Centro, Mall', Dirección: 'Av. 1' }] });
    expect(parseCsv('solo cabecera')).toEqual([]);
  });

  it('rechaza lo que no es un Excel o pesa demasiado', () => {
    expect(() => leerTabla(new Uint8Array([0x50, 0x4b, 1, 2, 3]))).toThrow('falta el índice del ZIP');
    expect(() => leerTabla(new Uint8Array(10 * 1024 * 1024 + 1))).toThrow('El archivo pesa demasiado: el máximo es 10 MB');
  });

  it('la plantilla que genera la app se vuelve a leer igual', () => {
    const bytes = plantillaExcel(
      COLUMNAS_SUCURSALES.map((c) => c.cabecera),
      filasDeEjemplo(),
      hojasDeAyuda(COLUMNAS_SUCURSALES),
    );
    const tabla = leerTabla(bytes);
    expect(tabla.cabeceras).toEqual(['Sucursal *', 'Ciudad', 'Dirección', 'Cantidad de cajas', 'Caja', 'Serial de la caja']);
    expect(tabla.filas[0]).toEqual({
      'Sucursal *': 'Sucursal Equipetrol',
      Ciudad: 'Santa Cruz de la Sierra',
      Dirección: 'Av. Principal #100, Equipetrol',
      'Cantidad de cajas': '0',
      Caja: 'Caja 1',
      'Serial de la caja': 'SN-00042',
    });
  });
});

describe('importación de sucursales', () => {
  it('dice cuántas columnas y obligatorias tiene la plantilla', () => {
    expect(resumenDeColumnas()).toBe('6 columnas · 1 obligatorias · hasta 500 filas por archivo');
  });

  it('agrupa por sucursal: la cabecera de la primera fila y una caja por fila', () => {
    const { filas, error } = prepararImportacion({
      cabeceras: ['Sucursal', 'city', 'Cantidad de cajas', 'Caja', 'Serial de la caja *'],
      filas: [
        { Sucursal: 'Centro', city: 'la paz', 'Cantidad de cajas': '2,0', Caja: 'Caja 1', 'Serial de la caja *': 'SN-1' },
        { Sucursal: 'Centro', city: 'Oruro', 'Cantidad de cajas': '', Caja: 'Caja 2', 'Serial de la caja *': 'SN-2' },
        { Sucursal: '', city: '', 'Cantidad de cajas': '', Caja: '', 'Serial de la caja *': '' },
      ],
    });
    expect(error).toBe('');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      numero: 2,
      filasHoja: [2, 3],
      etiqueta: 'Centro',
      errores: [],
      payload: {
        name: 'Centro',
        city: 'La Paz',
        cantidadCajas: 2,
        cajas: [
          { terminalAlias: 'Caja 1', terminalSerial: 'SN-1' },
          { terminalAlias: 'Caja 2', terminalSerial: 'SN-2' },
        ],
      },
    });
    expect(filas[1]?.errores).toEqual(['Falta «Sucursal»: sin ella no se sabe a qué registro pertenece la fila']);
  });

  it('rechaza una ciudad fuera del catálogo y una cantidad que no es número, nombrando el campo', () => {
    const { filas } = prepararImportacion({
      cabeceras: ['Sucursal *', 'Ciudad', 'Cantidad de cajas'],
      filas: [{ 'Sucursal *': 'Norte', Ciudad: 'Sta. Cruz', 'Cantidad de cajas': 'dos' }],
    });
    expect(filas[0]?.errores).toEqual([
      '«Ciudad» no admite «Sta. Cruz» (p. ej.: Santa Cruz de la Sierra, La Paz, El Alto)',
      '«Cantidad de cajas» debe ser un número finito',
    ]);
  });

  it('sin la columna «Sucursal» el archivo no sirve, y lo dice', () => {
    expect(prepararImportacion({ cabeceras: ['Ciudad'], filas: [{ Ciudad: 'Oruro' }] }).error).toBe(
      'Al archivo le faltan columnas obligatorias: Sucursal. Descarga la plantilla y vuelve a intentarlo.',
    );
    expect(prepararImportacion({ cabeceras: ['Sucursal'], filas: [] }).error).toBe('El archivo no trae ninguna fila con datos debajo de las cabeceras.');
  });
});
