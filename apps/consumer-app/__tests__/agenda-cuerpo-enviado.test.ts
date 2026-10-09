/**
 * El CUERPO que sale hacia `POST /customers/:id/address-book`, de punta a punta (APP-03).
 *
 * Se recorre el camino real —`activarSeñalesDelDispositivo` → `leerAgendaCompleta` →
 * `aContactoParaEnviar` → `ajustarAlContrato` → `sincronizarAgenda`— con una agenda que trae TODO lo
 * que una agenda real puede traer (correos, cumpleaños, empresa, cargo, direcciones, notas), y se
 * mira lo que llega a la llamada de red. Solo se doblan los modulos nativos y la red.
 *
 * Lo que se exige es el contrato de AtlasBackend #245 para `contacts-address-book-2.0.0`: cada
 * contacto lleva EXACTAMENTE `externalId, displayName, contactType, isFavorite, phones[{number}],
 * hasEmail, hasBirthday, hasCompany`. Ni una clave mas: mandar `emails: []` o `birthday: null`
 * BORRARIA en el servidor lo guardado por versiones anteriores, y mandar el dato es justo lo que la
 * auditoria prohibe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* La agenda del «telefono». Lo que `getAllDetails` devolveria si la app pidiera todos los campos. */
const mockAgenda = [
  {
    id: 'c-1',
    fullName: 'Rosa Mamani',
    givenName: 'Rosa',
    familyName: 'Mamani',
    company: 'Panaderia El Trigal',
    jobTitle: 'Dueña',
    isFavourite: true,
    birthday: { month: 4, day: 12 },
    emails: [{ label: 'casa', address: 'rosa@example.bo' }],
    addresses: [{ street: 'Calle Falsa 123', city: 'Cochabamba' }],
    note: 'le debo 50',
    phones: [{ label: 'Mamá', number: '+591 71234567' }],
  },
  {
    id: 'c-2',
    fullName: 'Luis Choque',
    givenName: 'Luis',
    familyName: 'Choque',
    company: null,
    isFavourite: false,
    birthday: null,
    emails: [],
    phones: [{ label: 'móvil', number: '69876543' }],
  },
  {
    // Solo la razon social: un comercio. Correo en blanco no cuenta como correo.
    id: 'c-3',
    company: 'Ferreteria Sur',
    emails: [{ address: '   ' }],
    birthday: { year: 1990 },
    phones: [{ number: '33445566' }],
  },
];

const mockGetAllDetails = jest.fn(async (_campos: readonly string[]) => mockAgenda);
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: async () => ({
    granted: true,
    accessPrivileges: 'all',
  }),
  Contact: {
    getAllDetails: (campos: readonly string[]) => mockGetAllDetails(campos),
    presentPicker: async () => null,
  },
  ContactField: {
    IS_FAVOURITE: 'isFavourite',
    FULL_NAME: 'fullName',
    GIVEN_NAME: 'givenName',
    FAMILY_NAME: 'familyName',
    COMPANY: 'company',
    JOB_TITLE: 'jobTitle',
    NOTE: 'note',
    IMAGE: 'image',
    THUMBNAIL: 'thumbnail',
    BIRTHDAY: 'birthday',
    EMAILS: 'emails',
    PHONES: 'phones',
    ADDRESSES: 'addresses',
    DATES: 'dates',
  },
}));
jest.mock('../src/device/device', () => ({
  hashSensitiveText: async (valor: string) => `h(${valor})`,
}));

const mockSincronizarAgenda = jest.fn(async (_customerId: string, _body: unknown) => ({}));
jest.mock('../src/api/endpoints/device-signals', () => ({
  sincronizarAgenda: (customerId: string, body: unknown) => mockSincronizarAgenda(customerId, body),
}));
jest.mock('../src/device/location', () => ({
  detenerRastreoEnSegundoPlano: async () => undefined,
  iniciarRastreoEnSegundoPlano: async () => false,
  medirYEnviar: async () => true,
  permisosDeUbicacion: async () => ({
    primerPlano: false,
    segundoPlano: false,
  }),
}));
jest.mock('../src/device/tracking-context', () => ({
  borrarContextoDeRastreo: async () => undefined,
  guardarContextoDeRastreo: async () => undefined,
}));
jest.mock('../src/api/endpoints/customer', () => ({
  listActiveConsents: async () => [],
}));
jest.mock('../src/api/endpoints/privacy', () => ({
  registrarDecisiones: async () => undefined,
}));
jest.mock('../src/api/endpoints/onboarding', () => ({
  submitContactsSnapshot: async () => undefined,
}));

