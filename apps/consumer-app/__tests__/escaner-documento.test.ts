/**
 * El escaner de documentos del sistema (VisionKit / ML Kit) para el carnet.
 *
 * Dos cosas se protegen:
 *
 * 1. Que la libreria nativa NO se importe arriba de ningun modulo. Un `import` de un modulo nativo
 *    que no viaja en Expo Go tumbo la app entera dos veces (`avisos-en-expo-go.test.ts`); con esta
 *    libreria pasaria lo mismo, porque resuelve su modulo nativo al evaluarse.
 * 2. Que cada camino —Expo Go, web, simulador, cancelado, imagen, error— devuelva lo que la pantalla
 *    espera para decidir si usa lo escaneado o cae a la camara de siempre.
 *
 * La libreria se simula entera: aqui no hay VisionKit ni ML Kit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = join(__dirname, '..');
const LIBRERIA = '@dariyd/react-native-document-scanner';

function fuente(ruta: string): string {
  return readFileSync(join(raiz, ruta), 'utf8');
}

function ficherosDeCodigo(carpeta: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(join(raiz, carpeta))) {
    const ruta = join(carpeta, nombre);
    if (statSync(join(raiz, ruta)).isDirectory()) salida.push(...ficherosDeCodigo(ruta));
    else if (/\.(ts|tsx|js|jsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

describe('la libreria del escaner no se importa arriba de ningun modulo', () => {
  /*
    Sobre el TEXTO y no ejecutando: el import de arriba se evalua al cargar el modulo, asi que una
    prueba que lo importara para comprobarlo caeria en el mismo fallo que describe. `import type` si
    se permite: Babel lo borra y no llega al bundle.
  */
  const importDeValor = /^\s*import (?!type\b)[^;]*from '@dariyd\/react-native-document-scanner'/m;

  it('escaner-documento.ts solo la trae con require, detras de esExpoGo', () => {
    const adaptador = fuente('src/device/escaner-documento.ts');
    expect(adaptador).not.toMatch(importDeValor);
    expect(adaptador).not.toMatch(/^\s*export .* from '@dariyd\/react-native-document-scanner'/m);
    expect(adaptador).toMatch(/require\('@dariyd\/react-native-document-scanner'\)/);
    expect(adaptador).toMatch(/esExpoGo/);
    // El require vive DENTRO de una funcion: ninguna linea sin sangria lo contiene.
    expect(adaptador).not.toMatch(/^\S.*require\('@dariyd\/react-native-document-scanner'\)/m);
  });

  it('la version web no la nombra en absoluto (ni import ni require)', () => {
    expect(fuente('src/device/escaner-documento.web.ts')).not.toContain(LIBRERIA);
  });

  it('nadie mas en la app la usa: la pantalla pasa por el adaptador', () => {
    const permitido = join('src', 'device', 'escaner-documento.ts');
    const usan = [...ficherosDeCodigo('src'), ...ficherosDeCodigo('app')]
      .filter((ruta) => ruta !== permitido)
      .filter((ruta) => fuente(ruta).includes(LIBRERIA))
      .map((ruta) => relative(raiz, join(raiz, ruta)));
    expect(usan).toEqual([]);
  });
});

type Anfitrion = {
  expoGo?: boolean;
  os?: 'ios' | 'android' | 'web';
  isDevice?: boolean;
  getSize?: (uri: string, ok: (w: number, h: number) => void, ko: (e: unknown) => void) => void;
  bandera?: string;
};

type Adaptador = typeof import('../src/device/escaner-documento');

/**
 * Carga el adaptador con un anfitrion simulado. `libreria` es la fabrica del modulo simulado; si es
 * `'lanza'`, requerirlo revienta, que es lo que pasaria con un modulo que no existe.
 */
