import { borrarCopiaLocal } from '../src/device/archivos';

/**
 * La copia temporal del extracto se borra de la caché tras subirlo, y NUNCA el original elegido.
 * El texto de la pantalla («la borra al terminar») depende de esto.
 */
const borrados: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: class {},
  File: class {
    uri: string;
    exists = true;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      borrados.push(this.uri);
    }
  },
}));

describe('borrarCopiaLocal', () => {
  beforeEach(() => {
    borrados.length = 0;
  });

  it('borra la copia que está dentro de la caché', () => {
    expect(borrarCopiaLocal('file:///cache/DocumentPicker/extracto.pdf')).toBe(true);
    expect(borrados).toEqual(['file:///cache/DocumentPicker/extracto.pdf']);
  });

  it('no toca un archivo fuera de la caché (el original de la persona)', () => {
    expect(borrarCopiaLocal('file:///Users/alguien/Documents/extracto.pdf')).toBe(false);
    expect(borrados).toEqual([]);
  });
});
