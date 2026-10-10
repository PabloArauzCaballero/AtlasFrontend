/**
 * El QR de una caja: QUÉ lleva dentro y su matriz.
 *
 * Es un PORTE de `AtlasERPFrontend/lib/qr.ts` (el generador sin dependencias del portal web). Lo que
 * el QR lleva dentro es el SERIAL DEL TERMINAL —el mismo dato que `merchant-qr/resolve` cambia por
 * el expediente del comercio— y nada más: si el QR trajera el nombre del negocio, el teléfono del
 * cliente lo enseñaría sin que nadie lo hubiera verificado, y bastaría imprimir un QR con el nombre
 * de otro para comprar «en» ese otro (ver `QrCanvas.tsx` de la web).
 *
 * En pantalla el QR lo dibuja `react-native-qrcode-svg` con ese mismo contenido y el mismo nivel de
 * corrección (M). Aquí vive el generador de la web porque el CARTEL (`cartel.ts`) se compone como
 * un único SVG que luego se convierte en PNG, y para eso hace falta la matriz como datos, igual que
 * la usa `lib/cartelQr.ts`. Las pruebas comprueban que esta matriz es la MISMA que da la librería
 * de pantalla con la misma máscara: un QR mal generado no falla de forma visible —se ve igual de
 * cuadriculado— y el error aparece recién en la caja, con el cliente delante.
 *
 * Modo byte y nivel de corrección M, versiones 1 a 10 (hasta 213 bytes UTF-8). Por encima se lanza
 * en vez de recortar el contenido en silencio, que produciría un QR válido apuntando a otra cosa.
 */
import { utf8 } from './utf8';

/** Lo que va dentro del QR de una caja. Una función y no un acceso suelto para que haya UN sitio. */
export function contenidoDelQrDeCaja(caja: { terminalSerial: string }): string {
  return caja.terminalSerial;
}

/** Nivel de corrección: el de la web. La librería de pantalla lo recibe en su prop `ecl`. */
export const NIVEL_DE_CORRECCION = 'M' as const;

/** Bloques y corrección por versión, para nivel M. */
const ECC_M: Record<number, { ecPerBlock: number; g1: number; g1Data: number; g2: number; g2Data: number }> = {
  1: { ecPerBlock: 10, g1: 1, g1Data: 16, g2: 0, g2Data: 0 },
  2: { ecPerBlock: 16, g1: 1, g1Data: 28, g2: 0, g2Data: 0 },
  3: { ecPerBlock: 26, g1: 1, g1Data: 44, g2: 0, g2Data: 0 },
  4: { ecPerBlock: 18, g1: 2, g1Data: 32, g2: 0, g2Data: 0 },
  5: { ecPerBlock: 24, g1: 2, g1Data: 43, g2: 0, g2Data: 0 },
  6: { ecPerBlock: 16, g1: 4, g1Data: 27, g2: 0, g2Data: 0 },
  7: { ecPerBlock: 18, g1: 4, g1Data: 31, g2: 0, g2Data: 0 },
  8: { ecPerBlock: 22, g1: 2, g1Data: 38, g2: 2, g2Data: 39 },
  9: { ecPerBlock: 22, g1: 3, g1Data: 36, g2: 2, g2Data: 37 },
  10: { ecPerBlock: 26, g1: 4, g1Data: 43, g2: 1, g2Data: 44 },
};

const ALIGNMENT: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

/** Cadena de versión, ya con su BCH. Sólo hace falta de la 7 en adelante. */
const VERSION_INFO: Record<number, number> = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

/** Cadena de formato para nivel M, indexada por máscara. */
const FORMAT_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

// --- GF(256) ---------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!;
})();

const gfMul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ gfMul(poly[j]!, 1);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: number[], ecLength: number): number[] {
  const gen = generatorPoly(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLength; i += 1) remainder[i] = remainder[i]! ^ gfMul(gen[i + 1]!, factor);
    }
  }
  return remainder;
}

// --- Codificación ----------------------------------------------------------

const totalData = (version: number): number => {
  const spec = ECC_M[version]!;
  return spec.g1 * spec.g1Data + spec.g2 * spec.g2Data;
};

