/**
 * El detalle del teléfono que viaja al abrir sesión: sólo las claves que el contrato acepta.
 *
 * `startSessionSchema` del backend es `.strict()`: una clave de más (zona horaria, idioma) convierte el inicio de
 * sesión en un 400, y como abrir sesión falla en silencio, se perdería TODA la telemetría sin que nadie lo viera.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { snapshotDeSesion } from '../src/device/device';

const ACEPTADAS = ['appVersion', 'brand', 'isEmulator', 'isRooted', 'model', 'osFamily', 'osVersion'];

describe('snapshotDeSesion', () => {
  it('deja marca, modelo, sistema, versión, root y emulador; quita zona horaria e idioma', () => {
    const salida = snapshotDeSesion({
      brand: 'samsung',
      model: 'SM-A546E',
      osFamily: 'android',
      osVersion: '15',
      appVersion: '1.0.0',
      isEmulator: false,
      isRooted: false,
      timezone: 'America/La_Paz',
      locale: 'es-BO',
    } as never);
    expect(Object.keys(salida).sort()).toEqual(ACEPTADAS);
    expect(salida).toMatchObject({ brand: 'samsung', model: 'SM-A546E', isEmulator: false, isRooted: false });
  });

  it('no manda claves sin valor: «no se sabe» no es «false»', () => {
    const salida = snapshotDeSesion({ osFamily: 'ios', osVersion: '26.5', isEmulator: false } as never);
    expect(salida).toEqual({ osFamily: 'ios', osVersion: '26.5', isEmulator: false });
    expect(salida).not.toHaveProperty('isRooted');
  });
});
