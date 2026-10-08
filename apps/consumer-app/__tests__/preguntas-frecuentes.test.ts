import { filtrarPreguntas } from '../src/features/preguntas-frecuentes';

const faq = [
  { title: '¿Cómo sube mi límite?', body: 'Pagando a tiempo.', bullets: [] },
  { title: '¿Dónde subo el comprobante?', body: 'En Pagos.', bullets: [{ text: 'Toca la cuota' }] },
  { title: null, body: 'Sin título', bullets: [] },
];

describe('buscador de preguntas frecuentes', () => {
  it('sin búsqueda, todas las que tienen título', () => {
    expect(filtrarPreguntas(faq, '').map((p) => p.title)).toEqual(['¿Cómo sube mi límite?', '¿Dónde subo el comprobante?']);
  });
  it('sin distinguir tildes ni mayúsculas, y también en las viñetas', () => {
    expect(filtrarPreguntas(faq, 'LIMITE').map((p) => p.title)).toEqual(['¿Cómo sube mi límite?']);
    expect(filtrarPreguntas(faq, 'cuota').map((p) => p.title)).toEqual(['¿Dónde subo el comprobante?']);
  });
  it('nada que coincida, lista vacía', () => {
    expect(filtrarPreguntas(faq, 'xyz')).toEqual([]);
  });
});