function pickVersion(byteLength: number): number {
  for (let version = 1; version <= 10; version += 1) {
    const countBits = version < 10 ? 8 : 16;
    if (byteLength * 8 + 4 + countBits <= totalData(version) * 8) return version;
  }
  throw new Error('QR_CONTENT_TOO_LONG');
}

function encodeData(bytes: number[], version: number): number[] {
  const capacityBits = totalData(version) * 8;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // modo byte
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j]!;
    codewords.push(value);
  }
  const pad = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < totalData(version)) {
    codewords.push(pad[padIndex % 2]!);
    padIndex += 1;
  }
  return codewords;
}

function interleave(codewords: number[], version: number): number[] {
  const spec = ECC_M[version]!;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < spec.g1; i += 1) {
    const block = codewords.slice(offset, offset + spec.g1Data);
    offset += spec.g1Data;
    blocks.push(block);
    ecBlocks.push(reedSolomon(block, spec.ecPerBlock));
  }
  for (let i = 0; i < spec.g2; i += 1) {
    const block = codewords.slice(offset, offset + spec.g2Data);
    offset += spec.g2Data;
    blocks.push(block);
    ecBlocks.push(reedSolomon(block, spec.ecPerBlock));
  }
  const result: number[] = [];
  const maxData = Math.max(...blocks.map((block) => block.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) if (i < block.length) result.push(block[i]!);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of ecBlocks) result.push(block[i]!);
  }
  return result;
}

// --- Matriz ----------------------------------------------------------------

type Matrix = { size: number; modules: Int8Array; reserved: Uint8Array };

const at = (m: Matrix, row: number, col: number): number => m.modules[row * m.size + col]!;
const set = (m: Matrix, row: number, col: number, value: number, reserve = true) => {
  m.modules[row * m.size + col] = value;
  if (reserve) m.reserved[row * m.size + col] = 1;
};
const isReserved = (m: Matrix, row: number, col: number): boolean => m.reserved[row * m.size + col] === 1;

function placeFunctionPatterns(m: Matrix, version: number): void {
  const finder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || col < 0 || row >= m.size || col >= m.size) continue;
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inRing && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(m, row, col, dark ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, m.size - 7);
  finder(m.size - 7, 0);

  for (let i = 8; i < m.size - 8; i += 1) {
    set(m, 6, i, i % 2 === 0 ? 1 : 0);
    set(m, i, 6, i % 2 === 0 ? 1 : 0);
  }

  const centers = ALIGNMENT[version]!;
  for (const row of centers) {
    for (const col of centers) {
      const nearFinder = (row <= 8 && col <= 8) || (row <= 8 && col >= m.size - 9) || (row >= m.size - 9 && col <= 8);
      if (nearFinder) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          set(m, row + r, col + c, dark ? 1 : 0);
        }
      }
    }
  }

  set(m, m.size - 8, 8, 1);

  for (let i = 0; i < 9; i += 1) {
    if (!isReserved(m, 8, i)) set(m, 8, i, 0);
    if (!isReserved(m, i, 8)) set(m, i, 8, 0);
  }
  for (let i = 0; i < 8; i += 1) {
    if (!isReserved(m, 8, m.size - 1 - i)) set(m, 8, m.size - 1 - i, 0);
    if (!isReserved(m, m.size - 1 - i, 8)) set(m, m.size - 1 - i, 8, 0);
  }

  if (version >= 7) {
    const info = VERSION_INFO[version]!;
    for (let i = 0; i < 18; i += 1) {
      const bit = (info >> i) & 1;
      const row = Math.floor(i / 3);
      const col = m.size - 11 + (i % 3);
      set(m, row, col, bit);
      set(m, col, row, bit);
    }
  }
}

