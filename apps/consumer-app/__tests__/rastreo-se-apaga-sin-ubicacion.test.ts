/**
 * Sin ubicacion decidida, activar las señales APAGA el rastreo de segundo plano.
 *
 * El caso que lo motivo: «siempre» concedido en el domicilio → «Ahora no» en permisos. La tarea del
 * sistema sobrevivia, con su notificacion «registrando tu ubicacion» a la vista y cada lote rebotando
 * con 422. Sin el arreglo, `detenerRastreoEnSegundoPlano` no se llama y esta prueba falla.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockDetenerRastreoEnSegundoPlano = jest.fn(async () => undefined);
const mockIniciarRastreoEnSegundoPlano = jest.fn(async () => true);
const mockMedirYEnviar = jest.fn(async () => true);
const mockBorrarContextoDeRastreo = jest.fn(async () => undefined);
const mockGuardarContextoDeRastreo = jest.fn(async () => undefined);

jest.mock('../src/device/location', () => ({
  detenerRastreoEnSegundoPlano: () => mockDetenerRastreoEnSegundoPlano(),
  iniciarRastreoEnSegundoPlano: () => mockIniciarRastreoEnSegundoPlano(),
  medirYEnviar: () => mockMedirYEnviar(),
  permisosDeUbicacion: async () => ({ primerPlano: true, segundoPlano: true }),
}));
jest.mock('../src/device/tracking-context', () => ({ borrarContextoDeRastreo: () => mockBorrarContextoDeRastreo(), guardarContextoDeRastreo: () => mockGuardarContextoDeRastreo() }));
jest.mock('../src/device/contacts', () => ({ leerAgendaCompleta: async () => null, resumirAgenda: async () => null }));
jest.mock('../src/api/endpoints/customer', () => ({ listActiveConsents: async () => [] }));
jest.mock('../src/api/endpoints/privacy', () => ({ registrarDecisiones: async () => undefined }));
jest.mock('../src/api/endpoints/device-signals', () => ({}));
jest.mock('../src/api/endpoints/onboarding', () => ({ submitContactsSnapshot: async () => undefined }));

import { activarSeñalesDelDispositivo } from '../src/session/device-signals';
import { guardarDecisionDeArranque } from '../src/session/permisos-de-arranque';

describe('activarSeñalesDelDispositivo sin ubicacion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('detiene la tarea de segundo plano y borra el contexto', async () => {
    await guardarDecisionDeArranque({ ubicacion: false, ubicacionSiempre: false, contactos: false });

    const resultado = await activarSeñalesDelDispositivo({ customerId: '9', deviceId: 'd-1', sessionId: null });

    expect(resultado.ubicacionActiva).toBe(false);
    expect(mockDetenerRastreoEnSegundoPlano).toHaveBeenCalledTimes(1);
    expect(mockBorrarContextoDeRastreo).toHaveBeenCalledTimes(1);
    expect(mockIniciarRastreoEnSegundoPlano).not.toHaveBeenCalled();
    expect(mockMedirYEnviar).not.toHaveBeenCalled();
  });

  it('con ubicacion concedida no la apaga y la enciende', async () => {
    await guardarDecisionDeArranque({ ubicacion: true, ubicacionSiempre: true, contactos: false });

    const resultado = await activarSeñalesDelDispositivo({ customerId: '9', deviceId: 'd-1', sessionId: null });

    expect(resultado.ubicacionActiva).toBe(true);
    expect(mockDetenerRastreoEnSegundoPlano).not.toHaveBeenCalled();
    expect(mockIniciarRastreoEnSegundoPlano).toHaveBeenCalledTimes(1);
  });
});