function cargar(anfitrion: Anfitrion, libreria: (() => unknown) | 'lanza'): Adaptador {
  jest.resetModules();
  const { expoGo = false, os = 'ios', isDevice = true, getSize, bandera } = anfitrion;
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: {
      executionEnvironment: expoGo ? 'storeClient' : 'standalone',
      expoConfig: { extra: { atlas: bandera === undefined ? {} : { escanerDocumento: bandera } } },
    },
    ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
  }));
  jest.doMock('expo-device', () => ({ __esModule: true, isDevice }));
  jest.doMock('react-native', () => ({
    Platform: { OS: os },
    Image: { getSize: getSize ?? jest.fn() },
  }));
  if (libreria === 'lanza') {
    jest.doMock(LIBRERIA, () => {
      throw new Error("TurboModuleRegistry: 'DocumentScanner' could not be found");
    });
  } else {
    jest.doMock(LIBRERIA, libreria);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/device/escaner-documento') as Adaptador;
}

function libreriaQueResponde(respuesta: unknown, modo: 'resuelve' | 'rechaza' = 'resuelve') {
  const launchScanner = jest.fn(() => (modo === 'resuelve' ? Promise.resolve(respuesta) : Promise.reject(respuesta)));
  return {
    launchScanner,
    fabrica: () => ({ __esModule: true, default: { launchScanner: jest.fn() }, launchScanner }),
  };
}

function libreriaQueNoDebeCargarse() {
  const cargada = jest.fn();
  return {
    cargada,
    fabrica: () => {
      cargada();
      return { __esModule: true, default: {}, launchScanner: jest.fn() };
    },
  };
}

const PAGINA = { uri: 'file:///cache/ABC.jpg', width: 2400, height: 1513, fileSize: 812_000, type: 'image/jpeg', fileName: 'ABC.jpg' };

afterEach(() => {
  jest.dontMock(LIBRERIA);
});

