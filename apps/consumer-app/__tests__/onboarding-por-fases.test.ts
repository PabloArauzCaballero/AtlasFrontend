/**
 * Las cuatro fases del alta: el orden de la app es el del servidor, y la lectura del carnet solo
 * prellena lo que se leyo de verdad.
 *
 * El orden lo decide `ONBOARDING_SECTION_CODES` en AtlasBackend (`customer-eligibility.constants.ts`)
 * y la app lo COPIA en `SECTION_ORDER` para poder decir «Paso 3 de 8». Si los dos se separan, la app
 * numera mal y —peor— `routeForNextStep` manda a una pantalla distinta de la que el servidor pide.
 * Esta prueba lee el archivo del backend cuando el monorepo esta al lado; si no esta, comprueba
 * contra la copia fijada aqui, que es la ultima que se verifico contra el.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FASE_DE_SECCION, SECTION_LABEL, SECTION_ORDER, SECTION_ROUTE, routeForNextStep, stepPosition } from '../src/features/onboarding-map';
import { normalizarFecha, paraPrellenar } from '../src/features/lectura-del-carnet';

// La lectura del carnet se guarda en AsyncStorage; en jest no hay modulo nativo y se usa su doble
// oficial. `jest.mock` se eleva por encima de los imports aunque este escrito debajo.
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const ORDEN_DEL_SERVIDOR_FIJADO = [
  'contact_verification',
  'identity_documents',
  'personal_data',
  'address',
  'financial_profile',
  'reference_contacts',
  'device_permissions',
  'consumer_survey',
];

function ordenDelServidor(): string[] {
  const ruta = resolve(__dirname, '../../../../AtlasBackend/src/modules/customers/customer-eligibility.constants.ts');
  if (!existsSync(ruta)) return ORDEN_DEL_SERVIDOR_FIJADO;
  const fuente = readFileSync(ruta, 'utf8');
  const bloque = /export const ONBOARDING_SECTION_CODES = \[([\s\S]*?)\] as const;/.exec(fuente);
  if (!bloque) throw new Error('No se encontro ONBOARDING_SECTION_CODES en el backend.');
  return [...bloque[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

describe('las cuatro fases del alta', () => {
  it('el orden de la app es el del servidor', () => {
    expect(SECTION_ORDER).toEqual(ordenDelServidor());
    expect(SECTION_ORDER).toEqual(ORDEN_DEL_SERVIDOR_FIJADO);
  });

  it('el carnet va antes que los datos personales, y los permisos y los habitos cierran', () => {
    expect(SECTION_ORDER.indexOf('identity_documents')).toBeLessThan(SECTION_ORDER.indexOf('personal_data'));
    expect(SECTION_ORDER.slice(-2)).toEqual(['device_permissions', 'consumer_survey']);
    expect(stepPosition('identity_documents')).toEqual({ step: 2, total: 8 });
    expect(stepPosition('consumer_survey')).toEqual({ step: 8, total: 8 });
  });

  it('cada seccion tiene ruta, rotulo y fase', () => {
    for (const code of SECTION_ORDER) {
      expect(SECTION_ROUTE[code]).toMatch(/^\/\(onboarding\)\//);
      expect(SECTION_LABEL[code].title.length).toBeGreaterThan(0);
      expect([1, 2, 3, 4]).toContain(FASE_DE_SECCION[code]);
    }
    expect(routeForNextStep('device_permissions')).toBe('/(onboarding)/permisos');
    expect(routeForNextStep('consumer_survey')).toBe('/(onboarding)/habitos');
    expect(routeForNextStep('awaiting_review')).toBe('/(onboarding)/revision');
  });
});

describe('la lectura del carnet', () => {
  it('solo prellena procedencias que sostienen «se leyo el documento»', () => {
    expect(
      paraPrellenar({
        firstNames: { value: ' MARIA RENEE ', confidence: 0.9, source: 'OCR' },
        lastNames: { value: 'RODRIGUEZ', confidence: 0.4, source: 'MODEL' },
        dateOfBirth: { value: '07/12/2001', confidence: 0.8, source: 'MRZ' },
      }),
    ).toEqual({ firstNames: 'MARIA RENEE', lastNames: undefined, dateOfBirth: '2001-12-07' });
    expect(paraPrellenar(null)).toBeNull();
    expect(paraPrellenar({ documentNumber: { value: '1234567', confidence: 1, source: 'OCR' } })).toBeNull();
  });

  it('entiende la fecha como la imprime la cedula y como la manda el servidor', () => {
    expect(normalizarFecha('23/06/2026')).toBe('2026-06-23');
    expect(normalizarFecha('2026-06-23')).toBe('2026-06-23');
    expect(normalizarFecha('junio 2026')).toBeUndefined();
    expect(normalizarFecha(undefined)).toBeUndefined();
  });
});
