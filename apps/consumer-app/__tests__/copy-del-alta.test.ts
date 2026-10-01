import type { ContentEntry } from '../src/api/endpoints/app-content';
import { COPY_DEL_ALTA, COPY_TODOS } from '../src/features/copy-catalog';
import { copyRemoto, olvidarCopyRemoto, recordarCopyRemoto } from '../src/features/copy-cache';
import {
  BLOCKER_COPY,
  LIFECYCLE_COPY,
  SECTION_LABEL,
  describeBlocker,
  describeLifecycle,
  etiquetaDeSeccion,
} from '../src/features/onboarding-map';
import { hallazgos } from './textos-verdaderos.test';

const pieza = (parcial: Partial<ContentEntry>): ContentEntry => ({
  contentKey: 'k',
  surface: 'copy',
  title: null,
  subtitle: null,
  body: null,
  bullets: [],
  metadata: {},
  action: null,
  displayOrder: 1,
  ...parcial,
});

afterEach(() => olvidarCopyRemoto());

describe('el catálogo del alta', () => {
  it('trae una clave por cada etapa, bloqueo y estado de la cuenta', () => {
    expect(Object.keys(COPY_DEL_ALTA).filter((k) => k.startsWith('etapa.'))).toHaveLength(Object.keys(SECTION_LABEL).length);
    expect(Object.keys(COPY_DEL_ALTA).filter((k) => k.startsWith('bloqueo.'))).toHaveLength(Object.keys(BLOCKER_COPY).length);
    expect(Object.keys(COPY_DEL_ALTA).filter((k) => k.startsWith('ciclo.'))).toHaveLength(Object.keys(LIFECYCLE_COPY).length);
  });

  it('cada texto de fábrica tiene título y detalle, y pasa la lista de frases prohibidas', () => {
    for (const [clave, entrada] of Object.entries(COPY_TODOS)) {
      expect({ clave, texto: entrada.texto.trim().length > 0 }).toEqual({ clave, texto: true });
      expect({ clave, malos: hallazgos(`${entrada.titulo ?? ''} ${entrada.texto}`, true) }).toEqual({ clave, malos: [] });
    }
  });

  it('las claves no se pisan entre el catálogo fijo y el del alta', () => {
    const fijas = Object.keys(COPY_TODOS).length - Object.keys(COPY_DEL_ALTA).length;
    expect(fijas).toBeGreaterThan(20);
  });
});

describe('etapas, bloqueos y estado de la cuenta con el texto del portal', () => {
  it('sin contenido del portal sale el de fábrica', () => {
    expect(etiquetaDeSeccion('address')).toEqual(SECTION_LABEL.address);
    expect(describeLifecycle('active')).toEqual(LIFECYCLE_COPY.active);
    expect(describeBlocker({ code: 'ADDRESS_MISSING' } as never)).toEqual(BLOCKER_COPY.ADDRESS_MISSING);
  });

  it('una etapa del portal sustituye título y detalle; el icono sigue siendo del código', () => {
    recordarCopyRemoto([pieza({ contentKey: 'etapa.address', title: 'Dónde vives', body: 'Tu dirección actual.' })]);
    expect(etiquetaDeSeccion('address')).toEqual({ ...SECTION_LABEL.address, title: 'Dónde vives', detail: 'Tu dirección actual.' });
  });

  it('un bloqueo del portal cambia el texto pero NO si es accionable (eso lo decide el código)', () => {
    recordarCopyRemoto([pieza({ contentKey: 'bloqueo.ADDRESS_MISSING', title: 'Falta la dirección', body: 'Cuéntanos dónde vives.' })]);
    const copia = describeBlocker({ code: 'ADDRESS_MISSING' } as never);
    expect(copia).toMatchObject({ title: 'Falta la dirección', detail: 'Cuéntanos dónde vives.' });
    expect(copia.actionable).toBe(BLOCKER_COPY.ADDRESS_MISSING?.actionable);
  });

  it('el estado de la cuenta del portal sustituye el de fábrica', () => {
    recordarCopyRemoto([pieza({ contentKey: 'ciclo.active', title: 'Todo listo', body: 'Ya puedes comprar.' })]);
    expect(describeLifecycle('active')).toEqual({ title: 'Todo listo', detail: 'Ya puedes comprar.' });
  });

  it('una pieza a medias no tapa el de fábrica', () => {
    recordarCopyRemoto([
      pieza({ contentKey: 'etapa.address', title: 'Sólo título', body: null }),
      pieza({ contentKey: 'ciclo.active', title: '  ', body: '  ' }),
    ]);
    expect(etiquetaDeSeccion('address')).toEqual(SECTION_LABEL.address);
    expect(describeLifecycle('active')).toEqual(LIFECYCLE_COPY.active);
    expect(copyRemoto('ciclo.active')).toBeUndefined();
  });
});