describe('escanearDocumento: que camino toma', () => {
  it('en Expo Go no toca la libreria y contesta no_disponible expo_go', async () => {
    const lib = libreriaQueNoDebeCargarse();
    const { escanearDocumento } = cargar({ expoGo: true }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'expo_go' });
    expect(lib.cargada).not.toHaveBeenCalled();
  });

  it('con Platform web (defensa: la web usa escaner-documento.web.ts) no la toca', async () => {
    const lib = libreriaQueNoDebeCargarse();
    const { escanearDocumento } = cargar({ os: 'web' }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'web' });
    expect(lib.cargada).not.toHaveBeenCalled();
  });

  it('en el simulador de iOS contesta sin_soporte sin abrir VisionKit', async () => {
    const lib = libreriaQueNoDebeCargarse();
    const { escanearDocumento } = cargar({ os: 'ios', isDevice: false }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'sin_soporte', detalle: 'simulador_ios' });
    expect(lib.cargada).not.toHaveBeenCalled();
  });

  it('en un emulador Android SI lo intenta: ML Kit funciona si el emulador trae Play Store', async () => {
    const lib = libreriaQueResponde({ images: [PAGINA] });
    const { escanearDocumento } = cargar({ os: 'android', isDevice: false }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toMatchObject({ tipo: 'imagen' });
  });

  it('un binario sin el modulo nativo (require que revienta) contesta sin_soporte', async () => {
    const { escanearDocumento } = cargar({}, 'lanza');
    await expect(escanearDocumento()).resolves.toEqual({
      tipo: 'no_disponible',
      motivo: 'sin_soporte',
      detalle: 'modulo_nativo_ausente',
    });
  });

  it('un binario viejo con el JS nuevo (default undefined) contesta sin_soporte y no llama', async () => {
    const launchScanner = jest.fn();
    const { escanearDocumento } = cargar({}, () => ({ __esModule: true, default: undefined, launchScanner }));
    await expect(escanearDocumento()).resolves.toMatchObject({ tipo: 'no_disponible', motivo: 'sin_soporte' });
    expect(launchScanner).not.toHaveBeenCalled();
  });

  it('cancelar vuelve como cancelado', async () => {
    const lib = libreriaQueResponde({ didCancel: true });
    const { escanearDocumento } = cargar({}, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'cancelado' });
  });

  it('una pagina escaneada vuelve como imagen del escaner del sistema, con sus medidas', async () => {
    const lib = libreriaQueResponde({ images: [PAGINA] });
    const { escanearDocumento } = cargar({ os: 'android' }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({
      tipo: 'imagen',
      uri: 'file:///cache/ABC.jpg',
      ancho: 2400,
      alto: 1513,
      origen: 'escaner_sistema',
    });
  });

  it('se piden exactamente las opciones del plan: base, una pagina, sin galeria, 2400 px, JPEG', async () => {
    const lib = libreriaQueResponde({ images: [PAGINA] });
    const { escanearDocumento } = cargar({}, lib.fabrica);
    await escanearDocumento();
    expect(lib.launchScanner).toHaveBeenCalledTimes(1);
    expect(lib.launchScanner).toHaveBeenCalledWith({
      scannerMode: 'base',
      pageLimit: 1,
      galleryImportAllowed: false,
      maxWidth: 2400,
      maxHeight: 2400,
      quality: 0.9,
      includeBase64: false,
      includeExif: false,
      includeLocationExif: false,
      includePdf: false,
    });
  });

  it('con varias paginas (iOS ignora pageLimit) se usa la primera', async () => {
    const lib = libreriaQueResponde({ images: [PAGINA, { ...PAGINA, uri: 'file:///cache/OTRA.jpg' }] });
    const { escanearDocumento } = cargar({}, lib.fabrica);
    await expect(escanearDocumento()).resolves.toMatchObject({ uri: 'file:///cache/ABC.jpg' });
  });

  it('si no vienen medidas, las saca con Image.getSize', async () => {
    const getSize = jest.fn((_uri: string, ok: (w: number, h: number) => void) => ok(1800, 1135));
    const lib = libreriaQueResponde({ images: [{ uri: 'file:///cache/X.jpg', width: 0 }] });
    const { escanearDocumento } = cargar({ getSize }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({
      tipo: 'imagen',
      uri: 'file:///cache/X.jpg',
      ancho: 1800,
      alto: 1135,
      origen: 'escaner_sistema',
    });
    expect(getSize).toHaveBeenCalledWith('file:///cache/X.jpg', expect.any(Function), expect.any(Function));
  });

  it('si ni Image.getSize da medidas, no_disponible error (la pantalla cae a la camara)', async () => {
    const getSize = jest.fn((_uri: string, _ok: unknown, ko: (e: unknown) => void) => ko(new Error('decode')));
    const lib = libreriaQueResponde({ images: [{ uri: 'file:///cache/X.jpg' }] });
    const { escanearDocumento } = cargar({ getSize }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'error', detalle: 'sin_dimensiones' });
  });

  it('una lista de imagenes vacia (Android no pudo leer la pagina) es error, no imagen', async () => {
    const lib = libreriaQueResponde({ images: [] });
    const { escanearDocumento } = cargar({ os: 'android' }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'error', detalle: 'sin_imagen' });
  });

  it('un error del sistema vuelve como no_disponible error con su mensaje, sin lanzar', async () => {
    const lib = libreriaQueResponde({ error: true, errorMessage: 'Scan failed' });
    const { escanearDocumento } = cargar({ os: 'android' }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'error', detalle: 'Scan failed' });
  });

  it('sin Google Play Services contesta sin_play_services', async () => {
    const lib = libreriaQueResponde({
      error: true,
      errorMessage: 'com.google.android.gms.common.api.ApiException: 17: API: ModuleInstall.API is not available on this device.',
    });
    const { escanearDocumento } = cargar({ os: 'android' }, lib.fabrica);
    await expect(escanearDocumento()).resolves.toMatchObject({ tipo: 'no_disponible', motivo: 'sin_play_services' });
  });

  it('si la libreria RECHAZA (su camino de modulo ausente) se trata igual que si resolviera', async () => {
    const lib = libreriaQueResponde({ error: true, errorMessage: 'DocumentScanner module is not available' }, 'rechaza');
    const { escanearDocumento } = cargar({}, lib.fabrica);
    await expect(escanearDocumento()).resolves.toMatchObject({ tipo: 'no_disponible', motivo: 'sin_soporte' });
  });

  it('una excepcion cualquiera tampoco escapa', async () => {
    const lib = libreriaQueResponde(new Error('boom'), 'rechaza');
    const { escanearDocumento } = cargar({}, lib.fabrica);
    await expect(escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'error', detalle: 'boom' });
  });

  it('dos toques seguidos abren UN escaner: la libreria guarda un solo callback', async () => {
    let soltar: (valor: unknown) => void = () => undefined;
    const launchScanner = jest.fn(() => new Promise((resolver) => { soltar = resolver; }));
    const { escanearDocumento } = cargar({}, () => ({ __esModule: true, default: {}, launchScanner }));
    const primera = escanearDocumento();
    const segunda = escanearDocumento();
    expect(segunda).toBe(primera);
    soltar({ didCancel: true });
    await expect(primera).resolves.toEqual({ tipo: 'cancelado' });
    expect(launchScanner).toHaveBeenCalledTimes(1);
    // Terminado el primero, el siguiente toque abre otro.
    const tercera = escanearDocumento();
    soltar({ didCancel: true });
    await tercera;
    expect(launchScanner).toHaveBeenCalledTimes(2);
  });
});

