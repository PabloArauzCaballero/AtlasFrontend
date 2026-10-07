import { esBannerDePartner, piezasVisibles, tieneContenido } from '../src/ui/surface-content';
import type { ContentEntry } from '../src/api/endpoints/app-content';

const pieza = (parcial: Partial<ContentEntry>): ContentEntry => ({
  contentKey: 'k',
  surface: 'home',
  title: null,
  subtitle: null,
  body: null,
  bullets: [],
  metadata: {},
  action: null,
  displayOrder: 1,
  ...parcial,
});

describe('contenido por pantalla', () => {
  it('una pieza con solo espacios no se pinta', () => {
    expect(tieneContenido(pieza({ title: '  ', body: ' ' }))).toBe(false);
    expect(tieneContenido(pieza({ bullets: [{ text: ' ' }] }))).toBe(false);
  });

  it('una pieza con titulo, texto o un punto se pinta', () => {
    expect(tieneContenido(pieza({ title: 'Hola' }))).toBe(true);
    expect(tieneContenido(pieza({ body: 'Texto' }))).toBe(true);
    expect(tieneContenido(pieza({ bullets: [{ text: 'Punto' }] }))).toBe(true);
  });

  it('en Inicio el banner de partner no sale dos veces', () => {
    const banner = pieza({ contentKey: 'b', title: 'Oferta', metadata: { partnerName: 'Libreria' } });
    const aviso = pieza({ contentKey: 'a', title: 'Aviso' });
    expect(esBannerDePartner(banner)).toBe(true);
    expect(piezasVisibles([banner, aviso], esBannerDePartner).map((e) => e.contentKey)).toEqual(['a']);
  });
});
