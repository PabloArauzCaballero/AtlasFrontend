import { aMundo, deMundo, iosSinMapaNativo, TESELA_PX, teselasVisibles, urlDeTesela } from '../src/features/teselas';

describe('mapa de teselas (respaldo de iOS 16)', () => {
  const santaCruz = { lat: -17.783327, lng: -63.18214 };

  it('ida y vuelta a píxeles del mundo no mueve la casa ni un centímetro', () => {
    for (const zoom of [5, 12, 17, 19]) {
      const vuelta = deMundo(aMundo(santaCruz, zoom), zoom);
      expect(vuelta.lat).toBeCloseTo(santaCruz.lat, 7);
      expect(vuelta.lng).toBeCloseTo(santaCruz.lng, 7);
    }
  });

  it('el hemisferio sur cae en la mitad de abajo y el oeste en la de la izquierda', () => {
    const p = aMundo(santaCruz, 1);
    expect(p.x).toBeLessThan(TESELA_PX);
    expect(p.y).toBeGreaterThan(TESELA_PX);
  });

  it('arrastrar a la derecha lleva el centro al oeste', () => {
    const z = 17;
    const m = aMundo(santaCruz, z);
    const nuevo = deMundo({ x: m.x - 100, y: m.y }, z);
    expect(nuevo.lng).toBeLessThan(santaCruz.lng);
    expect(nuevo.lat).toBeCloseTo(santaCruz.lat, 6);
  });

  it('las teselas cubren la vista entera con un margen', () => {
    const centro = aMundo(santaCruz, 17);
    const teselas = teselasVisibles(centro, 17, 360, 520);
    const izquierda = Math.min(...teselas.map((t) => t.izquierda));
    const derecha = Math.max(...teselas.map((t) => t.izquierda + TESELA_PX));
    const arriba = Math.min(...teselas.map((t) => t.arriba));
    const abajo = Math.max(...teselas.map((t) => t.arriba + TESELA_PX));
    expect(izquierda).toBeLessThanOrEqual(-TESELA_PX + 1);
    expect(derecha).toBeGreaterThanOrEqual(360 + TESELA_PX - 1);
    expect(arriba).toBeLessThanOrEqual(-TESELA_PX + 1);
    expect(abajo).toBeGreaterThanOrEqual(520 + TESELA_PX - 1);
    expect(new Set(teselas.map((t) => t.clave)).size).toBe(teselas.length);
  });

  it('las URL van por https (ATS)', () => {
    expect(urlDeTesela('calles', { x: 1, y: 2, z: 3 })).toMatch(/^https:\/\//);
    expect(urlDeTesela('satelite', { x: 1, y: 2, z: 3 })).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/1',
    );
  });

  it('sólo iOS 16 o anterior usa el mapa propio', () => {
    expect(iosSinMapaNativo('16.7.10')).toBe(true);
    expect(iosSinMapaNativo('15.8')).toBe(true);
    expect(iosSinMapaNativo('17.0')).toBe(false);
    expect(iosSinMapaNativo('26.1')).toBe(false);
    expect(iosSinMapaNativo('raro')).toBe(true);
  });
});
