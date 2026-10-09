import {
  aContactoParaEnviar,
  aPosicionParaEnviar,
  ajustarAlContrato,
  sinRepetidas,
  trocear,
  type PosicionParaEnviar,
} from '../src/features/rastreo';

/**
 * La agenda completa y el rastro, por las partes que fallan sin decirlo.
 *
 * Lo que se prueba aquí no es «convierte un objeto en otro» —eso se ve leyéndolo—, sino los cuatro
 * sitios donde un error produce un dato PLAUSIBLE Y FALSO: una ficha
 * vacía que infla la cuenta de contactos, una coordenada `NaN` que el servidor rechaza con un 400
 * que nadie relaciona con esto, y una velocidad de `-1` que un día alguien promediaría.
 */
describe('aContactoParaEnviar', () => {
  it('arma la ficha MINIMA: nombre visible, numeros, favorito, tipo y tres banderas sin el dato (APP-03)', () => {
    /*
      Son datos de terceros que no consintieron. El servidor usa el nombre, los numeros (de ahi salen
      los hashes que cruzan referencias), si es favorito o empresa y si la ficha TIENE correo,
      cumpleaños y empresa. El correo, la fecha, la razon social, el cargo y las direcciones NO viajan
      aunque la agenda los tenga.
    */
    const ficha = aContactoParaEnviar({
      id: 'abc-123',
      fullName: 'María Quispe',
      givenName: 'María',
      familyName: 'Quispe',
      company: 'Ferretería Sur',
      isFavourite: true,
      phones: [{ label: 'Papá', number: '+591 76500122' }, { label: 'casa', number: '4123456' }],
      birthday: { year: 1985, month: 3, day: 9 },
      emails: [{ address: 'maria@ferreteria.bo' }],
      // Lo que una agenda real trae y la app ya no pide; si llegara, tampoco sale.
      ...({ jobTitle: 'Dueña', addresses: [{ street: 'Av. Siempre Viva 123' }] } as object),
    });

    expect(ficha).toEqual({
      externalId: 'abc-123',
      displayName: 'María Quispe',
      // Tiene nombre de persona, asi que es una persona aunque tenga empresa.
      contactType: 'person',
      isFavorite: true,
      // Sin la etiqueta: «Papá» dice quien es el contacto para esta persona.
      phones: [{ number: '+591 76500122' }, { number: '4123456' }],
      hasEmail: true,
      hasBirthday: true,
      hasCompany: true,
    });
  });

  it('las banderas salen en falso cuando la ficha no tiene el dato, o lo tiene en blanco', () => {
    const sinNada = aContactoParaEnviar({ id: 'n', fullName: 'Nadie', phones: [{ number: '76500122' }] });
    expect(sinNada).toMatchObject({ hasEmail: false, hasBirthday: false, hasCompany: false });

    const enBlanco = aContactoParaEnviar({
      id: 'b',
      fullName: 'Blanco',
      company: '   ',
      emails: [{ address: '' }, null, { address: '  ' }],
      birthday: { year: 1990 },
    });
    expect(enBlanco).toMatchObject({ hasEmail: false, hasBirthday: false, hasCompany: false });
  });

  it('un cumpleaños sin año cuenta: es el caso normal en iOS', () => {
    expect(aContactoParaEnviar({ id: 'c', fullName: 'C', birthday: { month: 5, day: 3 } })?.hasBirthday).toBe(true);
  });

  it('descarta la ficha sin identificador y la que no tiene ningun dato util', () => {
    /*
      Las agendas reales estan llenas de restos de cuentas que se quitaron: fichas sin nombre, sin
      numero y sin correo. Mandarlas engorda la cuenta de contactos de esa persona sin añadir nada,
      y esa cuenta es una de las señales que el motor lee.
    */
    expect(aContactoParaEnviar({ id: '', fullName: 'Sin id' })).toBeNull();
    expect(aContactoParaEnviar({ id: 'vacio', phones: [] })).toBeNull();
    expect(aContactoParaEnviar({ id: 'solo-telefono', phones: [{ number: '76500122' }] })).not.toBeNull();
  });

  it('compone el nombre desde nombre y apellido cuando la agenda no trae uno completo', () => {
    expect(aContactoParaEnviar({ id: 'x', givenName: 'Juan', familyName: 'Pérez' })?.displayName).toBe('Juan Pérez');
  });

  it('marca como empresa la ficha que solo tiene razon social', () => {
    // `contactType` no existe en la API nueva y hay que deducirlo. La regla acierta en lo que
    // importa: distinguir un comercio de una persona.
    const ficha = aContactoParaEnviar({ id: 'y', company: 'Ferretería Sur', phones: [{ number: '33445566' }] });
    expect(ficha?.contactType).toBe('company');
    expect(ficha?.displayName).toBe('Ferretería Sur');
  });

  it('descarta telefonos vacios en vez de mandarlos como cadenas en blanco', () => {
    const ficha = aContactoParaEnviar({
      id: 'x',
      fullName: 'Alguien',
      phones: [{ number: '  ' }, { number: '76500122' }, null],
    });
    expect(ficha?.phones).toEqual([{ number: '76500122' }]);
  });
});

