import type { ContentEntry } from '../src/api/endpoints/app-content';
import {
  promesasDesdeContenido,
  fusionarTour,
  indexarPorClave,
  textoDe,
  trustDesdeContenido,
  fusionarPrivacidad,
} from '../src/features/contenido-remoto';
import { TOUR_INICIO_STEPS } from '../src/features/tour-inicio';
import type { TourStep } from '../src/ui/tour';
import { PRIVACIDAD_DE_FABRICA } from '../src/features/privacidad-copy';
import { TRUST_REGISTRO } from '../src/features/trust-copy';

const pieza = (parcial: Partial<ContentEntry>): ContentEntry => ({
  contentKey: 'k',
  surface: 'tour',
  title: null,
  subtitle: null,
  body: null,
  bullets: [],
  metadata: {},
  action: null,
  displayOrder: 1,
  ...parcial,
});

/** Los tres pasos de fábrica, tipados como lo que son (con `noUncheckedIndexedAccess` el índice puede ser `undefined`). */
const [PASO_1, PASO_2] = TOUR_INICIO_STEPS as [TourStep, TourStep, TourStep];

describe('el recorrido de Inicio con el texto del portal', () => {
  it('sin contenido del portal quedan los pasos de fábrica, tal cual', () => {
    expect(fusionarTour(TOUR_INICIO_STEPS, {})).toEqual(TOUR_INICIO_STEPS);
  });

  it('un paso publicado sustituye título, texto e icono; el elemento al que apunta no cambia', () => {
    const porClave = indexarPorClave([
      pieza({
        contentKey: 'inicio.linea',
        title: 'Tu disponible',
        body: 'Lo que te queda libre.',
        metadata: { icon: 'escudo' },
      }),
    ]);
    const [primero, segundo] = fusionarTour(TOUR_INICIO_STEPS, porClave);
    expect(primero).toMatchObject({
      target: PASO_1.target,
      title: 'Tu disponible',
      body: 'Lo que te queda libre.',
      icon: 'escudo',
    });
    expect(segundo).toEqual(PASO_2);
  });

  it('un paso a medias (sin título o sin texto) se descarta y queda el de fábrica', () => {
    const porClave = indexarPorClave([
      pieza({ contentKey: 'inicio.linea', title: 'Sin cuerpo' }),
      pieza({ contentKey: 'inicio.escanear', body: 'Sin título' }),
    ]);
    expect(fusionarTour(TOUR_INICIO_STEPS, porClave)).toEqual(TOUR_INICIO_STEPS);
  });

  it('un icono que esta versión de la app no tiene cae al icono del paso', () => {
    const porClave = indexarPorClave([
      pieza({
        contentKey: 'inicio.linea',
        title: 'T',
        body: 'B',
        metadata: { icon: 'icono-del-futuro' },
      }),
    ]);
    expect(fusionarTour(TOUR_INICIO_STEPS, porClave)[0]?.icon).toBe(PASO_1.icon);
  });
});

describe('las promesas del alta con el texto del portal', () => {
  const fila = (clave: string, orden: number, dato: string | null, porque: string | null): ContentEntry =>
    pieza({
      surface: 'signup',
      contentKey: clave,
      displayOrder: orden,
      title: dato,
      body: porque,
      metadata: { icon: 'perfil' },
      bullets: [{ text: 'Solo Atlas', icon: 'ojo' }, { text: ' ' }],
    });

  it('sin filas del grupo queda el texto de fábrica entero', () => {
    expect(trustDesdeContenido('registro', [], TRUST_REGISTRO)).toBe(TRUST_REGISTRO);
    expect(trustDesdeContenido('registro', [fila('economia.1', 1, 'X', 'Y')], TRUST_REGISTRO)).toBe(TRUST_REGISTRO);
  });

  it('las filas del portal reemplazan al grupo, en orden, con sus garantías como etiquetas', () => {
    const items = trustDesdeContenido(
      'registro',
      [fila('registro.2', 20, 'Segundo dato', 'Segundo porqué'), fila('registro.1', 10, 'Primer dato', 'Primer porqué')],
      TRUST_REGISTRO,
    );
    expect(items.map((item) => item.dato)).toEqual(['Primer dato', 'Segundo dato']);
    expect(items[0] as unknown).toMatchObject({
      icon: 'perfil',
      porque: 'Primer porqué',
      garantias: [{ icon: 'ojo', label: 'Solo Atlas' }],
    });
  });

  it('una fila a medias no deja la tarjeta con un hueco: se descarta', () => {
    const items = trustDesdeContenido(
      'registro',
      [fila('registro.1', 1, 'Dato', null), fila('registro.2', 2, 'Otro', 'Porqué')],
      TRUST_REGISTRO,
    );
    expect(items.map((item) => item.dato)).toEqual(['Otro']);
  });

  it('si TODAS las filas del grupo están a medias, queda el texto de fábrica', () => {
    expect(trustDesdeContenido('registro', [fila('registro.1', 1, 'Dato', null)], TRUST_REGISTRO)).toBe(TRUST_REGISTRO);
  });
});

