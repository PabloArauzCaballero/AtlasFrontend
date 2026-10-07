/**
 * Los tramos de ancho y el `hitSlop` de la web.
 *
 * Protegen dos cosas que rompen en silencio: que los breakpoints tengan un solo origen (si alguien
 * vuelve a escribir «600» en una pantalla, esta prueba no lo ve, pero al menos fija qué significa
 * cada número) y que el sustituto de `hitSlop` en el navegador —un `data-toque` que la hoja de
 * estilo convierte en un pseudoelemento— sólo exista en la web, respete el catálogo y no pise el
 * `dataSet` que el elemento ya traía.
 */
import { Platform } from 'react-native';
import { TOQUES, conToqueWeb, ladosDe, toqueWeb } from '../src/ui/hit-slop';
import { ANCHO_COLUMNA, TRAMO, tramoPara } from '../src/ui/responsive';

describe('tramoPara', () => {
  it('clasifica los anchos de la matriz de dispositivos', () => {
    expect(tramoPara(320)).toBe('telefono');
    expect(tramoPara(430)).toBe('telefono');
    expect(tramoPara(TRAMO.tableta - 1)).toBe('telefono');
    expect(tramoPara(TRAMO.tableta)).toBe('tableta');
    expect(tramoPara(768)).toBe('tableta');
    expect(tramoPara(TRAMO.escritorio - 1)).toBe('tableta');
    expect(tramoPara(TRAMO.escritorio)).toBe('escritorio');
    expect(tramoPara(2560)).toBe('escritorio');
  });

  it('el zoom al 200 % en un portátil de 1280 px se lee como tableta', () => {
    expect(tramoPara(1280 / 2)).toBe('tableta');
  });

  it('la segunda columna del acceso aparece entre la tableta y el escritorio', () => {
    expect(TRAMO.panelLateral).toBeGreaterThan(TRAMO.tableta);
    expect(TRAMO.panelLateral).toBeLessThan(TRAMO.escritorio);
    // La columna del formulario nunca queda por debajo de la de lectura.
    expect(TRAMO.panelLateral / 2).toBeGreaterThanOrEqual(ANCHO_COLUMNA * 0.8);
  });
});

describe('toqueWeb', () => {
  const os = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });

  it('en el teléfono no hace nada: manda hitSlop', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(toqueWeb(12)).toEqual({});
  });

  it('en la web marca el elemento con la medida del catálogo', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    expect(toqueWeb(12)).toEqual({ dataSet: { toque: '12' } });
    expect(toqueWeb({ top: 8, bottom: 8, left: 4, right: 4 })).toEqual({ dataSet: { toque: '8-4-8-4' } });
    expect(toqueWeb({ top: 6, right: 6, bottom: 6, left: 6 })).toEqual({ dataSet: { toque: '6' } });
  });

  it('una medida fuera del catálogo no marca nada (y avisa en desarrollo)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(toqueWeb(99)).toEqual({});
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it('sin hitSlop no marca nada', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    expect(toqueWeb(undefined)).toEqual({});
    expect(toqueWeb(null)).toEqual({});
  });

  it('conserva el dataSet que el elemento ya traía', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const props = conToqueWeb({ dataSet: { atlas: 'fila' }, onPress: () => undefined }, 12);
    expect(props.dataSet).toEqual({ atlas: 'fila', toque: '12' });
  });

  it('el catálogo se traduce a cuatro lados para la hoja de estilo', () => {
    expect(ladosDe('12')).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
    expect(ladosDe('8-4-8-4')).toEqual({ top: 8, right: 4, bottom: 8, left: 4 });
    for (const t of TOQUES) expect(Object.values(ladosDe(t)).every((n) => Number.isFinite(n))).toBe(true);
  });
});
