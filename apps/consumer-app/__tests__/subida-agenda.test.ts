import { AtlasApiError } from '../src/api/errors';
import { ajustarAlContrato, unicasPorId, type ContactoParaEnviar } from '../src/features/rastreo';
import { clasificarFallo, subirAgendaPorLotes } from '../src/features/subida-agenda';

/**
 * «No se guardan todos mis contactos»: lo que se prueba es que UNA ficha mala o UN corte de red ya
 * no se llevan por delante a las demas, ni dejan la sincronizacion sin cerrar.
 */
const ficha = (id: string, extra: Partial<ContactoParaEnviar> = {}): ContactoParaEnviar => ({
  externalId: id,
  displayName: `Contacto ${id}`,
  givenName: null,
  familyName: null,
  company: null,
  jobTitle: null,
  birthday: null,
  contactType: 'person',
  isFavorite: false,
  phones: [{ label: null, number: '76500122' }],
  emails: [],
  addresses: [],
  ...extra,
});

const validacion = (code = 'VALIDATION_ERROR') => new AtlasApiError({ kind: 'validation', code, message: code, status: 400 });
const red = () => new AtlasApiError({ kind: 'network', code: 'NETWORK_UNREACHABLE', message: 'sin red' });
const sinEspera = async () => undefined;

describe('ajustarAlContrato', () => {
  it('recorta lo que pasa del tope en vez de perder el contacto', () => {
    const ajustada = ajustarAlContrato(
      ficha('a', {
        displayName: 'N'.repeat(300),
        phones: Array.from({ length: 25 }, (_, i) => ({ label: 'L'.repeat(90), number: `7650${String(i).padStart(4, '0')}` })),
      }),
    );
    expect(ajustada?.displayName).toHaveLength(200);
    expect(ajustada?.phones).toHaveLength(20);
    expect(ajustada?.phones[0]?.label).toHaveLength(60);
  });

  it('descarta el dato inservible, no el contacto', () => {
    const ajustada = ajustarAlContrato(ficha('a', { phones: [{ label: null, number: '12' }, { label: null, number: '4123456' }] }));
    expect(ajustada?.phones.map((telefono) => telefono.number)).toEqual(['4123456']);
  });

  it('anula un cumpleaños que no existe (31 de febrero)', () => {
    expect(ajustarAlContrato(ficha('a', { birthday: '1990-02-31' }))?.birthday).toBeNull();
    expect(ajustarAlContrato(ficha('a', { birthday: '1990-02-28' }))?.birthday).toBe('1990-02-28');
  });
});

describe('unicasPorId', () => {
  it('se queda con la ficha que trae mas datos', () => {
    const resultado = unicasPorId([ficha('x', { phones: [] }), ficha('x'), ficha('y')]);
    expect(resultado).toHaveLength(2);
    expect(resultado.find((c) => c.externalId === 'x')?.phones).toHaveLength(1);
  });
});

describe('clasificarFallo', () => {
  it('el consentimiento ausente corta: no es una ficha mala', () => {
    expect(clasificarFallo(validacion('CONSENT_NOT_GRANTED'))).toBe('corte');
    expect(clasificarFallo(validacion())).toBe('rechazo');
    expect(clasificarFallo(red())).toBe('transitorio');
    expect(clasificarFallo(new AtlasApiError({ kind: 'auth', code: 'X', message: 'x', status: 401 }))).toBe('corte');
  });
});

describe('subirAgendaPorLotes', () => {
  const agenda = Array.from({ length: 250 }, (_, i) => ficha(String(i)));

  it('sube todo en lotes y marca solo el ultimo como cierre', async () => {
    const llamadas: { n: number; ultimo: boolean }[] = [];
    const r = await subirAgendaPorLotes(agenda, async (lote, ultimo) => void llamadas.push({ n: lote.length, ultimo }), { esperar: sinEspera });
    expect(llamadas).toEqual([{ n: 100, ultimo: false }, { n: 100, ultimo: false }, { n: 50, ultimo: true }]);
    expect(r).toMatchObject({ subidos: 250, rechazados: 0, pendientes: 0, cerrada: true });
  });

  it('reintenta un corte de red y no pierde el lote', async () => {
    let fallos = 2;
    const r = await subirAgendaPorLotes(
      agenda,
      async () => {
        if (fallos-- > 0) throw red();
      },
      { esperar: sinEspera },
    );
    expect(r).toMatchObject({ subidos: 250, pendientes: 0, cerrada: true });
  });

  it('una ficha rechazada se aisla y las otras 249 se guardan', async () => {
    const guardadas = new Set<string>();
    const r = await subirAgendaPorLotes(
      agenda,
      async (lote) => {
        if (lote.some((c) => c.externalId === '137')) {
          if (lote.length > 1) throw validacion();
          throw validacion();
        }
        lote.forEach((c) => guardadas.add(c.externalId));
      },
      { esperar: sinEspera },
    );
    expect(guardadas.size).toBe(249);
    expect(guardadas.has('137')).toBe(false);
    expect(r).toMatchObject({ subidos: 249, rechazados: 1, pendientes: 0, cerrada: true });
  });

  it('si la rechazada es la ultima, el cierre viaja con otra ficha ya aceptada', async () => {
    const cierres: string[] = [];
    const r = await subirAgendaPorLotes(
      agenda,
      async (lote, ultimo) => {
        if (lote.some((c) => c.externalId === '249')) throw validacion();
        if (ultimo) cierres.push(lote.map((c) => c.externalId).join(','));
      },
      { esperar: sinEspera },
    );
    expect(r.rechazados).toBe(1);
    expect(r.cerrada).toBe(true);
    expect(cierres.length).toBeGreaterThan(0);
  });

  it('sin consentimiento corta a la primera y declara lo pendiente', async () => {
    const enviar = jest.fn(async () => {
      throw validacion('CONSENT_NOT_GRANTED');
    });
    const r = await subirAgendaPorLotes(agenda, enviar, { esperar: sinEspera });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ subidos: 0, pendientes: 250, cerrada: false, corte: 'CONSENT_NOT_GRANTED' });
  });

  it('un corte persistente deja constancia de lo que falta en vez de callar', async () => {
    let lote = 0;
    const r = await subirAgendaPorLotes(
      agenda,
      async () => {
        lote += 1;
        if (lote >= 2) throw red();
      },
      { esperar: sinEspera },
    );
    expect(r.subidos).toBe(100);
    expect(r.pendientes).toBe(150);
    expect(r.cerrada).toBe(false);
  });
});
