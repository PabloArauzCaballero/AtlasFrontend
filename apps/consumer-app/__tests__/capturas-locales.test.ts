/**
 * APP-10: las fotos del carnet, las selfies y los escaneos no se quedan en el teléfono.
 *
 * En iOS el escáner deja el carnet en `tmp/` (`NSTemporaryDirectory()`), fuera de la caché: también
 * se borra. Nada fuera de la caché y de `tmp/` se toca nunca.
 */
import { Platform } from 'react-native';
import { borrarCopiaLocal, directoriosTemporales, vaciarCopiasLocales } from '../src/device/archivos';
import { CapturasLocales } from '../src/features/capturas-locales';

const mockBorrados: string[] = [];
const mockArbol: Record<string, { nombre: string; carpeta: boolean }[]> = {};

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = true;
    constructor(uri: string) {
      this.uri = uri;
    }
    get name() {
      return this.uri.split('/').filter(Boolean).pop() ?? '';
    }
    delete() {
      mockBorrados.push(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(uri: string) {
      this.uri = uri.endsWith('/') ? uri : `${uri}/`;
    }
    get name() {
      return this.uri.split('/').filter(Boolean).pop() ?? '';
    }
    list() {
      return (mockArbol[this.uri] ?? []).map((e) => (e.carpeta ? new Directory(`${this.uri}${e.nombre}/`) : new File(`${this.uri}${e.nombre}`)));
    }
    delete() {
      mockBorrados.push(this.uri);
    }
  }
  return {
    Paths: {
      cache: { uri: 'file:///var/mobile/Containers/Data/Application/APP/Library/Caches/' },
      document: { uri: 'file:///var/mobile/Containers/Data/Application/APP/Documents/' },
    },
    Directory,
    File,
  };
});

const CACHE = 'file:///var/mobile/Containers/Data/Application/APP/Library/Caches/';
const TMP = 'file:///var/mobile/Containers/Data/Application/APP/tmp/';
const UUID = '0F8A6C2E-1B3D-4E5F-8A9B-1C2D3E4F5A6B';
const original = Platform.OS;

beforeEach(() => {
  mockBorrados.length = 0;
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
});

describe('borrarCopiaLocal', () => {
  it('en iOS conoce la caché y tmp/', () => {
    expect(directoriosTemporales()).toEqual([CACHE, TMP]);
  });

  it('borra el carnet que el escáner dejó en tmp/, aunque llegue con /private delante', () => {
    expect(borrarCopiaLocal(`file:///private/var/mobile/Containers/Data/Application/APP/tmp/${UUID}.jpg`)).toBe(true);
    expect(borrarCopiaLocal(`${CACHE}Camera/foto.jpg`)).toBe(true);
    expect(mockBorrados).toHaveLength(2);
  });

  it('nunca toca Documents ni un archivo que eligió la persona', () => {
    expect(borrarCopiaLocal('file:///var/mobile/Containers/Data/Application/APP/Documents/extracto.pdf')).toBe(false);
    expect(borrarCopiaLocal('file:///var/mobile/Media/DCIM/100APPLE/IMG_0001.JPG')).toBe(false);
    expect(mockBorrados).toEqual([]);
  });
});

describe('vaciarCopiasLocales (cerrar sesión)', () => {
  it('vacía las carpetas de capturas y los sueltos del escáner, y deja lo demás', () => {
    mockArbol[CACHE] = [
      { nombre: 'Camera', carpeta: true },
      { nombre: 'ImagePicker', carpeta: true },
      { nombre: 'DocumentPicker', carpeta: true },
      { nombre: 'atlas-descargas', carpeta: true },
      { nombre: 'com.hackemist.SDImageCache', carpeta: true },
      { nombre: `${UUID}.jpg`, carpeta: false },
      { nombre: 'otra-cosa.json', carpeta: false },
    ];
    mockArbol[TMP] = [
      { nombre: `${UUID.toLowerCase()}.png`, carpeta: false },
      { nombre: 'notas.txt', carpeta: false },
    ];

    vaciarCopiasLocales();

    expect(mockBorrados.sort()).toEqual(
      [
        `${CACHE}Camera/`,
        `${CACHE}ImagePicker/`,
        `${CACHE}DocumentPicker/`,
        `${CACHE}atlas-descargas/`,
        `${CACHE}${UUID}.jpg`,
        `${TMP}${UUID.toLowerCase()}.png`,
      ].sort(),
    );
  });
});

describe('CapturasLocales (pantalla de identidad)', () => {
  it('al repetir una foto borra la anterior; al terminar, todas', () => {
    const capturas = new CapturasLocales();
    capturas.anotar(`${CACHE}Camera/frente-1.jpg`);
    capturas.reemplazar(undefined, `${CACHE}Camera/frente-1.jpg`);
    expect(mockBorrados).toEqual([]);

    capturas.reemplazar(`${CACHE}Camera/frente-1.jpg`, `${CACHE}Camera/frente-2.jpg`);
    expect(mockBorrados).toEqual([`${CACHE}Camera/frente-1.jpg`]);

    capturas.anotar(`${TMP}${UUID}.jpg`);
    capturas.borrarTodas();
    expect(mockBorrados.sort()).toEqual([`${CACHE}Camera/frente-1.jpg`, `${CACHE}Camera/frente-2.jpg`, `${TMP}${UUID}.jpg`].sort());
    expect(capturas.pendientes).toBe(0);
  });
});
