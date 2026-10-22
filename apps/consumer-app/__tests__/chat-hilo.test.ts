import { armarHilo, etiquetaDeDia } from '../src/features/chat-hilo';

type M = { messageId: string; createdAt: string; lado: 'mio' | 'suyo' | 'sistema' };
const m = (id: string, createdAt: string, lado: M['lado']): M => ({ messageId: id, createdAt, lado });
const AHORA = new Date('2026-10-22T15:00:00');

describe('el hilo del chat', () => {
  it('pone un separador por día y agrupa los mensajes seguidos del mismo lado', () => {
    const hilo = armarHilo(
      [
        m('1', '2026-10-21T10:00:00', 'mio'),
        m('2', '2026-10-22T09:00:00', 'mio'),
        m('3', '2026-10-22T09:01:00', 'mio'),
        m('4', '2026-10-22T09:02:00', 'suyo'),
        m('5', '2026-10-22T09:30:00', 'suyo'),
      ],
      (x) => x.lado,
      AHORA,
    );
    expect(hilo.filter((e) => e.tipo === 'dia').map((e) => (e.tipo === 'dia' ? e.etiqueta : ''))).toEqual(['Ayer', 'Hoy']);
    const grupos = hilo.flatMap((e) => (e.tipo === 'mensaje' ? [[e.clave, e.primeroDelGrupo, e.ultimoDelGrupo]] : []));
    expect(grupos).toEqual([
      ['1', true, true],
      ['2', true, false],
      ['3', false, true],
      ['4', true, true],
      // Media hora después: grupo nuevo aunque hable el mismo.
      ['5', true, true],
    ]);
  });

  it('el aviso del sistema nunca se agrupa', () => {
    const hilo = armarHilo([m('1', '2026-10-22T09:00:00', 'sistema'), m('2', '2026-10-22T09:00:10', 'sistema')], (x) => x.lado, AHORA);
    expect(hilo.filter((e) => e.tipo === 'mensaje').every((e) => e.tipo === 'mensaje' && e.primeroDelGrupo && e.ultimoDelGrupo)).toBe(true);
  });

  it('las fechas lejanas llevan día y mes, y el año si no es el actual', () => {
    expect(etiquetaDeDia(new Date('2026-10-05T12:00:00'), AHORA)).toBe('5 de octubre');
    expect(etiquetaDeDia(new Date('2025-12-31T12:00:00'), AHORA)).toBe('31 de diciembre de 2025');
  });
});
