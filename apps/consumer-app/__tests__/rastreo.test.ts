import {
  aContactoParaEnviar,
  aPosicionParaEnviar,
  fechaDeCumpleanos,
  sinRepetidas,
  trocear,
  type PosicionParaEnviar,
} from '../src/features/rastreo';

/**
 * La agenda completa y el rastro, por las partes que fallan sin decirlo.
 *
 * Lo que se prueba aquí no es «convierte un objeto en otro» —eso se ve leyéndolo—, sino los cuatro
 * sitios donde un error produce un dato PLAUSIBLE Y FALSO: un cumpleaños corrido un mes, una ficha
 * vacía que infla la cuenta de contactos, una coordenada `NaN` que el servidor rechaza con un 400
 * que nadie relaciona con esto, y una velocidad de `-1` que un día alguien promediaría.
 */
describe('fechaDeCumpleanos', () => {
  it('NO le suma uno al mes: la API nueva lo da de 1 a 12, no de 0 a 11', () => {
    /*
      Este es el error que hay que evitar. La API VIEJA de expo-contacts daba el mes en base cero,
      como `Date`, y la nueva lo da en base uno. Arrastrar el `+1` de la vieja correria TODOS los
      cumpleaños un mes sin que nada fallara: el dato existiria, tendria forma de fecha y seria
      mentira.
    */
    expect(fechaDeCumpleanos({ year: 1990, month: 1, day: 15 })).toBe('1990-01-15');
    expect(fechaDeCumpleanos({ year: 1990, month: 12, day: 31 })).toBe('1990-12-31');
  });

  it('devuelve null cuando la agenda no guarda el año', () => {
    // Es el caso NORMAL en iOS: día y mes sin año. Inventar uno daría una edad falsa que después
    // nadie sabría distinguir de una real.
    expect(fechaDeCumpleanos({ month: 5, day: 3 })).toBeNull();
    expect(fechaDeCumpleanos(null)).toBeNull();
    expect(fechaDeCumpleanos(undefined)).toBeNull();
  });

  it('descarta valores imposibles en vez de construir una fecha inválida', () => {
    expect(fechaDeCumpleanos({ year: 1990, month: 13, day: 1 })).toBeNull();
    expect(fechaDeCumpleanos({ year: 1990, month: 0, day: 1 })).toBeNull();
    expect(fechaDeCumpleanos({ year: 1800, month: 1, day: 1 })).toBeNull();
  });
});

describe('aContactoParaEnviar', () => {
  it('arma la ficha completa con lo que la agenda tenga', () => {
    const ficha = aContactoParaEnviar({
      id: 'abc-123',
      fullName: 'María Quispe',
      givenName: 'María',
      familyName: 'Quispe',
      company: 'Ferretería Sur',
      jobTitle: 'Dueña',
      isFavourite: true,
      birthday: { year: 1985, month: 3, day: 9 },
      phones: [{ label: 'móvil', number: '+591 76500122' }, { label: 'casa', number: '4123456' }],
      emails: [{ label: 'trabajo', address: 'maria@ferreteria.bo' }],
      addresses: [{ label: 'casa', street: 'Av. Siempre Viva 123', city: 'Santa Cruz', region: 'SC', country: 'BO' }],
    });

    expect(ficha).not.toBeNull();
    expect(ficha?.displayName).toBe('María Quispe');
    expect(ficha?.birthday).toBe('1985-03-09');
    expect(ficha?.phones).toHaveLength(2);
    expect(ficha?.isFavorite).toBe(true);
    expect(ficha?.emails).toEqual([{ label: 'trabajo', email: 'maria@ferreteria.bo' }]);
    // Tiene nombre de persona, asi que es una persona aunque tenga empresa.
    expect(ficha?.contactType).toBe('person');
  });

  it('descarta la ficha sin identificador y la que no tiene ningun dato util', () => {
    /*
      Las agendas reales estan llenas de restos de cuentas que se quitaron: fichas sin nombre, sin
      numero y sin correo. Mandarlas engorda la cuenta de contactos de esa persona sin añadir nada,
      y esa cuenta es una de las señales que el motor lee.
    */
    expect(aContactoParaEnviar({ id: '', fullName: 'Sin id' })).toBeNull();
    expect(aContactoParaEnviar({ id: 'vacio', phones: [], emails: [] })).toBeNull();
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

  it('descarta telefonos y correos vacios en vez de mandarlos como cadenas en blanco', () => {
    const ficha = aContactoParaEnviar({
      id: 'x',
      fullName: 'Alguien',
      phones: [{ number: '  ' }, { number: '76500122' }, null],
      emails: [{ address: '' }],
    });
    expect(ficha?.phones).toEqual([{ label: null, number: '76500122' }]);
    expect(ficha?.emails).toEqual([]);
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
