/**
 * La web por HTTP plano no tiene `crypto.subtle` ni `crypto.randomUUID`: el respaldo en JavaScript
 * tiene que ser SHA-256 de verdad (el almacén compara la huella con el objeto) y un UUID v4 válido.
 */
import { Platform } from 'react-native';
import { nuevoUuid, sha256EnJs, sha256Hex, sha256HexDeTexto } from '../src/lib/criptografia';

// En jest `expo-crypto` es un doble que devuelve ceros: lo que se prueba aqui es el camino WEB.
beforeAll(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterAll(() => jest.restoreAllMocks());

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('criptografía portable', () => {
  it('sha256EnJs coincide con los vectores de FIPS 180-4', () => {
    expect(hex(sha256EnJs(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256EnJs(new Uint8Array(0)))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // Un mensaje de más de un bloque (56 bytes obliga a un segundo bloque de relleno).
    expect(hex(sha256EnJs(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('sha256Hex y sha256HexDeTexto dan lo mismo que el respaldo', async () => {
    const bytes = new TextEncoder().encode('atlas');
    expect(await sha256Hex(bytes)).toBe(hex(sha256EnJs(bytes)));
    expect(await sha256HexDeTexto('atlas')).toBe(hex(sha256EnJs(bytes)));
  });

  it('sin crypto.subtle (HTTP plano) el resultado es el mismo', async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: original.getRandomValues.bind(original) }, configurable: true });
    try {
      const bytes = new TextEncoder().encode('atlas');
      expect(await sha256Hex(bytes)).toBe(hex(sha256EnJs(bytes)));
      expect(nuevoUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });

  it('nuevoUuid es un UUID v4 distinto cada vez', () => {
    const a = nuevoUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(nuevoUuid()).not.toBe(a);
  });
});
