/**
 * Que canales ofrece la pantalla de verificacion, segun lo que diga el servidor.
 *
 * Esto existe por un parche que estuvo meses en el codigo: la pantalla traia los tres canales
 * escritos a mano y arrancaba en «correo» porque era el unico encendido. Ofrecia SMS y WhatsApp, y
 * pedirlos devolvia VERIFICATION_CHANNEL_UNAVAILABLE DESPUES de que la persona ya habia elegido —al
 * final de todo el alta—. Y al reves: encender SMS en el servidor no lo habria ofrecido a nadie sin
 * publicar una version nueva de la app.
 *
 * Lo que se protege aqui: que la app no vuelva a decidir por su cuenta que canales existen.
 */
import {
  canalElegido,
  canalesOfrecidos,
  TODOS,
  type Canal,
} from '../src/features/onboarding/canales-de-verificacion';

const catalogo = (abiertos: Canal[]) =>
  TODOS.map((channel) => ({ channel, available: abiertos.includes(channel) }));

describe('canalesOfrecidos', () => {
  it('ofrece solo lo que el servidor puede entregar', () => {
    const { opciones } = canalesOfrecidos(catalogo(['email']));
    expect(opciones.map((o) => o.valor)).toEqual(['email']);
  });

  it('al encender SMS en el servidor, la app lo ofrece sin tocar una linea', () => {
    const { opciones } = canalesOfrecidos(catalogo(['email', 'sms']));
    expect(opciones.map((o) => o.valor)).toEqual(['email', 'sms']);
  });

  /**
   * El orden es del SERVIDOR. Reordenarlo aqui devolveria el problema al punto de partida: cambiar
   * la preferencia exigiria publicar una app nueva.
   */
  it('conserva el orden en que vino, no uno propio', () => {
    const alReves = [
      { channel: 'whatsapp' as const, available: true },
      { channel: 'sms' as const, available: true },
      { channel: 'email' as const, available: true },
    ];
    expect(canalesOfrecidos(alReves).opciones.map((o) => o.valor)).toEqual(['whatsapp', 'sms', 'email']);
  });

  it('con un solo canal, dice cual es para poder bloquear el desplegable', () => {
    expect(canalesOfrecidos(catalogo(['email'])).unico).toBe('correo');
    expect(canalesOfrecidos(catalogo(['email', 'sms'])).unico).toBeNull();
  });

  /**
   * Los dos casos de respaldo. Quien llega a esta pantalla ya completo todo el alta: quedarse sin
   * nada que pulsar porque una consulta auxiliar no contesto seria cambiar un problema pequeño por
   * uno grande.
   */
  it('si la consulta fallo (null) ofrece los tres, como antes', () => {
    expect(canalesOfrecidos(null).opciones.map((o) => o.valor)).toEqual(TODOS);
  });

  it('si el servidor dice que no hay NINGUNO, tampoco deja el desplegable vacio', () => {
    expect(canalesOfrecidos(catalogo([])).opciones.map((o) => o.valor)).toEqual(TODOS);
  });

  it('cada canal llega con su rotulo, porque el servidor manda codigos', () => {
    const { opciones } = canalesOfrecidos(catalogo(['sms']));
    expect(opciones[0]).toMatchObject({ valor: 'sms', etiqueta: 'SMS', detalle: 'A tu número registrado.' });
  });
});

describe('canalElegido', () => {
  it('corrige el canal inicial cuando el servidor no puede entregarlo', () => {
    const { opciones } = canalesOfrecidos(catalogo(['sms']));
    expect(canalElegido('email', opciones)).toBe('sms');
  });

  it('respeta la eleccion de la persona si sigue siendo posible', () => {
    const { opciones } = canalesOfrecidos(catalogo(['email', 'sms', 'whatsapp']));
    expect(canalElegido('whatsapp', opciones)).toBe('whatsapp');
  });

  it('sin opciones no cambia nada, en vez de dejar el canal en indefinido', () => {
    expect(canalElegido('email', [])).toBe('email');
  });
});