function placeData(m: Matrix, data: number[]): void {
  let bitIndex = 0;
  let upward = true;
  for (let right = m.size - 1; right > 0; right -= 2) {
    const col2 = right === 6 ? right - 1 : right;
    const colPair = col2 === right ? [right, right - 1] : [col2, col2 - 1];
    for (let step = 0; step < m.size; step += 1) {
      const row = upward ? m.size - 1 - step : step;
      for (const col of colPair) {
        if (isReserved(m, row, col)) continue;
        const bit = bitIndex < data.length * 8 ? (data[bitIndex >> 3]! >> (7 - (bitIndex & 7))) & 1 : 0;
        bitIndex += 1;
        m.modules[row * m.size + col] = bit;
      }
    }
    upward = !upward;
    if (col2 !== right) right -= 1;
  }
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(m: Matrix, mask: number): Matrix {
  const copy: Matrix = { size: m.size, modules: Int8Array.from(m.modules), reserved: m.reserved };
  for (let row = 0; row < m.size; row += 1) {
    for (let col = 0; col < m.size; col += 1) {
      if (isReserved(m, row, col)) continue;
      if (MASKS[mask]!(row, col)) copy.modules[row * m.size + col] = at(m, row, col) ^ 1;
    }
  }
  return copy;
}

/** Las dos copias de la cadena de formato (ISO/IEC 18004 §7.9.1). Ver el comentario de la web. */
function writeFormat(m: Matrix, mask: number): void {
  const bits = FORMAT_M[mask]!;
  for (let i = 0; i < 15; i += 1) {
    const bit = (bits >> i) & 1;
    if (i < 6) m.modules[i * m.size + 8] = bit;
    else if (i === 6) m.modules[7 * m.size + 8] = bit;
    else if (i === 7) m.modules[8 * m.size + 8] = bit;
    else if (i === 8) m.modules[8 * m.size + 7] = bit;
    else m.modules[8 * m.size + (14 - i)] = bit;
    if (i < 8) m.modules[8 * m.size + (m.size - 1 - i)] = bit;
    else m.modules[(m.size - 15 + i) * m.size + 8] = bit;
  }
}

function penalty(m: Matrix): number {
  const size = m.size;
  let score = 0;
  const runScore = (line: number[]) => {
    let run = 1;
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === line[i - 1]) run += 1;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  const filas: number[][] = [];
  const columnas: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < size; col += 1) line.push(at(m, row, col));
    filas.push(line);
  }
  for (let col = 0; col < size; col += 1) {
    const line: number[] = [];
    for (let row = 0; row < size; row += 1) line.push(at(m, row, col));
    columnas.push(line);
  }
  filas.forEach(runScore);
  columnas.forEach(runScore);

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const v = at(m, row, col);
      if (v === at(m, row, col + 1) && v === at(m, row + 1, col) && v === at(m, row + 1, col + 1)) score += 3;
    }
  }

  const pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const reversed = [...pattern].reverse();
  const matches = (line: number[], start: number, target: number[]) => target.every((value, index) => line[start + index] === value);
  const scanLine = (line: number[]) => {
    for (let i = 0; i + 11 <= line.length; i += 1) {
      if (matches(line, i, pattern) || matches(line, i, reversed)) score += 40;
    }
  };
  filas.forEach(scanLine);
  columnas.forEach(scanLine);

  let dark = 0;
  for (let i = 0; i < size * size; i += 1) if (m.modules[i] === 1) dark += 1;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/** La matriz con los datos de cómo se codificó (para las pruebas: versión y máscara elegidas). */
export function qrCodificado(content: string): { matriz: boolean[][]; version: number; mascara: number } {
  const bytes = Array.from(utf8.codificar(content));
  const version = pickVersion(bytes.length);
  const codewords = interleave(encodeData(bytes, version), version);

  const size = 17 + version * 4;
  const base: Matrix = { size, modules: new Int8Array(size * size), reserved: new Uint8Array(size * size) };
  placeFunctionPatterns(base, version);
  placeData(base, codewords);

  let best: Matrix | null = null;
  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(base, mask);
    writeFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
      bestMask = mask;
    }
  }

  const chosen = best!;
  const rows: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col += 1) line.push(at(chosen, row, col) === 1);
    rows.push(line);
  }
  return { matriz: rows, version, mascara: bestMask };
}

/** La matriz del QR: `true` es módulo oscuro. Igual que `qrMatrix` de la web. */
export function qrMatrix(content: string): boolean[][] {
  return qrCodificado(content).matriz;
}