import { activarSeñalesDelDispositivo } from '../src/session/device-signals';
import { guardarDecisionDeArranque } from '../src/session/permisos-de-arranque';

type Cuerpo = { algorithmVersion: string; contacts: Record<string, unknown>[] };

async function cuerpoEnviado(): Promise<Cuerpo> {
  await guardarDecisionDeArranque({
    ubicacion: false,
    ubicacionSiempre: false,
    contactos: true,
  });
  await activarSeñalesDelDispositivo({
    customerId: '9',
    deviceId: 'd-1',
    sessionId: null,
  });
  expect(mockSincronizarAgenda).toHaveBeenCalledTimes(1);
  return mockSincronizarAgenda.mock.calls[0]?.[1] as Cuerpo;
}

describe('cuerpo de la subida de agenda (contacts-address-book-2.0.0)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('cada contacto lleva EXACTAMENTE las ocho claves del contrato', async () => {
    const cuerpo = await cuerpoEnviado();
    expect(cuerpo.algorithmVersion).toBe('contacts-address-book-2.0.0');
    expect(cuerpo.contacts).toHaveLength(3);
    for (const contacto of cuerpo.contacts) {
      expect(Object.keys(contacto).sort()).toEqual([
        'contactType',
        'displayName',
        'externalId',
        'hasBirthday',
        'hasCompany',
        'hasEmail',
        'isFavorite',
        'phones',
      ]);
      for (const telefono of contacto.phones as Record<string, unknown>[]) {
        expect(Object.keys(telefono)).toEqual(['number']);
      }
    }
  });

  it('las banderas salen bien con y sin correo, cumpleaños y empresa', async () => {
    const cuerpo = await cuerpoEnviado();
    const porId = new Map(cuerpo.contacts.map((c) => [c.externalId, c]));

    expect(porId.get('c-1')).toEqual({
      externalId: 'c-1',
      displayName: 'Rosa Mamani',
      contactType: 'person',
      isFavorite: true,
      phones: [{ number: '+591 71234567' }],
      hasEmail: true,
      hasBirthday: true,
      hasCompany: true,
    });
    expect(porId.get('c-2')).toEqual({
      externalId: 'c-2',
      displayName: 'Luis Choque',
      contactType: 'person',
      isFavorite: false,
      phones: [{ number: '69876543' }],
      hasEmail: false,
      hasBirthday: false,
      hasCompany: false,
    });
    // Correo en blanco no es correo; un cumpleaños sin dia ni mes no es cumpleaños.
    expect(porId.get('c-3')).toEqual({
      externalId: 'c-3',
      displayName: 'Ferreteria Sur',
      contactType: 'company',
      isFavorite: false,
      phones: [{ number: '33445566' }],
      hasEmail: false,
      hasBirthday: false,
      hasCompany: true,
    });
  });

  it('ningun dato de esos campos aparece en el cuerpo, ni como texto', async () => {
    const texto = JSON.stringify(await cuerpoEnviado());
    for (const prohibido of [
      'rosa@example.bo',
      'Panaderia El Trigal',
      'Dueña',
      'Calle Falsa',
      'le debo',
      'Mamá',
      '"birthday":',
      '"emails":',
      '"company":',
    ]) {
      expect(texto).not.toContain(prohibido);
    }
  });

  it('al sistema solo se le piden los campos necesarios: nada de direcciones, cargo, notas ni fotos', async () => {
    await cuerpoEnviado();
    // Dos lecturas: la del resumen (solo telefonos) y la de la ficha. Se mira la de la ficha.
    const campos = mockGetAllDetails.mock.calls.map((llamada) => llamada[0]).find((c) => c.includes('fullName')) ?? [];
    expect(mockGetAllDetails.mock.calls.map((llamada) => llamada[0]).filter((c) => c !== campos)).toEqual([['phones']]);
    expect([...campos].sort()).toEqual([
      'birthday',
      'company',
      'emails',
      'familyName',
      'fullName',
      'givenName',
      'isFavourite',
      'phones',
    ]);
  });
});
