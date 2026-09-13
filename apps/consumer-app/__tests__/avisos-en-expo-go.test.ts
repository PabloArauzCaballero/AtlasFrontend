/**
 * Los avisos dentro de Expo Go.
 *
 * Esto existe por una caída medida el 2026-09-13 en el emulador: `expo-notifications` LANZA al
 * evaluarse dentro de Expo Go —las notificaciones remotas se quitaron en el SDK 53— y el `import`
 * estaba arriba de `permissions.ts` y de `push.ts`. Como expo-router carga todas las rutas, cada una
 * fallaba con «missing the required default export» y la app moría con
 * `Cannot read property 'ErrorBoundary' of undefined`: pantalla en blanco antes de pintar nada, y sin
 * ninguna pista de que el culpable fueran los avisos.
 *
 * Lo que se protege: que NADIE vuelva a importar ese módulo arriba, y que en Expo Go la app degrade
 * en vez de caerse.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');

function fuente(ruta: string): string {
  return readFileSync(join(raiz, ruta), 'utf8');
}

describe('expo-notifications no se importa arriba de ningún módulo', () => {
  /*
    Se comprueba sobre el TEXTO y no ejecutando: el import de arriba se evalúa al cargar el módulo,
    así que una prueba que lo importara para comprobarlo caería en el mismo fallo que describe.
  */
  const ficheros = ['src/device/push.ts', 'src/device/permissions.ts', 'src/device/avisos-modulo.ts'];

  it.each(ficheros)('%s no tiene un import estático de expo-notifications', (ruta) => {
    expect(fuente(ruta)).not.toMatch(/^\s*import .*from 'expo-notifications';/m);
  });

  it('el único acceso al módulo es perezoso, detrás de esExpoGo', () => {
    const cargador = fuente('src/device/avisos-modulo.ts');
    expect(cargador).toMatch(/require\('expo-notifications'\)/);
    expect(cargador).toMatch(/esExpoGo/);
  });

  it('quien lo necesita pasa por el cargador, no por el módulo', () => {
    for (const ruta of ['src/device/push.ts', 'src/device/permissions.ts']) {
      expect(fuente(ruta)).toMatch(/cargarAvisos/);
    }
  });
});

describe('en Expo Go la app degrada en vez de caerse', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const simularAnfitrion = (storeClient: boolean) => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment: storeClient ? 'storeClient' : 'standalone' },
      ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
    }));
    jest.doMock('expo-device', () => ({ __esModule: true, isDevice: true }));
  };

  it('el cargador devuelve null y no toca el módulo', () => {
    simularAnfitrion(true);
    jest.doMock('expo-notifications', () => {
      throw new Error('expo-notifications: removed from Expo Go with the release of SDK 53');
    });

    // `require` y no `import()`: la configuración de Jest de este repo no habilita el dinámico.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cargarAvisos } = require('../src/device/avisos-modulo') as typeof import('../src/device/avisos-modulo');

    expect(cargarAvisos()).toBeNull();
  });

  it('activar y consultar los avisos responden «no-disponible», sin lanzar', async () => {
    simularAnfitrion(true);
    jest.doMock('expo-notifications', () => {
      throw new Error('expo-notifications: removed from Expo Go with the release of SDK 53');
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { activarAvisos, estadoAvisos, prepararAvisos } = require('../src/device/push') as typeof import('../src/device/push');

    await expect(prepararAvisos()).resolves.toBeUndefined();
    await expect(activarAvisos('c1')).resolves.toBe('no-disponible');
    await expect(estadoAvisos()).resolves.toBe('no-disponible');
  });

  it('en el binario propio SÍ se usa el módulo: Expo Go no cambia lo que ya había', async () => {
    simularAnfitrion(false);
    const setNotificationHandler = jest.fn();
    jest.doMock('expo-notifications', () => ({
      __esModule: true,
      setNotificationHandler,
      getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { estadoAvisos } = require('../src/device/push') as typeof import('../src/device/push');

    await expect(estadoAvisos()).resolves.toBe('concedido');
    // El manejador se registra al cargar: sin él, un aviso que llega con la app abierta no se pinta.
    expect(setNotificationHandler).toHaveBeenCalled();
  });
});
