/**
 * El esmalte de las insignias se lee con CUALQUIER marca: la actual y las ocho extremas de `temas-contraste`.
 *
 * La insignia es un objeto oscuro en los dos temas; su texto y sus filetes se miden contra las tres luces de la cara.
 */
import { aOklch, contraste } from '../src/theme/color';
import { crearEsmalte } from '../src/theme/esmalte';
import { marca } from '../src/theme/marca';
import type { Marca } from '../src/theme/temas';

const MARCAS: Record<string, Marca> = {
  actual: { principal: marca.principal, acento: marca.acento },
  amarillo: { principal: '#FFD60A', acento: '#FFEB3B' },
  lima: { principal: '#32D74B', acento: '#A4FF00' },
  rojo: { principal: '#E10600', acento: '#FF3B30' },
  negro: { principal: '#000000', acento: '#111111' },
  blanco: { principal: '#FFFFFF', acento: '#F5F5F5' },
  violeta: { principal: '#5E2CA5', acento: '#BF5AF2' },
  celeste: { principal: '#64D2FF', acento: '#5AC8FA' },
};

describe.each(Object.entries(MARCAS))('marca %s', (_nombre, m) => {
  const e = crearEsmalte(m);
  const caras = [e.cara, e.caraAlta, e.caraProfunda];
  const peor = (c: string) => Math.min(...caras.map((f) => contraste(c, f)));

  it.each([
    ['tinta primaria', e.tinta.primaria, 7],
    ['tinta secundaria', e.tinta.secundaria, 4.5],
    ['tinta terciaria', e.tinta.terciaria, 4.5],
    ['filete (icono y marcas del rango)', e.filete, 4.5],
  ])('%s se lee sobre toda la cara', (_rol, c, minimo) => {
    expect(peor(c as string)).toBeGreaterThanOrEqual(minimo as number);
  });

  it('el esmalte es oscuro aunque la marca sea clara', () => {
    for (const c of caras) expect(aOklch(c).l).toBeLessThan(0.4);
  });
});