describe('clasificarError', () => {
  const casos: [string | undefined, string][] = [
    [undefined, 'error'],
    ['User cancelled', 'cancelado'],
    ['Waiting for the document scanner module to be downloaded.', 'sin_play_services'],
    ['Google Play services is missing', 'sin_play_services'],
    ['SERVICE_MISSING', 'sin_play_services'],
    ['DocumentScanner module is not available', 'sin_soporte'],
    ["Activity doesn't exist", 'error'],
  ];
  it.each(casos)('%s -> %s', (mensaje, esperado) => {
    const { clasificarError } = cargar({}, 'lanza');
    const resultado = clasificarError(mensaje);
    expect(resultado.tipo === 'no_disponible' ? resultado.motivo : resultado.tipo).toBe(esperado);
  });
});

describe('la bandera EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO', () => {
  const original = process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO;
    else process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO = original;
  });

  it('sin definir, apagada: la app hace lo de siempre', () => {
    delete process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO;
    expect(cargar({}, 'lanza').escanerHabilitado()).toBe(false);
  });

  it.each(['false', 'FALSE', '0', 'no', 'off', ' ', 'verdadero'])('«%s» NO la enciende', (valor) => {
    delete process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO;
    expect(cargar({ bandera: valor }, 'lanza').escanerHabilitado()).toBe(false);
  });

  it.each(['true', 'TRUE', ' true ', '1'])('«%s» la enciende desde extra.atlas (el camino del binario)', (valor) => {
    delete process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO;
    expect(cargar({ bandera: valor }, 'lanza').escanerHabilitado()).toBe(true);
  });

  it('el entorno manda sobre extra, como en las demas EXPO_PUBLIC_*', () => {
    process.env.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO = 'false';
    expect(cargar({ bandera: 'true' }, 'lanza').escanerHabilitado()).toBe(false);
  });

  it('eas.json la declara en CADA perfil (EAS no sube el .env): apagada sólo en el simulador', () => {
    // preview y production son la MISMA app para el tester: el escáner nativo va encendido en las dos.
    // El simulador no tiene VisionKit con cámara real, así que allí nace apagado. Cualquier perfil
    // nuevo de dispositivo real debe llevarla encendida.
    const eas = JSON.parse(fuente('eas.json')) as { build: Record<string, { env?: Record<string, string> }> };
    const perfiles = Object.entries(eas.build);
    expect(perfiles.length).toBeGreaterThan(0);
    for (const [nombre, perfil] of perfiles) {
      expect(perfil.env?.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO).toBe(nombre === 'simulador-ios' ? 'false' : 'true');
    }
  });

  it('app.config.js la copia a extra.atlas', () => {
    const configuracion = fuente('app.config.js');
    expect(configuracion).toMatch(/'EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO'/);
    expect(configuracion).toMatch(/escanerDocumento: env\.EXPO_PUBLIC_ATLAS_ESCANER_DOCUMENTO/);
  });
});

describe('la version web', () => {
  it('contesta no_disponible web y nunca carga la libreria', async () => {
    jest.resetModules();
    const cargada = jest.fn();
    jest.doMock(LIBRERIA, () => {
      cargada();
      return {};
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web = require('../src/device/escaner-documento.web') as typeof import('../src/device/escaner-documento.web');
    await expect(web.escanearDocumento()).resolves.toEqual({ tipo: 'no_disponible', motivo: 'web' });
    // En el navegador no hay escaner: la pantalla va directa a la camara, este como este la bandera.
    expect(web.escanerHabilitado()).toBe(false);
    expect(cargada).not.toHaveBeenCalled();
  });
});
