/**
 * APP-08/09/10: al cerrar sesión (o al entrar otro cliente) se borra lo que el anterior dejó en el
 * teléfono, y NO las preferencias que no son de nadie (el tema).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alLimpiarDatosLocales, CLAVE_COMPRAS_DE_PRUEBA, limpiarDatosLocales } from '../src/session/datos-locales';

const mockVaciar = jest.fn();
jest.mock('../src/device/archivos', () => ({ vaciarCopiasLocales: () => mockVaciar() }));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockVaciar.mockClear();
});

it('borra compras de prueba, lectura del carnet, historial y caché; deja el tema y la instalación', async () => {
  await AsyncStorage.multiSet([
    [CLAVE_COMPRAS_DE_PRUEBA, '{"orders":[1]}'],
    ['atlas.identidad.lectura.v1', '{"firstNames":"MARIA"}'],
    ['atlas.ubicaciones.historial', '[]'],
    ['atlas.apariencia', 'dark'],
    ['atlas.device.installation-id', 'abc'],
  ]);

  await limpiarDatosLocales();

  expect(await AsyncStorage.getItem(CLAVE_COMPRAS_DE_PRUEBA)).toBeNull();
  expect(await AsyncStorage.getItem('atlas.identidad.lectura.v1')).toBeNull();
  expect(await AsyncStorage.getItem('atlas.ubicaciones.historial')).toBeNull();
  expect(await AsyncStorage.getItem('atlas.apariencia')).toBe('dark');
  expect(await AsyncStorage.getItem('atlas.device.installation-id')).toBe('abc');
  expect(mockVaciar).toHaveBeenCalledTimes(1);
});

it('avisa a quien guarda datos del cliente en memoria, y un oyente que falla no lo impide', async () => {
  const oyente = jest.fn();
  const quitarRoto = alLimpiarDatosLocales(() => {
    throw new Error('roto');
  });
  const quitar = alLimpiarDatosLocales(oyente);

  await limpiarDatosLocales();
  expect(oyente).toHaveBeenCalledTimes(1);

  quitar();
  quitarRoto();
  await limpiarDatosLocales();
  expect(oyente).toHaveBeenCalledTimes(1);
});
