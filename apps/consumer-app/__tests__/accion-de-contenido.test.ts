import { accionPermitida, enlaceExternoSeguro } from '../src/features/accion-de-contenido';

/** APP-17: el botón de contenido remoto sólo abre `https:` y rutas internas. */
describe('acción de contenido remoto', () => {
  const accion = (kind: string, url: string) => ({ kind, label: 'Ver', url });

  it('deja pasar https, WhatsApp por wa.me, rutas internas y recorridos', () => {
    expect(accionPermitida(accion('link', 'https://atlas.bo/ayuda'))).not.toBeNull();
    expect(accionPermitida(accion('whatsapp', 'https://wa.me/59170000000?text=hola'))).not.toBeNull();
    expect(accionPermitida(accion('screen', '/(app)/pagos'))).not.toBeNull();
    expect(accionPermitida(accion('tour', 'inicio'))).not.toBeNull();
  });

  it.each([
    ['link', 'http://atlas.bo'],
    ['link', 'javascript:alert(1)'],
    ['link', 'tel:+59170000000'],
    ['link', 'sms:+59170000000'],
    ['whatsapp', 'whatsapp://send?phone=591'],
    ['link', 'otraapp://pagar'],
    ['link', 'https://'],
    ['screen', 'https://atlas.bo'],
    ['screen', '//evil.com/x'],
    ['screen', '/../secreto'],
    ['tour', '   '],
  ])('rechaza %s %s', (kind, url) => {
    expect(accionPermitida(accion(kind, url))).toBeNull();
  });

  it('sin acción, nada', () => {
    expect(accionPermitida(null)).toBeNull();
    expect(enlaceExternoSeguro('no es una url')).toBe(false);
  });
});
