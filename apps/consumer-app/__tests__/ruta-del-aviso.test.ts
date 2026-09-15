import { rutaDelAviso } from '../src/device/ruta-del-aviso';

/**
 * Tocar un aviso de campaña abre la pantalla que eligió operaciones. Lo que se fija: sólo rutas
 * internas de la app; una URL, un salto `..`, un `//host` o un tipo raro no navegan a ningún sitio.
 */
describe('rutaDelAviso', () => {
  it('acepta rutas internas', () => {
    expect(rutaDelAviso({ deepLink: '/pagos' })).toBe('/pagos');
    expect(rutaDelAviso({ deepLink: '/preferencias-avisos', campaignId: 'x' })).toBe('/preferencias-avisos');
  });

  it('rechaza URLs externas, saltos y valores que no son texto', () => {
    expect(rutaDelAviso({ deepLink: 'https://evil.example/login' })).toBeNull();
    expect(rutaDelAviso({ deepLink: '//evil.example' })).toBeNull();
    expect(rutaDelAviso({ deepLink: '/pagos/../../x' })).toBeNull();
    expect(rutaDelAviso({ deepLink: 42 })).toBeNull();
    expect(rutaDelAviso({})).toBeNull();
    expect(rutaDelAviso(null)).toBeNull();
    expect(rutaDelAviso('/pagos')).toBeNull();
  });
});