describe('ajustarAlContrato', () => {
  it('devuelve SOLO los campos de la ficha minima, aunque le llegue uno de mas', () => {
    // La ultima puerta: un campo añadido a la ficha por error no viaja.
    const conDeMas = {
      externalId: 'z',
      displayName: 'Z',
      contactType: 'person' as const,
      isFavorite: false,
      phones: [{ number: '76500122' }],
      hasEmail: true,
      hasBirthday: false,
      hasCompany: true,
      emails: [{ email: 'z@z.bo' }],
      birthday: '1990-01-01',
    };
    expect(Object.keys(ajustarAlContrato(conDeMas) ?? {}).sort()).toEqual([
      'contactType',
      'displayName',
      'externalId',
      'hasBirthday',
      'hasCompany',
      'hasEmail',
      'isFavorite',
      'phones',
    ]);
  });
});

describe('trocear', () => {
  it('parte la agenda en lotes y deja el resto en el ultimo', () => {
    expect(trocear([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(trocear([], 500)).toEqual([]);
    expect(trocear([1, 2], 500)).toEqual([[1, 2]]);
  });
});

describe('aPosicionParaEnviar', () => {
  const base = { coords: { latitude: -17.78, longitude: -63.18 }, timestamp: 1_757_000_000_000 };

  it('convierte la lectura del sistema y fecha con el reloj del telefono', () => {
    const posicion = aPosicionParaEnviar(base, 'foreground');
    expect(posicion?.lat).toBeCloseTo(-17.78);
    expect(posicion?.captureMode).toBe('foreground');
    expect(posicion?.capturedAt).toBe(new Date(1_757_000_000_000).toISOString());
  });

  it('descarta la lectura sin coordenadas validas', () => {
    /*
      `expo-location` puede entregar NaN si el proveedor se cae a mitad de la lectura. Un NaN
      serializado a JSON se convierte en `null`, que el servidor rechaza con un 400 que nadie
      relaciona con esto.
    */
    expect(aPosicionParaEnviar({ ...base, coords: { latitude: Number.NaN, longitude: -63.18 } }, 'foreground')).toBeNull();
    expect(aPosicionParaEnviar({ ...base, coords: { latitude: 200, longitude: -63.18 } }, 'foreground')).toBeNull();
  });

  it('manda como nulos la velocidad y el rumbo que el sistema no sabe', () => {
    // El sistema devuelve -1 cuando no los conoce. Guardarlos tal cual daria una velocidad de menos
    // un metro por segundo, que no significa nada y un dia alguien promediaria.
    const posicion = aPosicionParaEnviar({ ...base, coords: { ...base.coords, speed: -1, heading: -1 } }, 'background');
    expect(posicion?.speedMps).toBeNull();
    expect(posicion?.headingDegrees).toBeNull();
  });

  it('conserva una altitud negativa, que si es un valor real', () => {
    const posicion = aPosicionParaEnviar({ ...base, coords: { ...base.coords, altitude: -12.5 } }, 'foreground');
    expect(posicion?.altitudeMeters).toBe(-12.5);
  });

  it('propaga la marca de ubicacion simulada, que es señal de fraude', () => {
    expect(aPosicionParaEnviar({ ...base, mocked: true }, 'background')?.isMocked).toBe(true);
    expect(aPosicionParaEnviar(base, 'background')?.isMocked).toBe(false);
  });
});

describe('sinRepetidas', () => {
  it('deja una sola por marca de tiempo y modo, que es como las identifica el servidor', () => {
    const una: PosicionParaEnviar = {
      lat: 1,
      lng: 1,
      accuracyMeters: null,
      altitudeMeters: null,
      speedMps: null,
      headingDegrees: null,
      captureMode: 'foreground',
      isMocked: false,
      capturedAt: '2026-09-04T10:00:00.000Z',
    };
    const lista = [una, { ...una, lat: 2, lng: 2 }, { ...una, captureMode: 'background' as const }];
    expect(sinRepetidas(lista)).toHaveLength(2);
  });
});
