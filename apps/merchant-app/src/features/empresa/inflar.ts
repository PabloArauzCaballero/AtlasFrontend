/**
 * Descompresión DEFLATE «cruda» (RFC 1951): lo que hay dentro de cada pieza de un `.xlsx`.
 *
 * La web no la escribe: usa `DecompressionStream('deflate-raw')`, que trae el navegador. El motor
 * de JavaScript del teléfono no la trae, y la única librería que la daría (pako, fflate) no está
 * entre las dependencias de la app; añadir una sólo para leer una plantilla de dos columnas no
 * compensa, por el mismo motivo por el que la web no usa una librería de hojas de cálculo (ver
 * `lib/excel.ts` de la web). Es el algoritmo de `puff.c` de zlib, pasado a TypeScript.
 *
 * Conserva el tope de la web: se cuenta lo descomprimido MIENTRAS se descomprime y se corta en
 * cuanto pasa del presupuesto. Esperar al resultado entero sería dejar que una «bomba de
 * descompresión» explote antes de mirarla.
 */

export class DemasiadoGrande extends Error {}

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDEN = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huffman {
  cuenta: Uint16Array;
  simbolo: Uint16Array;
}

function construir(largos: ArrayLike<number>, n: number): Huffman {
  const cuenta = new Uint16Array(16);
  const simbolo = new Uint16Array(n);
  for (let i = 0; i < n; i += 1) cuenta[largos[i]!]! += 1;
  cuenta[0] = 0;
  const desde = new Uint16Array(16);
  for (let largo = 1; largo < 16; largo += 1) desde[largo] = desde[largo - 1]! + cuenta[largo - 1]!;
  for (let i = 0; i < n; i += 1) {
    const largo = largos[i]!;
    if (largo !== 0) simbolo[desde[largo]!++] = i;
  }
  return { cuenta, simbolo };
}

const FIJA_LIT = (() => {
  const largos = new Uint8Array(288);
  largos.fill(8, 0, 144);
  largos.fill(9, 144, 256);
  largos.fill(7, 256, 280);
  largos.fill(8, 280, 288);
  return construir(largos, 288);
})();
const FIJA_DIST = construir(new Uint8Array(30).fill(5), 30);

export function inflar(datos: Uint8Array, presupuesto: { restante: number }, mensaje = 'El archivo descomprimido es demasiado grande.'): Uint8Array {
  let pos = 0;
  let buffer = 0;
  let enBuffer = 0;
  let salida = new Uint8Array(Math.max(1024, datos.length * 4));
  let largo = 0;

  const corrupto = () => new Error('El archivo no es un Excel válido (una de sus piezas está dañada).');

  const bits = (n: number): number => {
    while (enBuffer < n) {
      if (pos >= datos.length) throw corrupto();
      buffer |= datos[pos++]! << enBuffer;
      enBuffer += 8;
    }
    const valor = buffer & ((1 << n) - 1);
    buffer >>>= n;
    enBuffer -= n;
    return valor;
  };

  const emitir = (byte: number) => {
    if (largo >= salida.length) {
      const mayor = new Uint8Array(salida.length * 2);
      mayor.set(salida);
      salida = mayor;
    }
    salida[largo++] = byte;
    presupuesto.restante -= 1;
    if (presupuesto.restante < 0) throw new DemasiadoGrande(mensaje);
  };

  const decodificar = (h: Huffman): number => {
    let codigo = 0;
    let primero = 0;
    let indice = 0;
    for (let l = 1; l < 16; l += 1) {
      codigo |= bits(1);
      const cuenta = h.cuenta[l]!;
      if (codigo - cuenta < primero) return h.simbolo[indice + (codigo - primero)]!;
      indice += cuenta;
      primero += cuenta;
      primero <<= 1;
      codigo <<= 1;
    }
    throw corrupto();
  };

  const bloqueComprimido = (lit: Huffman, dist: Huffman) => {
    for (;;) {
      const simbolo = decodificar(lit);
      if (simbolo < 256) emitir(simbolo);
      else if (simbolo === 256) return;
      else {
        const s = simbolo - 257;
        if (s >= 29) throw corrupto();
        const cuantos = LBASE[s]! + bits(LEXT[s]!);
        const d = decodificar(dist);
        if (d >= 30) throw corrupto();
        const atras = DBASE[d]! + bits(DEXT[d]!);
        if (atras > largo) throw corrupto();
        for (let i = 0; i < cuantos; i += 1) emitir(salida[largo - atras]!);
      }
    }
  };

  let ultimo = 0;
  do {
    ultimo = bits(1);
    const tipo = bits(2);
    if (tipo === 0) {
      buffer = 0;
      enBuffer = 0;
      if (pos + 4 > datos.length) throw corrupto();
      const n = datos[pos]! | (datos[pos + 1]! << 8);
      const complemento = datos[pos + 2]! | (datos[pos + 3]! << 8);
      pos += 4;
      if (n !== (~complemento & 0xffff) || pos + n > datos.length) throw corrupto();
      for (let i = 0; i < n; i += 1) emitir(datos[pos + i]!);
      pos += n;
    } else if (tipo === 1) {
      bloqueComprimido(FIJA_LIT, FIJA_DIST);
    } else if (tipo === 2) {
      const nLit = bits(5) + 257;
      const nDist = bits(5) + 1;
      const nCod = bits(4) + 4;
      const largosCod = new Uint8Array(19);
      for (let i = 0; i < nCod; i += 1) largosCod[ORDEN[i]!] = bits(3);
      const codigos = construir(largosCod, 19);
      const largos = new Uint8Array(nLit + nDist);
      let i = 0;
      while (i < nLit + nDist) {
        const simbolo = decodificar(codigos);
        if (simbolo < 16) {
          largos[i++] = simbolo;
          continue;
        }
        let repetir = 0;
        let valor = 0;
        if (simbolo === 16) {
          if (i === 0) throw corrupto();
          valor = largos[i - 1]!;
          repetir = 3 + bits(2);
        } else if (simbolo === 17) repetir = 3 + bits(3);
        else repetir = 11 + bits(7);
        if (i + repetir > nLit + nDist) throw corrupto();
        while (repetir-- > 0) largos[i++] = valor;
      }
      bloqueComprimido(construir(largos.subarray(0, nLit), nLit), construir(largos.subarray(nLit), nDist));
    } else {
      throw corrupto();
    }
  } while (!ultimo);

  return salida.slice(0, largo);
}
