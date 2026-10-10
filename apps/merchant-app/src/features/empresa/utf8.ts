/**
 * UTF-8 a mano.
 *
 * La web usa `TextEncoder` y `TextDecoder` del navegador. En el teléfono el motor de JavaScript
 * (Hermes) trae el codificador pero no siempre el decodificador, y depender de lo que traiga cada
 * versión es la forma de que el lector de Excel funcione en el simulador y falle en un Android
 * viejo. Son veinte líneas y no dependen de nada.
 */

function codificar(texto: string): Uint8Array {
  const salida: number[] = [];
  for (const caracter of texto) {
    const punto = caracter.codePointAt(0) ?? 0;
    if (punto < 0x80) salida.push(punto);
    else if (punto < 0x800) salida.push(0xc0 | (punto >> 6), 0x80 | (punto & 0x3f));
    else if (punto < 0x10000) salida.push(0xe0 | (punto >> 12), 0x80 | ((punto >> 6) & 0x3f), 0x80 | (punto & 0x3f));
    else salida.push(0xf0 | (punto >> 18), 0x80 | ((punto >> 12) & 0x3f), 0x80 | ((punto >> 6) & 0x3f), 0x80 | (punto & 0x3f));
  }
  return Uint8Array.from(salida);
}

/** Decodifica tolerante: una secuencia rota sale como «�», igual que `TextDecoder` por defecto. */
function decodificar(bytes: Uint8Array): string {
  let salida = '';
  let i = 0;
  // La marca de orden de bytes que Excel pone al principio de un CSV no es texto.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  const trozo: number[] = [];
  const vaciar = () => {
    salida += String.fromCodePoint(...trozo);
    trozo.length = 0;
  };
  while (i < bytes.length) {
    const b = bytes[i]!;
    let punto = 0xfffd;
    let largo = 1;
    if (b < 0x80) punto = b;
    else if (b >= 0xc2 && b < 0xe0 && i + 1 < bytes.length) {
      punto = ((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f);
      largo = 2;
    } else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length) {
      punto = ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f);
      largo = 3;
    } else if (b >= 0xf0 && b < 0xf5 && i + 3 < bytes.length) {
      punto = ((b & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f);
      largo = 4;
    }
    trozo.push(punto > 0x10ffff ? 0xfffd : punto);
    if (trozo.length >= 4096) vaciar();
    i += largo;
  }
  vaciar();
  return salida;
}

export const utf8 = { codificar, decodificar };