describe('textoDe', () => {
  it('usa el del portal si está completo y si no el de fábrica', () => {
    const porClave = indexarPorClave([
      pieza({ contentKey: 'cabecera', title: 'Tus datos (portal)' }),
      pieza({ contentKey: 'vacia', title: '  ' }),
    ]);
    expect(textoDe(porClave, 'cabecera', 'title', 'Tus datos')).toBe('Tus datos (portal)');
    expect(textoDe(porClave, 'vacia', 'title', 'De fábrica')).toBe('De fábrica');
    expect(textoDe(porClave, 'no-existe', 'body', 'De fábrica')).toBe('De fábrica');
  });
});

describe('«Tus datos» con el texto del portal', () => {
  it('sin contenido del portal quedan los textos de fábrica, tal cual', () => {
    expect(fusionarPrivacidad(PRIVACIDAD_DE_FABRICA, {})).toEqual(PRIVACIDAD_DE_FABRICA);
  });

  it('cada pieza completa sustituye su texto y las demás quedan de fábrica', () => {
    const porClave = indexarPorClave([
      pieza({ surface: 'privacy', contentKey: 'cabecera', title: 'Tus datos personales', subtitle: 'Nuevo subtítulo' }),
      pieza({ surface: 'privacy', contentKey: 'derechos', title: 'Ejercer tus derechos', body: 'Plazo de 10 días.' }),
      pieza({ surface: 'privacy', contentKey: 'derecho.access', title: 'Ver lo que sabemos', subtitle: 'Detalle nuevo' }),
    ]);
    const copy = fusionarPrivacidad(PRIVACIDAD_DE_FABRICA, porClave);
    expect(copy).toMatchObject({
      titulo: 'Tus datos personales',
      subtitulo: 'Nuevo subtítulo',
      derechosTitulo: 'Ejercer tus derechos',
      derechosDetalle: 'Plazo de 10 días.',
    });
    expect(copy.permisosTitulo).toBe(PRIVACIDAD_DE_FABRICA.permisosTitulo);
    expect(copy.derechos[0]).toEqual({ value: 'access', label: 'Ver lo que sabemos', detalle: 'Detalle nuevo' });
  });

  it('el valor de cada derecho (lo que entiende el servidor) nunca cambia, solo su etiqueta', () => {
    const porClave = indexarPorClave([pieza({ contentKey: 'derecho.deletion', title: 'Eliminar mi cuenta' })]);
    const valores = fusionarPrivacidad(PRIVACIDAD_DE_FABRICA, porClave).derechos.map((derecho) => derecho.value);
    expect(valores).toEqual(PRIVACIDAD_DE_FABRICA.derechos.map((derecho) => derecho.value));
  });
});

describe('las promesas simples (extracto) con el texto del portal', () => {
  const base = [{ icon: 'candado' as const, title: 'De fábrica', detail: 'Detalle de fábrica' }];
  const fila = (clave: string, orden: number, title: string | null, body: string | null) =>
    pieza({ surface: 'signup', contentKey: clave, displayOrder: orden, title, body, metadata: { icon: 'ojo' } });

  it('sin filas del grupo queda el texto de fábrica', () => {
    expect(promesasDesdeContenido('extracto', [], base)).toBe(base);
    expect(promesasDesdeContenido('extracto', [fila('registro.1', 1, 'X', 'Y')], base)).toBe(base);
  });

  it('las filas completas del portal reemplazan al grupo, en orden, con su icono', () => {
    const filas = promesasDesdeContenido(
      'extracto',
      [fila('extracto.2', 20, 'B', 'bb'), fila('extracto.1', 10, 'A', 'aa'), fila('extracto.3', 30, 'C', null)],
      base,
    );
    expect(filas).toEqual([
      { icon: 'ojo', title: 'A', detail: 'aa' },
      { icon: 'ojo', title: 'B', detail: 'bb' },
    ]);
  });
});
