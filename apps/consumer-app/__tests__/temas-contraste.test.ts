/**
 * El contraste de los DOS temas, con la marca actual y con marcas extremas.
 *
 * Es la garantia que deja cambiar de marca sin miedo: `crearTema` corrige cada tono hasta su
 * contraste, y esta prueba lo comprueba rol por rol contra la PEOR superficie del tema. Las marcas de
 * prueba son las que peor se portan (un amarillo, un lima, un blanco, un negro): si con ellas el
 * tema cumple, con una marca real tambien.
 *
 * Umbrales de WCAG 2.2: 4,5:1 para texto, 3:1 para lo que identifica un control (1.4.11).
 */
import { contraste, sobre } from '../src/theme/color';
import { marca } from '../src/theme/marca';
import { crearTema, type Esquema, type Marca } from '../src/theme/temas';

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

/** Un `rgba(r,g,b,a)` de los tokens pintado sobre una superficie opaca, para medirlo. */
function opaco(valor: string, fondo: string): string {
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(valor);
  if (!m) return valor;
  const hex = `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
  return sobre(hex, Number(m[4]), fondo);
}

describe.each(Object.entries(MARCAS))('marca %s', (_nombre, m) => {
  describe.each(['claro', 'oscuro'] as Esquema[])('tema %s', (esquema) => {
    const t = crearTema(esquema, m);
    const superficies = [t.surface.primary, t.surface.raised, t.surface.secondary, t.surface.sunken];
    const peor = (c: string) => Math.min(...superficies.map((s) => contraste(c, s)));

    it.each([
      ['texto principal', t.text.primary],
      ['texto secundario', t.text.secondary],
      ['texto terciario', t.text.tertiary],
      ['acento', t.accent.base],
      ['exito', t.feedback.success],
      ['aviso', t.feedback.warning],
      ['peligro', t.feedback.danger],
    ])('%s se lee sobre todas las superficies (4,5:1)', (_rol, c) => {
      expect(peor(c)).toBeGreaterThanOrEqual(4.5);
    });

    it('el contorno de un control se distingue (3:1)', () => {
      expect(Math.min(contraste(t.border.field, t.surface.raised), contraste(t.border.field, t.surface.primary))).toBeGreaterThanOrEqual(3);
    });

    it('el texto sobre la accion principal se lee (4,5:1)', () => {
      expect(contraste(t.text.onBrand, t.action.primary)).toBeGreaterThanOrEqual(4.5);
    });

    it('el texto sobre el acento se lee (4,5:1)', () => {
      expect(contraste(t.accent.onAccent, t.accent.base)).toBeGreaterThanOrEqual(4.5);
    });

    it('la accion principal se distingue del fondo (3:1)', () => {
      expect(Math.min(contraste(t.action.primary, t.surface.primary), contraste(t.action.primary, t.surface.raised))).toBeGreaterThanOrEqual(3);
    });

    it('el texto principal se lee dentro de un chip de estado', () => {
      for (const suave of [t.feedbackSoft.success, t.feedbackSoft.warning, t.feedbackSoft.danger, t.feedbackSoft.info]) {
        expect(contraste(t.text.primary, opaco(suave, t.surface.raised))).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('el texto del escenario de marca se lee sobre su fondo', () => {
      expect(contraste(t.stage.ink, t.stage.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.stage.ink3, t.stage.bg)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('la marca no se toca cuando no hace falta', () => {
  it('en claro, la accion principal es el color de la marca tal cual', () => {
    expect(crearTema('claro').action.primary).toBe(marca.principal.toUpperCase());
  });
  it('el icono del arranque usa la rampa del tema (ver scripts/generar-icono-arranque.mjs)', () => {
    const c = crearTema('claro');
    const o = crearTema('oscuro');
    // Valores que se pasan al script al cambiar de marca: luz, sombra, travesano.
    console.log(`icono del arranque — claro: ${c.brand.b500} ${c.brand.b700} ${c.brand.navy} · oscuro: ${o.brand.b300} ${o.brand.b500} ${o.text.primary}`);
    expect(c.brand.b500).toMatch(/^#[0-9A-F]{6}$/);
  });
});
