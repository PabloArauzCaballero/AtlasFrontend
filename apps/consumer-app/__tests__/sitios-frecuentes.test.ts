import { distanciaM, sitiosFrecuentes, type PosicionHistorica } from '../src/features/sitios-frecuentes';

/**
 * «El domicilio tiene que marcar los sitios que frecuento»: lo que se prueba es que un sitio es un
 * lugar al que se VUELVE (no un paso suelto, ni diez medidas seguidas en la misma oficina), y que el
 * GPS que baila unos metros no parte un mismo lugar en dos.
 */
const CASA = { lat: -17.7833, lng: -63.1821 };
const OFICINA = { lat: -17.7712, lng: -63.1954 };

// Cada metro de latitud son ~9e-6 grados.
const desplazado = (p: { lat: number; lng: number }, metros: number) => ({ lat: p.lat + metros * 9e-6, lng: p.lng });
const en = (p: { lat: number; lng: number }, dia: number, hora: number, min = 0): PosicionHistorica => ({
  ...p,
  at: new Date(2026, 8, dia, hora, min).toISOString(),
});

describe('sitiosFrecuentes', () => {
  it('marca los DOS sitios a los que se vuelve, el mas visitado primero', () => {
    const historial = [
      en(CASA, 1, 22), en(CASA, 2, 23), en(CASA, 3, 22), // 3 noches en casa
      en(OFICINA, 1, 10), en(OFICINA, 2, 10), // 2 dias en la oficina
    ];
    const sitios = sitiosFrecuentes(historial);
    expect(sitios).toHaveLength(2);
    expect(sitios[0]?.visitas).toBe(3);
    expect(sitios[0]?.nocturno).toBe(true);
    expect(sitios[1]?.nocturno).toBe(false);
  });

  it('un paso suelto no es un sitio', () => {
    expect(sitiosFrecuentes([en(CASA, 1, 22), en(OFICINA, 1, 12)])).toEqual([]);
  });

  it('diez medidas seguidas en el mismo sitio son UNA visita, no diez', () => {
    const seguidas = Array.from({ length: 10 }, (_, i) => en(OFICINA, 1, 10, i * 5));
    expect(sitiosFrecuentes(seguidas)).toEqual([]);
    expect(sitiosFrecuentes([...seguidas, en(OFICINA, 2, 10)])[0]?.visitas).toBe(2);
  });

  it('el GPS que baila unos metros no parte un mismo lugar en dos', () => {
    const sitios = sitiosFrecuentes([en(CASA, 1, 22), en(desplazado(CASA, 40), 2, 22), en(desplazado(CASA, -60), 3, 22)]);
    expect(sitios).toHaveLength(1);
    expect(distanciaM(sitios[0]!, CASA)).toBeLessThan(60);
  });

  it('a 500 m ya es otro sitio', () => {
    const lejos = desplazado(CASA, 500);
    const sitios = sitiosFrecuentes([en(CASA, 1, 12), en(CASA, 2, 12), en(lejos, 1, 15), en(lejos, 2, 15)]);
    expect(sitios).toHaveLength(2);
  });

  it('ignora lo que no es una posicion valida en vez de romper', () => {
    const basura = [{ lat: NaN, lng: 0, at: 'x' }, { lat: 200, lng: 0, at: new Date().toISOString() }] as PosicionHistorica[];
    expect(sitiosFrecuentes(basura)).toEqual([]);
  });
});
