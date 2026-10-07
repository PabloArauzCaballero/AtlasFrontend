import {
  agendaNoCompartida,
  contarAgenda,
  esBoliviano,
  normalizarTelefono,
} from '../src/features/agenda';

/**
 * El resumen de la agenda, por la parte que puede fallar en silencio.
 *
 * La suma de contactos no necesita prueba: se ve leyéndola. Lo que sí la necesita es la
 * NORMALIZACIÓN, porque su fallo es invisible. Los hashes que salen del teléfono se comparan contra
 * los que el servidor guardó de las referencias (`phone_hash`, sha256 sobre el valor recortado y en
 * minúsculas); si las dos normalizaciones divergen, el cruce no encuentra nunca nada, la señal
 * queda muerta y NADA lo delata — el alta sigue funcionando y el número simplemente sale cero.
 *
 * Y el vacío explícito, que es la otra pieza con consecuencias: «dijo que no» tiene que poder
 * distinguirse de «esta versión de la app no lo pedía», porque el artefacto los pondera distinto.
 */
describe('normalizarTelefono', () => {
  it('deja los digitos nacionales, venga como venga escrito en la agenda', () => {
    // Una agenda real guarda el mismo numero de cinco maneras. Las cinco tienen que dar lo mismo, o
    // el mismo contacto contaria como cinco numeros distintos y el ratio de unicos saldria inflado.
    expect(normalizarTelefono('+591 7 650-0122')).toBe('76500122');
    expect(normalizarTelefono('591 76500122')).toBe('76500122');
    expect(normalizarTelefono('76500122')).toBe('76500122');
    expect(normalizarTelefono('(591) 7650 0122')).toBe('76500122');
    expect(normalizarTelefono('76500122 ')).toBe('76500122');
  });

  it('descarta lo que no puede ser un telefono', () => {
    // Menos de siete digitos no es un numero: es una extension, un codigo corto o basura de la
    // agenda. Contarlos ensuciaria el total y, peor, generaria hashes que nunca cruzan con nada.
    expect(normalizarTelefono('123')).toBeNull();
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
    expect(normalizarTelefono('sin numero')).toBeNull();
  });

  it('NO le quita el 591 a un numero que empieza por 591 y es nacional', () => {
    /*
      El recorte del prefijo solo aplica si al quitarlo queda algo con forma de numero. `5915678` son
      siete digitos: quitarle el prefijo dejaria `5678`, que no es un telefono. Sin esta guarda, un
      fijo que empiece por 591 se convertiria en otro numero distinto y su hash dejaria de cruzar.
    */
    expect(normalizarTelefono('5915678')).toBe('5915678');
  });
});

describe('esBoliviano', () => {
  it('reconoce moviles y fijos del pais', () => {
    expect(esBoliviano('76500122')).toBe(true);
    expect(esBoliviano('69123456')).toBe(true);
    expect(esBoliviano('3345678')).toBe(true);
  });

  it('no cuenta como boliviano un numero que no lo parece', () => {
    // Importa por lo que la señal significa: «casi ningun contacto es boliviano» en un alta de un
    // producto que solo opera en Bolivia. Un falso positivo aqui apaga la señal entera.
    expect(esBoliviano('12025550123')).toBe(false);
    expect(esBoliviano('5551234')).toBe(false);
    expect(esBoliviano('')).toBe(false);
  });
});

describe('contarAgenda', () => {
  it('cuenta FICHAS con numero y NUMEROS distintos, que no son lo mismo', () => {
    /*
      Es el motivo de que la funcion reciba una lista de listas y no una lista plana. Aplanando
      antes, una ficha con tres numeros contaria como tres contactos y el ratio de unicos —numeros
      distintos sobre contactos con numero— saldria del reves.
    */
    const conteo = contarAgenda([
      ['76500122', '33456789'],
      ['76500122'],
      [],
      ['69123456'],
    ]);

    expect(conteo.contactsWithPhone).toBe(3);
    expect(conteo.uniques).toEqual(['76500122', '33456789', '69123456']);
    expect(conteo.bolivianPhoneCount).toBe(3);
  });

  it('un numero repetido en dos fichas cuenta UNA vez como unico', () => {
    // Una agenda real duplica: el movil y el trabajo de la misma persona. Lo que la señal busca es
    // la agenda INFLADA a mano —el mismo numero con nombres distintos— y para verlo hace falta que
    // el denominador sean fichas y el numerador numeros.
    const conteo = contarAgenda([['76500122'], ['76500122'], ['76500122']]);

    expect(conteo.contactsWithPhone).toBe(3);
    expect(conteo.uniques).toHaveLength(1);
  });

  it('una ficha sin numero no cuenta como contacto con numero', () => {
    expect(contarAgenda([[], [], ['76500122']]).contactsWithPhone).toBe(1);
  });
});

describe('agendaNoCompartida', () => {
  it('es un vacio EXPLICITO, no una agenda de cero contactos', () => {
    /*
      Se manda igual cuando la persona dice que no. Registrar la negativa es lo que permite
      distinguirla de una version antigua de la app que ni siquiera lo preguntaba, y el artefacto
      pondera la ausencia como MENOS evidencia —veinte puntos de cien, que solos no llegan a nada—
      en vez de como evidencia en contra.
    */
    const vacia = agendaNoCompartida(2, '2026-08-26T12:00:00.000Z');

    expect(vacia.permiso).toBe(false);
    expect(vacia.totalContacts).toBe(0);
    expect(vacia.phoneHashes).toEqual([]);
    // Las referencias declaradas SI viajan: son dato del formulario, no de la agenda, y sin ellas
    // el servidor no puede distinguir «no declaro ninguna» de «no compartio la agenda».
    expect(vacia.referencesDeclared).toBe(2);
    expect(vacia.algorithmVersion).toMatch(/^contacts-snapshot-/);
    // El reloj lo entrega quien llama: sin eso, la funcion seria imposible de probar sin congelarlo.
    expect(vacia.computedAt).toBe('2026-08-26T12:00:00.000Z');
  });
});
