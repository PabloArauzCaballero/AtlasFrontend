import type { ContentEntry } from '../src/api/endpoints/app-content';
import { CLAVE_QUE_ES_ATLAS, PASOS_POR_DEFECTO, pasosDesdeContenido } from '../src/features/bienvenida-pasos';
import { esIlustracion, NOMBRES_DE_ILUSTRACION } from '../src/ui/ilustraciones-bienvenida';

/**
 * Quien abre la app por primera vez lee PRIMERO qué es Atlas y cómo funciona, tenga o no tenga el portal
 * editados los pasos de siempre.
 */
const pieza = (extra: Partial<ContentEntry> & { contentKey: string }): ContentEntry => ({
  surface: 'onboarding',
  title: 'Título',
  subtitle: 'Cuerpo',
  body: null,
  bullets: [],
  metadata: {},
  action: null,
  displayOrder: 1,
  ...extra,
});

describe('pasos de fábrica', () => {
  it('son cuatro y el primero es «Qué es Atlas»', () => {
    expect(PASOS_POR_DEFECTO.map((p) => p.clave)).toEqual([CLAVE_QUE_ES_ATLAS, 'paso-1', 'paso-2', 'paso-3']);
    expect(PASOS_POR_DEFECTO[0]!.titulo).toBe('Qué es Atlas');
  });

  it('cada paso lleva una ilustración distinta y todas existen', () => {
    const nombres = PASOS_POR_DEFECTO.map((p) => p.ilustracion);
    expect(new Set(nombres).size).toBe(4);
    for (const nombre of nombres) expect(NOMBRES_DE_ILUSTRACION).toContain(nombre);
  });
});

describe('pasosDesdeContenido', () => {
  it('sin contenido del portal quedan los de fábrica', () => {
    expect(pasosDesdeContenido([])).toBe(PASOS_POR_DEFECTO);
  });

  it('con sólo el eslogan tampoco hay pasos propios: quedan los de fábrica', () => {
    expect(pasosDesdeContenido([pieza({ contentKey: 'eslogan', subtitle: 'Eslogan' })])).toBe(PASOS_POR_DEFECTO);
  });

  it('si el portal sólo tiene los tres pasos de siempre, «Qué es Atlas» se antepone: el primer paso nunca falta', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'eslogan' }),
      pieza({ contentKey: 'paso-1', title: 'Escaneas', subtitle: 'a' }),
      pieza({ contentKey: 'paso-2', title: 'Pagas', subtitle: 'b' }),
      pieza({ contentKey: 'paso-3', title: 'Construyes', subtitle: 'c' }),
    ]);
    expect(pasos.map((p) => p.clave)).toEqual([CLAVE_QUE_ES_ATLAS, 'paso-1', 'paso-2', 'paso-3']);
    expect(pasos[0]!.titulo).toBe('Qué es Atlas');
    // El texto editado en el portal manda sobre el de fábrica.
    expect(pasos[1]!.titulo).toBe('Escaneas');
  });

  it('si el portal SÍ tiene «Qué es Atlas», manda su texto y va primero aunque llegue después', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'paso-1', title: 'Escaneas', subtitle: 'a' }),
      pieza({ contentKey: CLAVE_QUE_ES_ATLAS, title: 'Qué es Atlas (editado)', subtitle: 'texto del portal' }),
    ]);
    expect(pasos.map((p) => p.clave)).toEqual([CLAVE_QUE_ES_ATLAS, 'paso-1']);
    expect(pasos[0]).toMatchObject({ titulo: 'Qué es Atlas (editado)', cuerpo: 'texto del portal' });
  });

  it('cada paso toma la ilustración de su clave', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'paso-1' }),
      pieza({ contentKey: 'paso-2' }),
      pieza({ contentKey: 'paso-3' }),
    ]);
    expect(pasos.map((p) => p.ilustracion)).toEqual(['que-es-atlas', 'escaneas-y-listo', 'pagas-en-cuotas', 'construyes-historial']);
  });

  it('metadata.ilustracion manda sobre la clave; un nombre desconocido se ignora', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'paso-1', metadata: { ilustracion: 'construyes-historial' } }),
      pieza({ contentKey: 'paso-2', metadata: { ilustracion: 'no-existe' } }),
    ]);
    expect(pasos.find((p) => p.clave === 'paso-1')!.ilustracion).toBe('construyes-historial');
    expect(pasos.find((p) => p.clave === 'paso-2')!.ilustracion).toBe('pagas-en-cuotas');
  });

  it('una clave nueva que el portal invente toma la ilustración por su posición, nunca queda sin dibujo', () => {
    const pasos = pasosDesdeContenido([pieza({ contentKey: 'paso-nuevo' })]);
    expect(pasos.every((p) => esIlustracion(p.ilustracion))).toBe(true);
  });

  it('las piezas sin título o sin cuerpo se descartan', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'paso-1', title: null }),
      pieza({ contentKey: 'paso-2', subtitle: null, body: null, bullets: [] }),
      pieza({ contentKey: 'paso-3', title: 'Bueno', subtitle: 'Sí' }),
    ]);
    expect(pasos.map((p) => p.clave)).toEqual([CLAVE_QUE_ES_ATLAS, 'paso-3']);
  });

  it('el icono de un bullet se respeta si existe y se ignora si el nombre no es de la app', () => {
    const pasos = pasosDesdeContenido([
      pieza({ contentKey: 'paso-1', bullets: [{ text: 'x', icon: 'camara' }] }),
      pieza({ contentKey: 'paso-2', bullets: [{ text: 'x', icon: 'icono-inventado' }] }),
    ]);
    expect(pasos.find((p) => p.clave === 'paso-1')!.icon).toBe('camara');
    expect(pasos.find((p) => p.clave === 'paso-2')!.icon).toBe('billetera');
  });
});
