import { evaluarFotoDeCarnet } from '../src/features/parece-carnet';

describe('¿parece un carnet?', () => {
  it('un recorte del escáner con forma de carnet y detalle, sí', () => {
    expect(evaluarFotoDeCarnet({ ancho: 2400, alto: 1513, bytes: 900_000, origen: 'system_scanner' }).pareceCarnet).toBe(true);
  });

  it('una foto de la cámara de la app con detalle, sí (no se le mide la proporción)', () => {
    expect(evaluarFotoDeCarnet({ ancho: 3024, alto: 4032, bytes: 2_400_000, origen: 'camera' }).pareceCarnet).toBe(true);
  });

  it('un recorte cuadrado del escáner, no', () => {
    const r = evaluarFotoDeCarnet({ ancho: 2000, alto: 2000, bytes: 900_000, origen: 'system_scanner' });
    expect(r.pareceCarnet).toBe(false);
    expect(r.motivos.map((m) => m.senal)).toEqual(['proporcion']);
  });

  it('una foto oscura o lisa (pocos bytes por píxel), no', () => {
    const r = evaluarFotoDeCarnet({ ancho: 3024, alto: 4032, bytes: 120_000, origen: 'camera' });
    expect(r.motivos.map((m) => m.senal)).toEqual(['sin_detalle']);
  });

  it('una imagen muy pequeña, no', () => {
    expect(evaluarFotoDeCarnet({ ancho: 800, alto: 600, origen: 'camera' }).motivos.map((m) => m.senal)).toEqual(['pequena']);
  });

  it('sin medidas no sospecha: no hay con qué', () => {
    expect(evaluarFotoDeCarnet({ origen: 'camera', bytes: 10 }).pareceCarnet).toBe(true);
  });
});
